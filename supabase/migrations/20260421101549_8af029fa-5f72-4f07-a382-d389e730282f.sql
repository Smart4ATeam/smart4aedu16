-- 1. 新增 task_points 欄位
ALTER TABLE public.reg_members
  ADD COLUMN IF NOT EXISTS task_points integer NOT NULL DEFAULT 0;

-- 2. reg_point_transactions 加 category 欄位
ALTER TABLE public.reg_point_transactions
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'points';

-- 3. 改寫同步觸發器：依 category 同步到 points 或 task_points
CREATE OR REPLACE FUNCTION public.sync_member_points_from_tx()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.category = 'task_points' THEN
      UPDATE public.reg_members
        SET task_points = COALESCE(task_points, 0) + NEW.points_delta
        WHERE id = NEW.member_id;
    ELSE
      UPDATE public.reg_members
        SET points = COALESCE(points, 0) + NEW.points_delta
        WHERE id = NEW.member_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.category = 'task_points' THEN
      UPDATE public.reg_members
        SET task_points = COALESCE(task_points, 0) - OLD.points_delta
        WHERE id = OLD.member_id;
    ELSE
      UPDATE public.reg_members
        SET points = COALESCE(points, 0) - OLD.points_delta
        WHERE id = OLD.member_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_member_points ON public.reg_point_transactions;
CREATE TRIGGER trg_sync_member_points
  AFTER INSERT OR DELETE ON public.reg_point_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_points_from_tx();

-- 4. 改寫任務完成 trigger：把任務獎勵寫到 task_points
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

    -- 寫入 revenue_records（現金收益）
    INSERT INTO public.revenue_records (user_id, amount, source, description)
    VALUES (NEW.user_id, v_amount, 'task', COALESCE(v_task.title, '任務獎勵'));

    -- 累計到 profiles.total_revenue
    UPDATE public.profiles
      SET total_revenue = COALESCE(total_revenue, 0) + v_amount
      WHERE id = NEW.user_id;

    -- 找對應 member（user_id 優先，email fallback）
    SELECT id INTO v_member_id FROM public.reg_members WHERE user_id = NEW.user_id LIMIT 1;
    IF v_member_id IS NULL THEN
      SELECT email INTO v_user_email FROM public.profiles WHERE id = NEW.user_id;
      IF v_user_email IS NOT NULL THEN
        SELECT id INTO v_member_id FROM public.reg_members WHERE email = v_user_email LIMIT 1;
      END IF;
    END IF;

    -- 寫入 task_points（積分，非現金）
    IF v_member_id IS NOT NULL AND v_amount > 0 THEN
      INSERT INTO public.reg_point_transactions (member_id, points_delta, type, category, description)
      VALUES (v_member_id, v_amount::int, '任務完成', 'task_points', COALESCE(v_task.title, '任務獎勵'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;