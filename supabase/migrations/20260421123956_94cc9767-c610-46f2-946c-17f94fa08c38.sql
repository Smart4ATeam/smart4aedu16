
-- 1) 修正完成觸發器：金額不再寫進積分；reward_points 改寫進 task_points
CREATE OR REPLACE FUNCTION public.on_task_application_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task RECORD;
  v_amount numeric;
  v_member_id uuid;
  v_user_email text;
  v_reward_points integer;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
    v_amount := COALESCE(NEW.final_amount, NEW.quoted_amount, v_task.amount, 0);
    v_reward_points := COALESCE(v_task.reward_points, 0);

    SELECT id INTO v_member_id FROM public.reg_members WHERE user_id = NEW.user_id LIMIT 1;
    IF v_member_id IS NULL THEN
      SELECT email INTO v_user_email FROM public.profiles WHERE id = NEW.user_id;
      IF v_user_email IS NOT NULL THEN
        SELECT id INTO v_member_id FROM public.reg_members WHERE email = v_user_email LIMIT 1;
      END IF;
    END IF;

    -- 金額：只進收益，不再寫進積分交易
    IF v_amount > 0 THEN
      INSERT INTO public.revenue_records (user_id, amount, source, description)
      VALUES (NEW.user_id, v_amount, 'task', '任務完成獎勵：' || COALESCE(v_task.title, ''));

      UPDATE public.profiles
        SET total_revenue = COALESCE(total_revenue, 0) + v_amount
        WHERE id = NEW.user_id;
    END IF;

    -- 積分（task_points）獎勵
    IF v_reward_points > 0 AND v_member_id IS NOT NULL THEN
      INSERT INTO public.reg_point_transactions (member_id, points_delta, type, category, description)
      VALUES (v_member_id, v_reward_points, '任務完成', 'task_points', '任務完成積分獎勵：' || COALESCE(v_task.title, ''));
    END IF;

    NEW.completed_at := now();
    PERFORM public.check_and_grant_achievements(NEW.user_id);
  END IF;

  IF NEW.status = 'failed' AND (OLD.status IS DISTINCT FROM 'failed') THEN
    NEW.failed_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

-- 2) 修正狀態變更通知：completed 改顯示「積分 X 分」
CREATE OR REPLACE FUNCTION public.on_task_application_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _task_title text;
  _reward_points integer;
  _msg text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT title, COALESCE(reward_points, 0)
      INTO _task_title, _reward_points
      FROM public.tasks WHERE id = NEW.task_id;

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
              CASE WHEN COALESCE(_reward_points, 0) > 0
                   THEN E'\n獲得積分：' || _reward_points::text || ' 分'
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
$function$;

-- 3) 修正既有錯誤資料
-- 3a) 刪除「任務完成積分：xxx」這種誤寫成 task_points 的金額交易（會由 trigger 自動扣回 reg_members.task_points）
DELETE FROM public.reg_point_transactions
WHERE category = 'task_points'
  AND type = '任務完成'
  AND description LIKE '任務完成積分：%';

-- 3b) 把先前以 points 寫入的「任務完成積分獎勵：xxx」改為 task_points
--     觸發器是 INSERT/DELETE 才更新 reg_members，UPDATE category 不會自動同步，
--     所以下面手動同步餘額。
WITH moved AS (
  SELECT member_id, SUM(points_delta)::int AS delta
  FROM public.reg_point_transactions
  WHERE category = 'points'
    AND description LIKE '任務完成積分獎勵：%'
  GROUP BY member_id
)
UPDATE public.reg_members m
SET points      = COALESCE(m.points, 0) - moved.delta,
    task_points = COALESCE(m.task_points, 0) + moved.delta
FROM moved
WHERE m.id = moved.member_id;

UPDATE public.reg_point_transactions
SET category = 'task_points'
WHERE category = 'points'
  AND description LIKE '任務完成積分獎勵：%';
