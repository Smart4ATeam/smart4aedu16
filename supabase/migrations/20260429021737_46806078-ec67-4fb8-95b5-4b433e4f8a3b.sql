
-- 函式：當有人申請任務時，通知所有 admin
CREATE OR REPLACE FUNCTION public.on_task_application_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _task_title text;
  _applicant_name text;
  _admin record;
  _msg text;
  _quoted text := '';
  _note text := '';
BEGIN
  SELECT title INTO _task_title FROM public.tasks WHERE id = NEW.task_id;
  SELECT COALESCE(NULLIF(display_name, ''), email, '未知學員') INTO _applicant_name
    FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.quoted_amount IS NOT NULL THEN
    _quoted := E'\n申請報價：NT$ ' || NEW.quoted_amount::text;
  END IF;
  IF NEW.applied_note IS NOT NULL AND NEW.applied_note <> '' THEN
    _note := E'\n留言：' || NEW.applied_note;
  END IF;

  _msg := '📥 學員「' || COALESCE(_applicant_name, '未知') ||
          '」申請了任務「' || COALESCE(_task_title, '') || '」' ||
          _quoted || _note ||
          E'\n\n請至「任務管理」審核。';

  FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.send_system_message(_admin.user_id, '任務新申請', _msg, 'task');
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_application_created ON public.task_applications;
CREATE TRIGGER trg_task_application_created
  AFTER INSERT ON public.task_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.on_task_application_created();
