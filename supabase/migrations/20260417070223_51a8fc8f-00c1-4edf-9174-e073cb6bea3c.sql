-- 移除舊排程（如有）
DO $$
BEGIN
  PERFORM cron.unschedule('task-daily-maintenance');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 每日 UTC 01:00（台灣 09:00）
SELECT cron.schedule(
  'task-daily-maintenance',
  '0 1 * * *',
  $$ SELECT public.run_task_daily_maintenance(); $$
);