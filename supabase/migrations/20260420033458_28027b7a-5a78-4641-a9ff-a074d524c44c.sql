CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  existing_profile_id uuid;
  is_admin_email boolean;
  has_prebuilt_profile boolean;
  reg_member_row public.reg_members%ROWTYPE;
  has_reg_member boolean;
BEGIN
  -- Pre-built profile (admin enrolled)
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email AND activated = false
  LIMIT 1;
  has_prebuilt_profile := existing_profile_id IS NOT NULL;

  -- Admin email
  SELECT EXISTS(SELECT 1 FROM public.admin_emails WHERE email = NEW.email) INTO is_admin_email;

  -- Registered (paid) member without bound user
  SELECT * INTO reg_member_row
  FROM public.reg_members
  WHERE email = NEW.email AND user_id IS NULL
  LIMIT 1;
  has_reg_member := reg_member_row.id IS NOT NULL;

  -- Block signup unless any source allows it
  IF NOT is_admin_email AND NOT has_prebuilt_profile AND NOT has_reg_member THEN
    RAISE EXCEPTION 'Registration is not allowed for this email address.';
  END IF;

  IF has_prebuilt_profile THEN
    UPDATE public.profiles
    SET id = NEW.id, activated = true, updated_at = now()
    WHERE id = existing_profile_id;
  ELSIF has_reg_member THEN
    -- Create profile from reg_members data
    INSERT INTO public.profiles (id, display_name, email, student_id, activated)
    VALUES (NEW.id, reg_member_row.name, NEW.email, reg_member_row.member_no, true)
    ON CONFLICT (id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          email = EXCLUDED.email,
          student_id = EXCLUDED.student_id,
          activated = true,
          updated_at = now();

    -- Bind reg_member to this new user
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
    );
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