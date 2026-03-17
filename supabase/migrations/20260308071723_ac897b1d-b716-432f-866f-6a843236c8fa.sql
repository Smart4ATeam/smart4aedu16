
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'organization_id'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;
