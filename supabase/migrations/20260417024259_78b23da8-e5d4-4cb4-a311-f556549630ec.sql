-- 將 session_date 已過、狀態仍為 enrolled 的報名自動標記為 completed
-- session_date 格式： "YYYY/MM/DD" 或 "YYYY/MM/DD-MM/DD"，取第一段比對
UPDATE public.reg_enrollments
SET status = 'completed'
WHERE status = 'enrolled'
  AND session_date IS NOT NULL
  AND to_date(replace(split_part(session_date, '-', 1), '/', '-'), 'YYYY-MM-DD') <= CURRENT_DATE;