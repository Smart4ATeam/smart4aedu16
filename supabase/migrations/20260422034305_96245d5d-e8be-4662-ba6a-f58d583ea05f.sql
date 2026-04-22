
-- Step 1: Patch handle_new_user with smarter display_name fallback
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
  resolved_name text;
BEGIN
  resolved_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    SPLIT_PART(NEW.email, '@', 1)
  );

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
      resolved_name,
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
        jsonb_build_object('email', NEW.email, 'display_name', resolved_name)
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

-- Step 3: Move SA24120021's 2 transactions to SA26030123, then delete duplicate
UPDATE public.reg_point_transactions
SET member_id = '1aef829d-2a2a-41d9-a3d8-23d5c3b524c7'
WHERE member_id = '13bfe30e-33d0-4efd-8a02-1dd68953ddc5';

INSERT INTO public.reg_operation_logs (entity_type, entity_id, action, reason, old_value)
VALUES (
  'reg_member',
  '13bfe30e-33d0-4efd-8a02-1dd68953ddc5',
  'delete_duplicate',
  'Email weilyyeh@weilyyeh.com 重複，合併到 SA26030123 葉威志',
  jsonb_build_object('member_no','SA24120021','name','威業國際企業有限公司','email','weilyyeh@weilyyeh.com')
);

DELETE FROM public.reg_members WHERE id = '13bfe30e-33d0-4efd-8a02-1dd68953ddc5';

-- Step 4: Backfill display_name for 4 Google OAuth victims
UPDATE public.profiles p
SET display_name = COALESCE(
  NULLIF(u.raw_user_meta_data->>'full_name',''),
  NULLIF(u.raw_user_meta_data->>'name',''),
  SPLIT_PART(u.email,'@',1)
), updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND LOWER(u.email) IN (
    'dolomite2004@gmail.com','poo19970403@gmail.com',
    'hankhuang@pantaiwan.com.tw','johnlee@pantaiwan.com.tw'
  )
  AND (p.display_name = u.email OR p.display_name IS NULL OR p.display_name = '');

-- Step 5: Auto-bind orphan reg_members to existing auth.users by email
WITH bind AS (
  SELECT m.id AS member_id, u.id AS uid, m.member_no, m.name
  FROM public.reg_members m
  JOIN auth.users u ON LOWER(u.email) = LOWER(m.email)
  WHERE m.user_id IS NULL
    AND m.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.reg_members m2
      WHERE m2.id <> m.id AND LOWER(m2.email) = LOWER(m.email) AND m2.user_id = u.id
    )
)
UPDATE public.reg_members m
SET user_id = b.uid
FROM bind b
WHERE m.id = b.member_id;

-- Sync profiles.student_id and display_name from newly bound members (where profile name == email)
UPDATE public.profiles p
SET student_id = m.member_no,
    display_name = CASE
      WHEN p.display_name = p.email OR p.display_name IS NULL OR p.display_name = ''
        THEN m.name
      ELSE p.display_name
    END,
    phone = COALESCE(p.phone, m.phone),
    updated_at = now()
FROM public.reg_members m
WHERE m.user_id = p.id
  AND (p.student_id IS NULL OR p.student_id <> m.member_no);
