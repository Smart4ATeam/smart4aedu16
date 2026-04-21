
-- A. Trigger: reg_members → profiles
CREATE OR REPLACE FUNCTION public.sync_member_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND (
    OLD.name IS DISTINCT FROM NEW.name
    OR OLD.phone IS DISTINCT FROM NEW.phone
    OR OLD.email IS DISTINCT FROM NEW.email
  ) THEN
    UPDATE public.profiles
    SET
      display_name = COALESCE(NULLIF(NEW.name, ''), display_name),
      phone = COALESCE(NEW.phone, phone),
      email = COALESCE(NEW.email, email),
      updated_at = now()
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_to_profile ON public.reg_members;
CREATE TRIGGER trg_sync_member_to_profile
AFTER UPDATE ON public.reg_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_to_profile();

-- B. Trigger: profiles → reg_members (only name & phone, not email)
CREATE OR REPLACE FUNCTION public.sync_profile_to_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.display_name IS DISTINCT FROM NEW.display_name
      OR OLD.phone IS DISTINCT FROM NEW.phone) THEN
    UPDATE public.reg_members
    SET
      name = COALESCE(NULLIF(NEW.display_name, ''), name),
      phone = COALESCE(NEW.phone, phone)
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_member ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_member
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_member();

-- C. Modify handle_new_user: do not block unmatched signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_profile_id uuid;
  is_admin_email boolean;
  has_prebuilt_profile boolean;
  reg_member_row public.reg_members%ROWTYPE;
  has_reg_member boolean;
BEGIN
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email AND activated = false
  LIMIT 1;
  has_prebuilt_profile := existing_profile_id IS NOT NULL;

  SELECT EXISTS(SELECT 1 FROM public.admin_emails WHERE email = NEW.email) INTO is_admin_email;

  SELECT * INTO reg_member_row
  FROM public.reg_members
  WHERE email = NEW.email AND user_id IS NULL
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
    -- No matching reg_member: still allow signup, log as unmatched for manual binding
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
$$;

-- D. One-time backfill: push reg_members data into profiles
UPDATE public.profiles p SET
  display_name = COALESCE(NULLIF(m.name, ''), p.display_name),
  phone = COALESCE(m.phone, p.phone),
  email = COALESCE(m.email, p.email),
  updated_at = now()
FROM public.reg_members m
WHERE m.user_id = p.id;
