
-- Seed: Tasks
INSERT INTO public.tasks (title, description, amount, tags, status, difficulty, deadline) VALUES
('AI 客服機器人建置', '使用 Dify 平台搭建智能客服系統，整合知識庫與多輪對話功能', 8500, ARRAY['Dify','RAG'], 'available', '中級', '2026-03-15'),
('自動化行銷流程設計', '透過 Make.com 串接 CRM、Email、社群平台，建立完整行銷自動化流程', 12000, ARRAY['Make.com','CRM'], 'available', '進階', '2026-03-20'),
('數據分析儀表板開發', '使用 Python + Streamlit 建立即時數據分析看板', 6000, ARRAY['Python','Streamlit'], 'available', '初級', '2026-03-25'),
('LINE Bot 智慧助理', '開發 LINE 聊天機器人，整合 OpenAI API 提供智慧回覆', 9500, ARRAY['LINE Bot','OpenAI'], 'available', '中級', '2026-03-18'),
('電商自動化訂單處理', '使用 Make.com + Notion 打造自動化訂單追蹤與通知系統', 7200, ARRAY['Make.com','Notion'], 'available', '初級', '2026-03-28');

-- Seed: Achievements
INSERT INTO public.achievements (name, description, category, icon) VALUES
('新手上路', '完成第一個學習課程', 'learning', '🎯'),
('流程達人', '完成 5 個自動化流程', 'automation', '⚡'),
('接案高手', '成功完成 3 個接案任務', 'task', '💼'),
('社群之星', '在社群中獲得 10 個讚', 'community', '⭐'),
('收益破萬', '累計收益超過 NT$10,000', 'revenue', '💰');

-- Seed: Learning Paths
INSERT INTO public.learning_paths (title, description, category, difficulty, total_steps, sort_order) VALUES
('Make.com 入門基礎', '從零開始學習 Make.com 自動化工具，掌握基本模組與流程設計', 'automation', '初級', 8, 1),
('Dify AI 應用開發', '學習使用 Dify 平台建立 AI 應用，包含 RAG、Agent 等進階功能', 'ai', '中級', 12, 2),
('接案實戰技巧', '從報價、溝通到交付，掌握完整的接案流程與技巧', 'business', '初級', 6, 3),
('AI Agent 進階實戰', '深入學習 AI Agent 架構設計與多模態應用開發', 'ai', '進階', 15, 4);

-- Seed: Resources (using allowed categories: plugins, extensions, templates, videos)
INSERT INTO public.resources (title, description, category, difficulty, author, version, installs, rating, is_hot, sort_order) VALUES
('Make.com 快速入門模板', '包含 10+ 常用自動化場景模板，一鍵匯入即可使用', 'templates', '初級', 'Smart4A 團隊', 'v2.1', 1250, 4.8, true, 1),
('Dify RAG 知識庫套件', '預設知識庫架構與最佳化配置，適用於客服與諮詢場景', 'plugins', '中級', 'AI Lab', 'v1.3', 860, 4.6, true, 2),
('LINE Bot 開發工具包', '完整的 LINE Bot 開發框架，含範例程式碼與部署指南', 'extensions', '中級', '開發者社群', 'v3.0', 2100, 4.9, false, 3),
('自動化流程設計指南', '深入解析 50+ 自動化場景的設計思路與最佳實踐', 'videos', '初級', 'Smart4A 團隊', 'v1.0', 3400, 4.7, false, 4);

-- Seed: Conversations & Messages for Zin Lee
DO $$
DECLARE
  v_user_id uuid := '9b036eda-69af-4078-b0a9-3a769c609d19';
  v_conv1 uuid;
  v_conv2 uuid;
  v_conv3 uuid;
BEGIN
  INSERT INTO conversations (title, category) VALUES ('系統通知', 'system') RETURNING id INTO v_conv1;
  INSERT INTO conversation_participants (conversation_id, user_id, unread) VALUES (v_conv1, v_user_id, true);
  INSERT INTO messages (conversation_id, content, is_system, sender_id) VALUES
    (v_conv1, '歡迎加入 Smart4A 學員俱樂部！您的帳號已成功啟用。', true, NULL),
    (v_conv1, '新任務已發布：AI 客服機器人建置，獎勵金額 NT$8,500，請前往任務中心查看。', true, NULL),
    (v_conv1, '新學習資源已上架：「Make.com 快速入門模板」，立即前往資源中心下載。', true, NULL);

  INSERT INTO conversations (title, category) VALUES ('Tech Corp 專案討論', 'client') RETURNING id INTO v_conv2;
  INSERT INTO conversation_participants (conversation_id, user_id, unread, starred) VALUES (v_conv2, v_user_id, true, true);
  INSERT INTO messages (conversation_id, content, is_system, sender_id) VALUES
    (v_conv2, '您好，我們對您完成的 Dify 聊天機器人整合非常滿意，希望能繼續合作下一個專案。', false, NULL),
    (v_conv2, '謝謝您的肯定！我很樂意繼續合作，請問下一個專案的需求是什麼呢？', false, v_user_id),
    (v_conv2, '我們需要一個 Make.com 的自動化流程，預算大約 NT$5,000，細節稍後發送。', false, NULL);

  INSERT INTO conversations (title, category) VALUES ('E-Shop 專案協作', 'team') RETURNING id INTO v_conv3;
  INSERT INTO conversation_participants (conversation_id, user_id, unread) VALUES (v_conv3, v_user_id, false);
  INSERT INTO messages (conversation_id, content, is_system, sender_id) VALUES
    (v_conv3, '嗨，E-Shop 專案的前端部分我已經完成了，你那邊的 API 整合進度如何？', false, NULL),
    (v_conv3, '我已經完成 80% 了，預計明天可以全部完成並進行測試。', false, v_user_id),
    (v_conv3, '太好了，那我們明天下午 2 點進行整合測試吧！', false, NULL);
END $$;

-- Seed: User learning progress
INSERT INTO public.user_learning_progress (user_id, learning_path_id, current_step, completed)
SELECT '9b036eda-69af-4078-b0a9-3a769c609d19', id, 5, false
FROM public.learning_paths WHERE title = 'Make.com 入門基礎';

INSERT INTO public.user_learning_progress (user_id, learning_path_id, current_step, completed)
SELECT '9b036eda-69af-4078-b0a9-3a769c609d19', id, 3, false
FROM public.learning_paths WHERE title = 'Dify AI 應用開發';

-- Seed: User achievements
INSERT INTO public.user_achievements (user_id, achievement_id)
SELECT '9b036eda-69af-4078-b0a9-3a769c609d19', id
FROM public.achievements WHERE name = '新手上路';

-- Seed: Revenue records
INSERT INTO public.revenue_records (user_id, amount, source, description) VALUES
('9b036eda-69af-4078-b0a9-3a769c609d19', 3500, 'task', 'WordPress 網站優化'),
('9b036eda-69af-4078-b0a9-3a769c609d19', 8500, 'task', 'Dify 聊天機器人整合'),
('9b036eda-69af-4078-b0a9-3a769c609d19', 5000, 'task', 'Make.com 自動化流程');

-- Update profile stats
UPDATE public.profiles
SET total_points = 320, total_badges = 1, learning_days = 14, total_revenue = 17000
WHERE id = '9b036eda-69af-4078-b0a9-3a769c609d19';
