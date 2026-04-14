
-- 1. Replace on_task_application_approved to insert into reg_point_transactions
CREATE OR REPLACE FUNCTION public.on_task_application_approved()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  task_amount numeric;
  _member_id uuid;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    SELECT amount INTO task_amount FROM public.tasks WHERE id = NEW.task_id;

    -- Update revenue on profiles (keep this)
    UPDATE public.profiles
    SET total_revenue = total_revenue + COALESCE(task_amount, 0)
    WHERE id = NEW.user_id;

    -- Insert point transaction into reg_point_transactions (if member exists)
    SELECT id INTO _member_id FROM public.reg_members WHERE user_id = NEW.user_id LIMIT 1;
    IF _member_id IS NOT NULL AND COALESCE(task_amount, 0) > 0 THEN
      INSERT INTO public.reg_point_transactions (member_id, points_delta, type, description)
      VALUES (_member_id, COALESCE(task_amount, 0)::int, 'earned', '任務獎勵');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Replace on_quiz_passed to insert into reg_point_transactions
CREATE OR REPLACE FUNCTION public.on_quiz_passed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _member_id uuid;
BEGIN
  IF NEW.passed = true THEN
    SELECT id INTO _member_id FROM public.reg_members WHERE user_id = NEW.user_id LIMIT 1;
    IF _member_id IS NOT NULL THEN
      INSERT INTO public.reg_point_transactions (member_id, points_delta, type, description)
      VALUES (_member_id, 20, 'earned', '測驗通過獎勵');
    END IF;
    PERFORM check_and_grant_achievements(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Replace on_attendance_recorded to insert into reg_point_transactions
CREATE OR REPLACE FUNCTION public.on_attendance_recorded()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _member_id uuid;
BEGIN
  IF NEW.attended = true THEN
    SELECT user_id INTO _user_id FROM public.course_enrollments WHERE id = NEW.enrollment_id;
    IF _user_id IS NOT NULL THEN
      SELECT id INTO _member_id FROM public.reg_members WHERE user_id = _user_id LIMIT 1;
      IF _member_id IS NOT NULL THEN
        INSERT INTO public.reg_point_transactions (member_id, points_delta, type, description)
        VALUES (_member_id, 10, 'earned', '出席獎勵');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Update check_and_grant_achievements to read from reg_members.points
CREATE OR REPLACE FUNCTION public.check_and_grant_achievements(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p record;
  task_count int;
  member_pts int;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id;
  SELECT COUNT(*) INTO task_count FROM public.task_applications WHERE user_id = _user_id AND status = 'approved';

  -- Get points from reg_members
  SELECT COALESCE(points, 0) INTO member_pts FROM public.reg_members WHERE user_id = _user_id;

  -- First task completed
  IF task_count >= 1 THEN
    INSERT INTO public.user_achievements (user_id, achievement_id)
    SELECT _user_id, id FROM public.achievements WHERE name = '首次接案'
    ON CONFLICT DO NOTHING;
  END IF;

  -- 100 points (from reg_members)
  IF COALESCE(member_pts, 0) >= 100 THEN
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
$function$;
