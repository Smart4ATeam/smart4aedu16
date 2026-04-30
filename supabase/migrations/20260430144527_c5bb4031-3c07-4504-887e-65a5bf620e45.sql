ALTER TABLE public.task_applications DROP CONSTRAINT IF EXISTS task_applications_status_check;

ALTER TABLE public.task_applications
  ADD CONSTRAINT task_applications_status_check
  CHECK (status = ANY (ARRAY[
    'applied','accepted','approved','pending_completion','rejected',
    'completed','failed',
    'payment_pending_info','payment_pending_signature',
    'payment_pending_review','payment_processing','payment_completed'
  ]));

SELECT public.promote_pending_info_apps('9b036eda-69af-4078-b0a9-3a769c609d19'::uuid);