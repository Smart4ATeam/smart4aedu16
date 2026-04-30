-- 1. 新增 APP_BASE_URL 設定
INSERT INTO public.system_settings (key_name, value, description)
VALUES (
  'APP_BASE_URL',
  'https://id-preview--93f9fb81-06af-42e1-8e70-db2d33cb4b5a.lovable.app',
  '應用前端基底網址，用於通知訊息中的連結組合（部署後請改為正式網址）'
)
ON CONFLICT (key_name) DO NOTHING;

-- 2. 改寫 on_task_application_completed：通知附完整連結
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
  v_profile RECORD;
  v_doc_no text;
  v_ym int;
  v_withholding numeric;
  v_nhi numeric;
  v_is_first boolean;
  v_base_url text;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT * INTO v_task FROM public.tasks WHERE id = NEW.task_id;
    v_amount := COALESCE(NEW.final_amount, NEW.quoted_amount, v_task.amount, 0);
    v_reward_points := COALESCE(v_task.reward_points, 0);

    SELECT value INTO v_base_url FROM public.system_settings WHERE key_name = 'APP_BASE_URL';
    v_base_url := COALESCE(NULLIF(trim(v_base_url), ''), '');

    SELECT id INTO v_member_id FROM public.reg_members WHERE user_id = NEW.user_id LIMIT 1;
    IF v_member_id IS NULL THEN
      SELECT email INTO v_user_email FROM public.profiles WHERE id = NEW.user_id;
      IF v_user_email IS NOT NULL THEN
        SELECT id INTO v_member_id FROM public.reg_members WHERE email = v_user_email LIMIT 1;
      END IF;
    END IF;

    IF v_amount > 0 THEN
      INSERT INTO public.revenue_records (user_id, amount, source, description)
      VALUES (NEW.user_id, v_amount, 'task', '任務完成獎勵：' || COALESCE(v_task.title, ''));

      UPDATE public.profiles
        SET total_revenue = COALESCE(total_revenue, 0) + v_amount
        WHERE id = NEW.user_id;
    END IF;

    IF v_reward_points > 0 AND v_member_id IS NOT NULL THEN
      INSERT INTO public.reg_point_transactions (member_id, points_delta, type, category, description)
      VALUES (v_member_id, v_reward_points, '任務完成', 'task_points', '任務完成積分獎勵：' || COALESCE(v_task.title, ''));
    END IF;

    NEW.completed_at := now();
    PERFORM public.check_and_grant_achievements(NEW.user_id);

    IF v_amount > 0 THEN
      SELECT * INTO v_profile FROM public.payee_profiles WHERE user_id = NEW.user_id;

      IF v_profile.id IS NOT NULL AND v_profile.first_submitted_at IS NOT NULL THEN
        v_withholding := CASE WHEN v_amount >= 20010 THEN ROUND(v_amount * 0.10) ELSE 0 END;
        v_nhi := CASE WHEN v_amount >= 20000 THEN ROUND(v_amount * 0.0211) ELSE 0 END;
        v_ym := to_char(now() AT TIME ZONE 'Asia/Taipei', 'YYYYMM')::int;
        v_doc_no := public.next_payment_doc_no(v_ym);
        v_is_first := false;

        INSERT INTO public.task_payment_documents (
          application_id, doc_no, doc_seq_year_month, generated_at,
          service_period, service_description,
          gross_amount, withholding_tax, nhi_supplement, net_amount,
          is_first_payment
        ) VALUES (
          NEW.id, v_doc_no, v_ym, now(),
          to_char(now() AT TIME ZONE 'Asia/Taipei', 'YYYY 年 FMMM 月'),
          COALESCE(v_task.title, ''),
          v_amount, v_withholding, v_nhi, v_amount - v_withholding - v_nhi,
          v_is_first
        );

        NEW.status := 'payment_pending_signature';
        PERFORM public.send_system_message(
          NEW.user_id,
          '勞報單已產生',
          '您的任務「' || COALESCE(v_task.title, '') || '」勞報單已產生（單號：' || v_doc_no ||
          E'）。\n\n請點以下連結下載並簽名後回傳：\n' ||
          v_base_url || '/tasks/' || NEW.task_id || '/payment',
          'task'
        );
      ELSE
        NEW.status := 'payment_pending_info';
        PERFORM public.send_system_message(
          NEW.user_id,
          '請填寫收款資料',
          '任務「' || COALESCE(v_task.title, '') || '」已確認完成。' ||
          E'\n\n請點以下連結填寫收款資料，系統將自動產生勞報單：\n' ||
          v_base_url || '/payee',
          'task'
        );
      END IF;
    END IF;
  END IF;

  IF NEW.status = 'failed' AND (OLD.status IS DISTINCT FROM 'failed') THEN
    NEW.failed_at := now();
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. 改寫 promote_pending_info_apps：擴大撈取範圍 + 連結
CREATE OR REPLACE FUNCTION public.promote_pending_info_apps(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _app RECORD;
  _task RECORD;
  _doc_no text;
  _ym int;
  _gross numeric;
  _withholding numeric;
  _nhi numeric;
  _base_url text;
BEGIN
  SELECT value INTO _base_url FROM public.system_settings WHERE key_name = 'APP_BASE_URL';
  _base_url := COALESCE(NULLIF(trim(_base_url), ''), '');

  FOR _app IN
    SELECT a.*
    FROM public.task_applications a
    LEFT JOIN public.tasks t ON t.id = a.task_id
    WHERE a.user_id = _user_id
      AND (
        a.status = 'payment_pending_info'
        OR (
          a.status = 'completed'
          AND COALESCE(a.final_amount, a.quoted_amount, t.amount, 0) > 0
          AND NOT EXISTS (
            SELECT 1 FROM public.task_payment_documents d WHERE d.application_id = a.id
          )
        )
      )
    ORDER BY a.completed_at NULLS FIRST, a.id
    FOR UPDATE OF a
  LOOP
    SELECT * INTO _task FROM public.tasks WHERE id = _app.task_id;
    _gross := COALESCE(_app.final_amount, _app.quoted_amount, _task.amount, 0);
    IF _gross <= 0 THEN
      CONTINUE;
    END IF;
    _withholding := CASE WHEN _gross >= 20010 THEN ROUND(_gross * 0.10) ELSE 0 END;
    _nhi := CASE WHEN _gross >= 20000 THEN ROUND(_gross * 0.0211) ELSE 0 END;

    _ym := to_char(now() AT TIME ZONE 'Asia/Taipei', 'YYYYMM')::int;
    _doc_no := public.next_payment_doc_no(_ym);

    INSERT INTO public.task_payment_documents (
      application_id, doc_no, doc_seq_year_month, generated_at,
      service_period, service_description,
      gross_amount, withholding_tax, nhi_supplement, net_amount,
      is_first_payment
    ) VALUES (
      _app.id, _doc_no, _ym, now(),
      to_char(now() AT TIME ZONE 'Asia/Taipei', 'YYYY 年 FMMM 月'),
      COALESCE(_task.title, ''),
      _gross, _withholding, _nhi, _gross - _withholding - _nhi,
      false
    );

    UPDATE public.task_applications
      SET status = 'payment_pending_signature'
      WHERE id = _app.id;

    PERFORM public.send_system_message(
      _app.user_id,
      '勞報單已產生',
      '您的任務「' || COALESCE(_task.title, '') || '」勞報單已產生（單號：' || _doc_no ||
      E'）。\n\n請點以下連結下載並簽名後回傳：\n' ||
      _base_url || '/tasks/' || _app.task_id || '/payment',
      'task'
    );
  END LOOP;
END;
$function$;

-- 4. 補做 Zin Lee（呼叫修好的函式即可，會自動撈出 completed + 無勞報單者）
SELECT public.promote_pending_info_apps('a9f7613d-ec8a-4fa3-b49a-090cb5c5112b'::uuid);
