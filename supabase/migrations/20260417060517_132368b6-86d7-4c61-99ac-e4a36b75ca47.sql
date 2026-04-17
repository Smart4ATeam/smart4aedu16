-- ============================================
-- 1. tasks 表：加金額範圍、類別、內部備註
-- ============================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS amount_min numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_max numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS admin_notes text NOT NULL DEFAULT '';

-- 把舊有的 amount 同步到 amount_min/max（讓既有資料不壞）
UPDATE public.tasks
  SET amount_min = amount, amount_max = amount
  WHERE amount_min = 0 AND amount_max = 0 AND amount > 0;

-- 統一難度用語（初階/中階/高階 → 初級/中級/高級）
UPDATE public.tasks SET difficulty = '初級' WHERE difficulty = '初階';
UPDATE public.tasks SET difficulty = '中級' WHERE difficulty IN ('中階', '中等');
UPDATE public.tasks SET difficulty = '高級' WHERE difficulty IN ('高階', '進階');

-- ============================================
-- 2. task_applications 表：加報價、最終金額、交付物、失敗、備註
-- ============================================
ALTER TABLE public.task_applications
  ADD COLUMN IF NOT EXISTS quoted_amount numeric,
  ADD COLUMN IF NOT EXISTS final_amount numeric,
  ADD COLUMN IF NOT EXISTS deliverable_url text,
  ADD COLUMN IF NOT EXISTS deliverable_note text,
  ADD COLUMN IF NOT EXISTS failed_reason text,
  ADD COLUMN IF NOT EXISTS admin_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS failed_at timestamp with time zone;

-- ============================================
-- 3. 學員戰績函式
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_task_stats(_user_id uuid)
RETURNS TABLE(
  total_applications bigint,
  completed_count bigint,
  failed_count bigint,
  in_progress_count bigint,
  success_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total_applications,
    COUNT(*) FILTER (WHERE status = 'completed')::bigint AS completed_count,
    COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
    COUNT(*) FILTER (WHERE status IN ('approved', 'pending_completion'))::bigint AS in_progress_count,
    CASE
      WHEN COUNT(*) FILTER (WHERE status IN ('completed', 'failed')) = 0 THEN 0
      ELSE ROUND(
        COUNT(*) FILTER (WHERE status = 'completed')::numeric * 100
        / NULLIF(COUNT(*) FILTER (WHERE status IN ('completed', 'failed')), 0),
        1
      )
    END AS success_rate
  FROM public.task_applications
  WHERE user_id = _user_id;
$$;

-- ============================================
-- 4. 系統訊息工具：發訊息給單一使用者
-- ============================================
CREATE OR REPLACE FUNCTION public.send_system_message(_user_id uuid, _title text, _content text, _category text DEFAULT 'system')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conv_id uuid;
BEGIN
  INSERT INTO public.conversations (title, category)
  VALUES (_title, _category)
  RETURNING id INTO _conv_id;

  INSERT INTO public.messages (conversation_id, content, is_system)
  VALUES (_conv_id, _content, true);

  INSERT INTO public.conversation_participants (conversation_id, user_id, unread)
  VALUES (_conv_id, _user_id, true);

  RETURN _conv_id;
END;
$$;

-- ============================================
-- 5. 申請狀態變更 → 自動發系統訊息
-- ============================================
CREATE OR REPLACE FUNCTION public.on_task_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _task_title text;
  _msg text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT title INTO _task_title FROM public.tasks WHERE id = NEW.task_id;

    IF NEW.status = 'approved' THEN
      _msg := '🎉 您申請的任務「' || COALESCE(_task_title, '') || '」已通過審核，可以開始進行了！';
      PERFORM public.send_system_message(NEW.user_id, '任務通過審核', _msg, 'task');
    ELSIF NEW.status = 'rejected' THEN
      _msg := '您申請的任務「' || COALESCE(_task_title, '') || '」未通過審核。' ||
              CASE WHEN NEW.reject_reason IS NOT NULL AND NEW.reject_reason <> ''
                   THEN E'\n原因：' || NEW.reject_reason ELSE '' END;
      PERFORM public.send_system_message(NEW.user_id, '任務申請結果', _msg, 'task');
    ELSIF NEW.status = 'completed' THEN
      _msg := '✅ 任務「' || COALESCE(_task_title, '') || '」已確認完成！' ||
              CASE WHEN NEW.final_amount IS NOT NULL
                   THEN E'\n獲得獎勵：' || NEW.final_amount::text || ' 點'
                   WHEN NEW.quoted_amount IS NOT NULL
                   THEN E'\n獲得獎勵：' || NEW.quoted_amount::text || ' 點'
                   ELSE '' END;
      PERFORM public.send_system_message(NEW.user_id, '任務完成', _msg, 'task');
    ELSIF NEW.status = 'failed' THEN
      _msg := '❌ 任務「' || COALESCE(_task_title, '') || '」已被標記為失敗。' ||
              CASE WHEN NEW.failed_reason IS NOT NULL AND NEW.failed_reason <> ''
                   THEN E'\n原因：' || NEW.failed_reason ELSE '' END;
      PERFORM public.send_system_message(NEW.user_id, '任務失敗', _msg, 'task');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_application_status_change ON public.task_applications;
CREATE TRIGGER trg_task_application_status_change
AFTER UPDATE ON public.task_applications
FOR EACH ROW
EXECUTE FUNCTION public.on_task_application_status_change();

-- ============================================
-- 6. 任務完成 → 撥點 + 寫 revenue_records
-- 取代舊的 on_task_application_approved（改為 completed 才撥）
-- ============================================
CREATE OR REPLACE FUNCTION public.on_task_application_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _amount numeric;
  _task_amount numeric;
  _member_id uuid;
  _task_title text;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    SELECT amount, title INTO _task_amount, _task_title FROM public.tasks WHERE id = NEW.task_id;

    -- 金額優先順序：final_amount > quoted_amount > tasks.amount
    _amount := COALESCE(NEW.final_amount, NEW.quoted_amount, _task_amount, 0);

    IF _amount > 0 THEN
      -- 寫 revenue_records
      INSERT INTO public.revenue_records (user_id, amount, source, description)
      VALUES (NEW.user_id, _amount, 'task', '任務完成獎勵：' || COALESCE(_task_title, ''));

      -- 更新 profiles.total_revenue
      UPDATE public.profiles
      SET total_revenue = COALESCE(total_revenue, 0) + _amount
      WHERE id = NEW.user_id;

      -- 撥點到 reg_members
      SELECT id INTO _member_id FROM public.reg_members WHERE user_id = NEW.user_id LIMIT 1;
      IF _member_id IS NOT NULL THEN
        INSERT INTO public.reg_point_transactions (member_id, points_delta, type, description)
        VALUES (_member_id, _amount::int, 'earned', '任務完成獎勵：' || COALESCE(_task_title, ''));
      END IF;
    END IF;

    -- completed_at
    NEW.completed_at := now();
  END IF;

  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status <> 'failed') THEN
    NEW.failed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_application_completed ON public.task_applications;
CREATE TRIGGER trg_task_application_completed
BEFORE UPDATE ON public.task_applications
FOR EACH ROW
EXECUTE FUNCTION public.on_task_application_completed();

-- 移除舊的 approved 撥點 trigger（避免重複撥點）
DROP TRIGGER IF EXISTS trg_task_application_approved ON public.task_applications;

-- ============================================
-- 7. 過期關閉 + 即將到期通知（合併在一個 RPC，每日由 cron 呼叫）
-- ============================================
CREATE OR REPLACE FUNCTION public.run_task_daily_maintenance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _closed_count int := 0;
  _expiring_no_applicant_count int := 0;
  _expiring_in_progress_count int := 0;
  _admin record;
  _task record;
  _msg text;
  _no_applicant_list text := '';
  _in_progress_list text := '';
BEGIN
  -- 1) 關閉過期且仍 available 的任務
  WITH closed AS (
    UPDATE public.tasks
    SET status = 'closed', updated_at = now()
    WHERE status = 'available'
      AND deadline IS NOT NULL
      AND deadline < CURRENT_DATE
    RETURNING id
  )
  SELECT COUNT(*) INTO _closed_count FROM closed;

  -- 2) 統整 3 天內到期且無人申請（仍 available）
  FOR _task IN
    SELECT t.id, t.title, t.deadline
    FROM public.tasks t
    WHERE t.status = 'available'
      AND t.deadline IS NOT NULL
      AND t.deadline >= CURRENT_DATE
      AND t.deadline <= CURRENT_DATE + INTERVAL '3 days'
      AND NOT EXISTS (SELECT 1 FROM public.task_applications a WHERE a.task_id = t.id)
  LOOP
    _no_applicant_list := _no_applicant_list || '• ' || _task.title || '（' || _task.deadline::text || '）' || E'\n';
    _expiring_no_applicant_count := _expiring_no_applicant_count + 1;
  END LOOP;

  -- 3) 統整 1 天內到期且仍卡在審核中/進行中
  FOR _task IN
    SELECT DISTINCT t.id, t.title, t.deadline
    FROM public.tasks t
    JOIN public.task_applications a ON a.task_id = t.id
    WHERE t.deadline IS NOT NULL
      AND t.deadline >= CURRENT_DATE
      AND t.deadline <= CURRENT_DATE + INTERVAL '1 day'
      AND a.status IN ('applied', 'approved', 'pending_completion')
  LOOP
    _in_progress_list := _in_progress_list || '• ' || _task.title || '（' || _task.deadline::text || '）' || E'\n';
    _expiring_in_progress_count := _expiring_in_progress_count + 1;
  END LOOP;

  -- 4) 發匯整通知給所有 admin（一次一封）
  IF _expiring_no_applicant_count > 0 OR _expiring_in_progress_count > 0 OR _closed_count > 0 THEN
    _msg := '📋 任務中心每日提醒' || E'\n\n';
    IF _closed_count > 0 THEN
      _msg := _msg || '🔒 已自動關閉 ' || _closed_count || ' 個過期任務' || E'\n\n';
    END IF;
    IF _expiring_no_applicant_count > 0 THEN
      _msg := _msg || '⏰ ' || _expiring_no_applicant_count || ' 個任務 3 天內到期，目前無人申請：' || E'\n' || _no_applicant_list || E'\n';
    END IF;
    IF _expiring_in_progress_count > 0 THEN
      _msg := _msg || '⚠️ ' || _expiring_in_progress_count || ' 個任務即將到期，仍有未處理申請：' || E'\n' || _in_progress_list;
    END IF;

    FOR _admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      PERFORM public.send_system_message(_admin.user_id, '任務中心每日提醒', _msg, 'task');
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'closed', _closed_count,
    'expiring_no_applicant', _expiring_no_applicant_count,
    'expiring_in_progress', _expiring_in_progress_count
  );
END;
$$;

-- ============================================
-- 8. 啟用 cron 與 net 擴充（後續排程使用）
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;