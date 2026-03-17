
-- 1. Create admin_emails table
CREATE TABLE public.admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage admin_emails" ON public.admin_emails
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Add activated column to profiles
ALTER TABLE public.profiles ADD COLUMN activated boolean NOT NULL DEFAULT false;

-- 3. Update existing profiles to activated = true (they already have auth accounts)
UPDATE public.profiles SET activated = true;

-- 4. Replace handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_profile_id uuid;
  is_admin_email boolean;
BEGIN
  -- Check if a pre-built profile exists (from enroll-student)
  SELECT id INTO existing_profile_id
  FROM public.profiles
  WHERE email = NEW.email AND activated = false
  LIMIT 1;

  IF existing_profile_id IS NOT NULL THEN
    -- Update existing pre-built profile: bind to auth user
    UPDATE public.profiles
    SET id = NEW.id, activated = true, updated_at = now()
    WHERE id = existing_profile_id;
  ELSE
    -- No pre-built profile, create new one
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

  -- Check admin_emails table for auto admin role
  SELECT EXISTS(SELECT 1 FROM public.admin_emails WHERE email = NEW.email) INTO is_admin_email;

  IF is_admin_email THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Create notification settings
  INSERT INTO public.notification_settings (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. Create trigger if not exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
