
CREATE OR REPLACE FUNCTION public.on_task_application_approved_reject_others()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When an application is approved, reject all other non-completed applications for the same task
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    UPDATE public.task_applications
    SET status = 'rejected',
        reject_reason = '該任務已由其他人接案'
    WHERE task_id = NEW.task_id
      AND id <> NEW.id
      AND status IN ('applied', 'pending_completion');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reject_others_on_approve
  AFTER UPDATE ON public.task_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.on_task_application_approved_reject_others();
