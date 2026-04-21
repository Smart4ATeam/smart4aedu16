-- 1) 新增 reward_points 欄位
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reward_points integer NOT NULL DEFAULT 0;

-- 2) 更新任務完成 trigger function：完成時加發積分
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

    -- 找到對應的 member_id（給金額與積分共用）
    SELECT id INTO v_member_id FROM public.reg_members WHERE user_id = NEW.user_id LIMIT 1;
    IF v_member_id IS NULL THEN
      SELECT email INTO v_user_email FROM public.profiles WHERE id = NEW.user_id;
      IF v_user_email IS NOT NULL THEN
        SELECT id INTO v_member_id FROM public.reg_members WHERE email = v_user_email LIMIT 1;
      END IF;
    END IF;

    -- 金額獎勵（既有邏輯）
    IF v_amount > 0 THEN
      INSERT INTO public.revenue_records (user_id, amount, source, description)
      VALUES (NEW.user_id, v_amount, 'task', '任務完成獎勵：' || COALESCE(v_task.title, ''));

      UPDATE public.profiles
        SET total_revenue = COALESCE(total_revenue, 0) + v_amount
        WHERE id = NEW.user_id;

      IF v_member_id IS NOT NULL THEN
        INSERT INTO public.reg_point_transactions (member_id, points_delta, type, category, description)
        VALUES (v_member_id, v_amount::int, '任務完成', 'task_points', '任務完成積分：' || COALESCE(v_task.title, ''));
      END IF;
    END IF;

    -- 積分獎勵（新增）
    IF v_reward_points > 0 AND v_member_id IS NOT NULL THEN
      INSERT INTO public.reg_point_transactions (member_id, points_delta, type, category, description)
      VALUES (v_member_id, v_reward_points, 'earned', 'points', '任務完成積分獎勵：' || COALESCE(v_task.title, ''));
    END IF;

    NEW.completed_at := now();

    -- 觸發成就檢查
    PERFORM public.check_and_grant_achievements(NEW.user_id);
  END IF;

  IF NEW.status = 'failed' AND (OLD.status IS DISTINCT FROM 'failed') THEN
    NEW.failed_at := now();
  END IF;

  RETURN NEW;
END;
$function$;