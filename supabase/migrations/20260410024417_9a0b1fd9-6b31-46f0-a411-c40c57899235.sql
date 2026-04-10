CREATE OR REPLACE FUNCTION public.on_achievement_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.profiles
  SET total_badges = (SELECT COUNT(*) FROM public.user_achievements WHERE user_id = OLD.user_id)
  WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_achievement_removed
AFTER DELETE ON public.user_achievements
FOR EACH ROW EXECUTE FUNCTION public.on_achievement_removed();