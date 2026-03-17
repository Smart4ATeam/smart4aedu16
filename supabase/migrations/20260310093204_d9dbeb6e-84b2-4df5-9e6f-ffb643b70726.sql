
CREATE OR REPLACE FUNCTION public.get_task_application_counts()
RETURNS TABLE(task_id uuid, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT task_id, COUNT(*) as count
  FROM public.task_applications
  GROUP BY task_id
$$;
