-- 修正版：completed trigger 同時設 completed_at/failed_at，並寫到 task_points
CREATE OR REPLACE FUNCTION public.on_task_application_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_amount numeric;
  v_member_id uuid;
  v_user_email text;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
    v_amount := COALESCE(NEW.final_amount, NEW.quoted_amount, v_task.amount, 0);

    IF v_amount > 0 THEN
      INSERT INTO public.revenue_records (user_id, amount, source, description)
      VALUES (NEW.user_id, v_amount, 'task', '任務完成獎勵：' || COALESCE(v_task.title, ''));

      UPDATE public.profiles
        SET total_revenue = COALESCE(total_revenue, 0) + v_amount
        WHERE id = NEW.user_id;

      SELECT id INTO v_member_id FROM public.reg_members WHERE user_id = NEW.user_id LIMIT 1;
      IF v_member_id IS NULL THEN
        SELECT email INTO v_user_email FROM public.profiles WHERE id = NEW.user_id;
        IF v_user_email IS NOT NULL THEN
          SELECT id INTO v_member_id FROM public.reg_members WHERE email = v_user_email LIMIT 1;
        END IF;
      END IF;

      IF v_member_id IS NOT NULL THEN
        INSERT INTO public.reg_point_transactions (member_id, points_delta, type, category, description)
        VALUES (v_member_id, v_amount::int, '任務完成', 'task_points', '任務完成積分：' || COALESCE(v_task.title, ''));
      END IF;
    END IF;

    NEW.completed_at := now();
  END IF;

  IF NEW.status = 'failed' AND (OLD.status IS DISTINCT FROM 'failed') THEN
    NEW.failed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- approved trigger：移除加 revenue / 加點邏輯，避免與 completed 重複
CREATE OR REPLACE FUNCTION public.on_task_application_approved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 不再於 approved 階段加 revenue 或撥點，改在 completed 才結算
  RETURN NEW;
END;
$$;

-- 既有的 sync_member_points 會把整個 SUM 蓋回 reg_members.points
-- 與新的 sync_member_points_from_tx 衝突，需移除舊的 trigger
DROP TRIGGER IF EXISTS sync_member_points_trigger ON public.reg_point_transactions;
DROP TRIGGER IF EXISTS trg_sync_member_points_old ON public.reg_point_transactions;