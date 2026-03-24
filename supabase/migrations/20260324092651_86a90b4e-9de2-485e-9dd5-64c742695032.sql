-- Insert 2026 sessions for all 4 main courses (data insert via migration)

-- 問道求索 AI (Quest/入門) - monthly single-day sessions
INSERT INTO public.course_sessions (course_id, title_suffix, start_date, end_date, status, schedule_type, registration_url) VALUES
('c0000000-0000-0000-0000-000000000001', '2026年4月班', '2026-04-16', '2026-04-16', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000001', '2026年5月班', '2026-05-07', '2026-05-07', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000001', '2026年6月班', '2026-06-11', '2026-06-11', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000001', '2026年7月班', '2026-07-09', '2026-07-09', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000001', '2026年8月班', '2026-08-13', '2026-08-13', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000001', '2026年9月班', '2026-09-10', '2026-09-10', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000001', '2026年10月班', '2026-10-15', '2026-10-15', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000001', '2026年11月班', '2026-11-12', '2026-11-12', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000001', '2026年12月班', '2026-12-17', '2026-12-17', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),

-- 工作流程 API (Basic/初階) - quarterly two-day sessions
('c0000000-0000-0000-0000-000000000002', '2026年5月班', '2026-05-09', '2026-05-10', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000002', '2026年7月班', '2026-07-11', '2026-07-12', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000002', '2026年9月班', '2026-09-12', '2026-09-13', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000002', '2026年11月班', '2026-11-14', '2026-11-15', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),

-- 思維流程 Analytics (Intermediate/中階) - quarterly two-day sessions
('c0000000-0000-0000-0000-000000000003', '2026年5月班', '2026-05-23', '2026-05-24', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000003', '2026年8月班', '2026-08-15', '2026-08-16', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000003', '2026年11月班', '2026-11-21', '2026-11-22', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),

-- 互動流程 Automation (Advanced/高階) - quarterly two-day sessions
('c0000000-0000-0000-0000-000000000004', '2026年6月班', '2026-06-13', '2026-06-14', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000004', '2026年9月班', '2026-09-19', '2026-09-20', 'open', 'recurring', 'https://dao.smart4a.tw/registration'),
('c0000000-0000-0000-0000-000000000004', '2026年12月班', '2026-12-12', '2026-12-13', 'open', 'recurring', 'https://dao.smart4a.tw/registration');
