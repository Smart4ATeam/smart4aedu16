
-- Add reward_points column to course_quizzes
ALTER TABLE public.course_quizzes
ADD COLUMN reward_points integer NOT NULL DEFAULT 20;

-- Update on_quiz_passed to read reward_points from course_quizzes
CREATE OR REPLACE FUNCTION public.on_quiz_passed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _member_id uuid;
  _reward integer;
BEGIN
  IF NEW.passed = true THEN
    -- Read reward_points from the quiz definition
    SELECT COALESCE(reward_points, 20) INTO _reward
    FROM public.course_quizzes WHERE id = NEW.quiz_id;

    IF _reward > 0 THEN
      SELECT id INTO _member_id FROM public.reg_members WHERE user_id = NEW.user_id LIMIT 1;
      IF _member_id IS NOT NULL THEN
        INSERT INTO public.reg_point_transactions (member_id, points_delta, type, description)
        VALUES (_member_id, _reward, 'earned', '測驗通過獎勵');
      END IF;
    END IF;

    PERFORM check_and_grant_achievements(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;
