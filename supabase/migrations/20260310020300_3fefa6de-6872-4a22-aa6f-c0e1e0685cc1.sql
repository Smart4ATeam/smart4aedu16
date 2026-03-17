
-- ============================================
-- 1. Fix RESTRICTIVE policies to PERMISSIVE
-- ============================================

-- === profiles ===
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- === user_roles ===
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- === user_learning_progress ===
DROP POLICY IF EXISTS "Admins can view all learning progress" ON public.user_learning_progress;
DROP POLICY IF EXISTS "Users can view own progress" ON public.user_learning_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON public.user_learning_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON public.user_learning_progress;

CREATE POLICY "Admins can view all learning progress" ON public.user_learning_progress FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own progress" ON public.user_learning_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress" ON public.user_learning_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress" ON public.user_learning_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- === login_tracks ===
DROP POLICY IF EXISTS "Admins can view all login tracks" ON public.login_tracks;
DROP POLICY IF EXISTS "Users can view own login tracks" ON public.login_tracks;
DROP POLICY IF EXISTS "Users can insert own login track" ON public.login_tracks;

CREATE POLICY "Admins can view all login tracks" ON public.login_tracks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own login tracks" ON public.login_tracks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own login track" ON public.login_tracks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. Create admin_set_user_role function
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_target_user_id uuid, _new_role app_role)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Check caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Permission denied: caller is not an admin';
  END IF;

  -- Prevent admin from demoting themselves
  IF _target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  -- Atomic delete + insert
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_target_user_id, _new_role);
END;
$$;
