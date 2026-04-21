ALTER TABLE public.task_applications DROP CONSTRAINT IF EXISTS task_applications_status_check;
ALTER TABLE public.task_applications ADD CONSTRAINT task_applications_status_check
  CHECK (status = ANY (ARRAY['applied','accepted','approved','pending_completion','rejected','completed','failed']));