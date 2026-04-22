-- 1. Rewrite handle_new_user() to BLOCK unmatched OAuth signups
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
  ELSIF is_admin_email THEN
    -- Admin email: allow signup, create activated profile
    INSERT INTO public.profiles (id, display_name, email, activated)
    VALUES (NEW.id, resolved_name, NEW.email, true)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    -- BLOCK: unmatched signup (no reg_member, no prebuilt profile, not admin)
    -- This raises an exception which causes auth.users insert to rollback.
    RAISE EXCEPTION '此 Email (%) 沒有對應的報名資料，無法註冊。請先完成課程報名，或使用「啟用帳號」流程驗證學員編號。', NEW.email
      USING ERRCODE = 'check_violation';
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

-- 2. Delete 4 victim Google accounts (no associated data)
-- Cascade will clean up profiles, user_roles, notification_settings via FK from auth.users
DELETE FROM public.notification_settings WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'poo19970403@gmail.com',
    'dolomite2004@gmail.com',
    'hankhuang@pantaiwan.com.tw',
    'johnlee@pantaiwan.com.tw'
  )
);

DELETE FROM public.user_roles WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN (
    'poo19970403@gmail.com',
    'dolomite2004@gmail.com',
    'hankhuang@pantaiwan.com.tw',
    'johnlee@pantaiwan.com.tw'
  )
);

DELETE FROM public.profiles WHERE id IN (
  SELECT id FROM auth.users WHERE email IN (
    'poo19970403@gmail.com',
    'dolomite2004@gmail.com',
    'hankhuang@pantaiwan.com.tw',
    'johnlee@pantaiwan.com.tw'
  )
);

DELETE FROM auth.users WHERE email IN (
  'poo19970403@gmail.com',
  'dolomite2004@gmail.com',
  'hankhuang@pantaiwan.com.tw',
  'johnlee@pantaiwan.com.tw'
);