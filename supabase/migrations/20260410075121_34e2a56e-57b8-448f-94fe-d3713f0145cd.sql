
CREATE OR REPLACE FUNCTION public.on_enrollment_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only fire when status changes TO 'cancelled' and points were awarded
  IF NEW.status = 'cancelled'
     AND (OLD.status IS DISTINCT FROM 'cancelled')
     AND NEW.points_awarded > 0
     AND NEW.member_id IS NOT NULL
  THEN
    -- Insert a negative point transaction
    INSERT INTO public.reg_point_transactions (member_id, points_delta, type, description)
    VALUES (
      NEW.member_id,
      -NEW.points_awarded,
      'adjusted',
      '課程取消扣回點數'
    );

    -- The existing sync_member_points trigger on reg_point_transactions
    -- will automatically update reg_members.points
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enrollment_cancelled
  AFTER UPDATE ON public.reg_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.on_enrollment_cancelled();
