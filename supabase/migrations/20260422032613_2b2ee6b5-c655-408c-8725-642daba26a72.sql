-- Step 1 & 2: 重新建立 handle_new_user (使用 case-insensitive email 比對) 並掛上 trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  existing_profile_id uuid;
  is_admin_email boolean;
  has_prebuilt_profile boolean;
  reg_member_row public.reg_members%ROWTYPE;
  has_reg_member boolean;
BEGIN
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE LOWER(email) = LOWER(NEW.email) AND activated = false
  LIMIT 1;
  has_prebuilt_profile := existing_profile_id IS NOT NULL;

  SELECT EXISTS(SELECT 1 FROM public.admin_emails WHERE LOWER(email) = LOWER(NEW.email)) INTO is_admin_email;

  SELECT * INTO reg_member_row
  FROM public.reg_members
  WHERE LOWER(email) = LOWER(NEW.email) AND user_id IS NULL
  LIMIT 1;
  has_reg_member := reg_member_row.id IS NOT NULL;

  IF has_prebuilt_profile THEN
    UPDATE public.profiles
    SET id = NEW.id, activated = true, updated_at = now()
    WHERE id = existing_profile_id;
  ELSIF has_reg_member THEN
    INSERT INTO public.profiles (id, display_name, email, phone, student_id, activated)
    VALUES (NEW.id, reg_member_row.name, NEW.email, reg_member_row.phone, reg_member_row.member_no, true)
    ON CONFLICT (id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          student_id = EXCLUDED.student_id,
          activated = true,
          updated_at = now();

    UPDATE public.reg_members SET user_id = NEW.id WHERE id = reg_member_row.id;
  ELSE
    INSERT INTO public.profiles (id, display_name, email, organization_id, student_id, activated)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
      NEW.email,
      NEW.raw_user_meta_data->>'organization_id',
      NEW.raw_user_meta_data->>'student_id',
      true
    )
    ON CONFLICT (id) DO NOTHING;

    IF NOT is_admin_email THEN
      INSERT INTO public.reg_operation_logs (
        operated_by, entity_type, entity_id, action, reason, new_value
      ) VALUES (
        NEW.id, 'profile', NEW.id, 'unmatched_signup',
        '註冊時找不到對應的報名學員，待後台手動綁定',
        jsonb_build_object('email', NEW.email, 'display_name', COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
      );
    END IF;
  END IF;

  IF is_admin_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.notification_settings (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 重新掛 trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 3 & 4: 補齊所有 auth.users 中漏建資料的帳號
-- 4a) 補 profile：先嘗試從 reg_members 取資料
INSERT INTO public.profiles (id, display_name, email, phone, student_id, activated)
SELECT
  u.id,
  COALESCE(NULLIF(m.name, ''), u.raw_user_meta_data->>'display_name', u.email),
  u.email,
  m.phone,
  m.member_no,
  true
FROM auth.users u
LEFT JOIN public.reg_members m
  ON LOWER(m.email) = LOWER(u.email) AND m.user_id IS NULL
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- 4b) 將 reg_members 與對應 auth user 綁定（限 user_id 仍為 NULL 者）
UPDATE public.reg_members m
SET user_id = u.id
FROM auth.users u
WHERE m.user_id IS NULL
  AND LOWER(m.email) = LOWER(u.email)
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- 4c) 對找不到 reg_member 且非 admin 的帳號寫 unmatched_signup log（避免重複）
INSERT INTO public.reg_operation_logs (operated_by, entity_type, entity_id, action, reason, new_value)
SELECT
  u.id, 'profile', u.id, 'unmatched_signup',
  '回填修復：註冊時找不到對應的報名學員，待後台手動綁定',
  jsonb_build_object('email', u.email, 'display_name', COALESCE(u.raw_user_meta_data->>'display_name', u.email))
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.reg_members m WHERE m.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM public.admin_emails a WHERE LOWER(a.email) = LOWER(u.email))
  AND NOT EXISTS (
    SELECT 1 FROM public.reg_operation_logs l
    WHERE l.entity_id = u.id AND l.action = 'unmatched_signup'
  );

-- 4d) 補 user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT u.id,
  CASE WHEN EXISTS (SELECT 1 FROM public.admin_emails a WHERE LOWER(a.email) = LOWER(u.email))
       THEN 'admin'::app_role
       ELSE 'user'::app_role
  END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT (user_id, role) DO NOTHING;

-- 4e) 補 notification_settings
INSERT INTO public.notification_settings (user_id)
SELECT u.id
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.notification_settings ns WHERE ns.user_id = u.id);