-- 1. Add status column to resources for review workflow
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create login tracking table
CREATE TABLE IF NOT EXISTS public.login_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  login_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, login_date)
);
ALTER TABLE public.login_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own login track"
ON public.login_tracks FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own login tracks"
ON public.login_tracks FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all login tracks"
ON public.login_tracks FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- 3. Trigger: when task_application approved → add points to profile
CREATE OR REPLACE FUNCTION public.on_task_application_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_amount numeric;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    SELECT amount INTO task_amount FROM public.tasks WHERE id = NEW.task_id;
    UPDATE public.profiles
    SET total_points = total_points + COALESCE(task_amount, 0)::int,
        total_revenue = total_revenue + COALESCE(task_amount, 0)
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_application_approved
AFTER UPDATE ON public.task_applications
FOR EACH ROW EXECUTE FUNCTION public.on_task_application_approved();

-- 4. Trigger: when login_tracks inserted → update learning_days
CREATE OR REPLACE FUNCTION public.on_login_track_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET learning_days = (SELECT COUNT(*) FROM public.login_tracks WHERE user_id = NEW.user_id)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_login_track_inserted
AFTER INSERT ON public.login_tracks
FOR EACH ROW EXECUTE FUNCTION public.on_login_track_inserted();

-- 5. Trigger: when user_achievements inserted → update total_badges
CREATE OR REPLACE FUNCTION public.on_achievement_earned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET total_badges = (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = NEW.user_id)
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_achievement_earned
AFTER INSERT ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public.on_achievement_earned();

-- 6. Function to check and auto-grant achievements
CREATE OR REPLACE FUNCTION public.check_and_grant_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
  task_count int;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id;
  SELECT COUNT(*) INTO task_count FROM public.task_applications WHERE user_id = _user_id AND status = 'approved';
  
  -- First task completed
  IF task_count >= 1 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT _user_id, id FROM public.achievements WHERE name = '首次接案'
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- 100 points
  IF p.total_points >= 100 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT _user_id, id FROM public.achievements WHERE name = '百分先鋒'
    ON CONFLICT DO NOTHING;
  END IF;

  -- 7 day streak
  IF p.learning_days >= 7 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT _user_id, id FROM public.achievements WHERE name = '學習達人'
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- 7. Allow users to insert resources (for submission)
CREATE POLICY "Users can submit resources"
ON public.resources FOR INSERT TO authenticated
WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

-- 8. Add unique constraint on user_achievements for ON CONFLICT
ALTER TABLE public.user_achievements ADD CONSTRAINT user_achievements_user_achievement_unique UNIQUE (user_id, achievement_id);