-- 1. Trigger: when reg_members.user_id is set/updated, sync member_no → profiles.student_id
CREATE OR REPLACE FUNCTION public.sync_member_no_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When user_id is set or changed, sync member_no to profiles.student_id
  IF NEW.user_id IS NOT NULL AND (
    OLD.user_id IS DISTINCT FROM NEW.user_id
    OR OLD.member_no IS DISTINCT FROM NEW.member_no
  ) THEN
    UPDATE public.profiles
    SET student_id = NEW.member_no
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_member_no_to_profile
AFTER INSERT OR UPDATE OF user_id, member_no
ON public.reg_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_member_no_to_profile();

-- 2. Fix existing out-of-sync data
UPDATE public.profiles p
SET student_id = rm.member_no
FROM public.reg_members rm
WHERE rm.user_id = p.id
  AND rm.user_id IS NOT NULL
  AND (p.student_id IS NULL OR p.student_id != rm.member_no);