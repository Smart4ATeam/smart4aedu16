-- =========================================================
-- Payment / Labor Report (勞報單) workflow — v3.2
-- =========================================================

-- ---- 1. payee_profiles --------------------------------------------------
CREATE TABLE public.payee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,

  payee_type text NOT NULL DEFAULT '國內個人',
  name text NOT NULL,
  id_number text NOT NULL,
  phone text,
  email text,
  registered_address text NOT NULL,

  bank_code text NOT NULL,
  bank_name text NOT NULL,
  branch_code text,
  branch_name text,
  account_number text NOT NULL,
  account_name text NOT NULL,

  -- storage paths（被回收後設 null）
  id_card_front_url text,
  id_card_back_url text,
  bankbook_cover_url text,

  -- 外部雲端連結（永久保留，作為 webhook 是否帶附件的判斷依據）
  id_card_front_cloud_url text,
  id_card_back_cloud_url text,
  bankbook_cover_cloud_url text,

  attachments_purged_at timestamptz,
  consent_at timestamptz,

  first_submitted_at timestamptz,           -- 由 callback 首次寫入
  last_updated_via text DEFAULT 'initial',  -- initial | self_update | admin_edit
  last_update_webhook_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payee_profiles_user_id ON public.payee_profiles(user_id);

ALTER TABLE public.payee_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payee profile"
  ON public.payee_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own payee profile"
  ON public.payee_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own payee profile"
  ON public.payee_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage payee profiles"
  ON public.payee_profiles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_payee_profiles_updated_at
  BEFORE UPDATE ON public.payee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---- 2. payee_profile_updates -----------------------------------------
CREATE TABLE public.payee_profile_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}',
  old_snapshot jsonb,
  new_snapshot jsonb,
  reason text NOT NULL,
  webhook_sent_at timestamptz,
  webhook_callback_token text,
  purged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payee_updates_user ON public.payee_profile_updates(user_id);
CREATE INDEX idx_payee_updates_token ON public.payee_profile_updates(webhook_callback_token);

ALTER TABLE public.payee_profile_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payee updates"
  ON public.payee_profile_updates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own payee updates"
  ON public.payee_profile_updates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins manage payee updates"
  ON public.payee_profile_updates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ---- 3. payment_doc_sequences -----------------------------------------
CREATE TABLE public.payment_doc_sequences (
  year_month int PRIMARY KEY,
  last_seq int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_doc_sequences ENABLE ROW LEVEL SECURITY;
-- 僅 SECURITY DEFINER 函式存取，無需對外開 policy

CREATE OR REPLACE FUNCTION public.next_payment_doc_no(_ym int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _seq int;
BEGIN
  INSERT INTO public.payment_doc_sequences (year_month, last_seq)
  VALUES (_ym, 1)
  ON CONFLICT (year_month) DO UPDATE
    SET last_seq = public.payment_doc_sequences.last_seq + 1,
        updated_at = now()
  RETURNING last_seq INTO _seq;
  RETURN 'LR-' || _ym::text || '-' || lpad(_seq::text, 4, '0');
END;
$$;

-- ---- 4. task_payment_documents ----------------------------------------
CREATE TABLE public.task_payment_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL UNIQUE,
  doc_no text NOT NULL UNIQUE,
  doc_seq_year_month int NOT NULL,

  generated_at timestamptz NOT NULL DEFAULT now(),
  service_period text NOT NULL,
  service_description text NOT NULL,

  gross_amount numeric NOT NULL DEFAULT 0,
  withholding_tax numeric NOT NULL DEFAULT 0,
  nhi_supplement numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,

  is_first_payment boolean NOT NULL DEFAULT false,  -- 審計用，不做流程判斷

  signed_file_url text,
  signed_file_cloud_url text,
  signed_at timestamptz,

  admin_confirmed_at timestamptz,
  admin_confirmed_by uuid,

  webhook_sent_at timestamptz,
  webhook_callback_token text,
  purged_at timestamptz,

  paid_notified_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_docs_application ON public.task_payment_documents(application_id);
CREATE INDEX idx_payment_docs_token ON public.task_payment_documents(webhook_callback_token);

ALTER TABLE public.task_payment_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payment docs"
  ON public.task_payment_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.task_applications a
    WHERE a.id = task_payment_documents.application_id
      AND a.user_id = auth.uid()
  ));

CREATE POLICY "Users update own payment docs sign"
  ON public.task_payment_documents FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.task_applications a
    WHERE a.id = task_payment_documents.application_id
      AND a.user_id = auth.uid()
  ));

CREATE POLICY "Admins manage payment docs"
  ON public.task_payment_documents FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_payment_docs_updated_at
  BEFORE UPDATE ON public.task_payment_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---- 5. promote_pending_info_apps -------------------------------------
CREATE OR REPLACE FUNCTION public.promote_pending_info_apps(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app RECORD;
  _task RECORD;
  _doc_no text;
  _ym int;
  _gross numeric;
  _withholding numeric;
  _nhi numeric;
BEGIN
  FOR _app IN
    SELECT a.*
    FROM public.task_applications a
    WHERE a.user_id = _user_id
      AND a.status = 'payment_pending_info'
    ORDER BY a.completed_at NULLS FIRST, a.id
    FOR UPDATE
  LOOP
    SELECT * INTO _task FROM public.tasks WHERE id = _app.task_id;
    _gross := COALESCE(_app.final_amount, _app.quoted_amount, _task.amount, 0);
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
      '），請至任務頁下載並簽名後回傳。',
      'task'
    );
  END LOOP;
END;
$$;

-- ---- 6. on_payee_first_submitted trigger -------------------------------
CREATE OR REPLACE FUNCTION public.on_payee_first_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.first_submitted_at IS NULL AND NEW.first_submitted_at IS NOT NULL THEN
    PERFORM public.promote_pending_info_apps(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payee_first_submitted
  AFTER UPDATE ON public.payee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_payee_first_submitted();

-- ---- 7. 擴充 on_task_application_completed ----------------------------
CREATE OR REPLACE FUNCTION public.on_task_application_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- 收益記錄（不論金額是否 > 0 都先處理）
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

    -- 進入付款流程（只在金額 > 0）
    IF v_amount > 0 THEN
      SELECT * INTO v_profile FROM public.payee_profiles WHERE user_id = NEW.user_id;

      IF v_profile.id IS NOT NULL AND v_profile.first_submitted_at IS NOT NULL THEN
        -- 已歸檔過 → 直接產生勞報單
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
          '），請至任務頁下載並簽名後回傳。',
          'task'
        );
      ELSE
        -- 尚未歸檔（沒填過或還在審核）→ 先請學員填表
        NEW.status := 'payment_pending_info';
        PERFORM public.send_system_message(
          NEW.user_id,
          '請填寫收款資料',
          '任務「' || COALESCE(v_task.title, '') || '」已確認完成，請填寫收款資料後系統將自動產生勞報單。',
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
$$;

-- ---- 8. 簽回上傳通知管理員 trigger -------------------------------------
CREATE OR REPLACE FUNCTION public.on_payment_doc_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _app RECORD;
  _student_name text;
  _admin record;
  _msg text;
BEGIN
  IF (OLD.signed_file_url IS NULL OR OLD.signed_file_url = '')
     AND NEW.signed_file_url IS NOT NULL AND NEW.signed_file_url <> '' THEN

    NEW.signed_at := COALESCE(NEW.signed_at, now());

    SELECT a.*, t.title AS task_title
      INTO _app
      FROM public.task_applications a
      JOIN public.tasks t ON t.id = a.task_id
      WHERE a.id = NEW.application_id;

    UPDATE public.task_applications
      SET status = 'payment_pending_review'
      WHERE id = NEW.application_id;

    SELECT COALESCE(NULLIF(display_name, ''), email, '未知學員') INTO _student_name
      FROM public.profiles WHERE id = _app.user_id;

    _msg := '📄 學員「' || COALESCE(_student_name, '未知') || '」已回傳勞報單（單號：' ||
            NEW.doc_no || '，任務：' || COALESCE(_app.task_title, '') ||
            '），請至任務管理確認。';

    FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      PERFORM public.send_system_message(_admin.user_id, '勞報單已簽回', _msg, 'task');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_doc_signed
  BEFORE UPDATE ON public.task_payment_documents
  FOR EACH ROW EXECUTE FUNCTION public.on_payment_doc_signed();

-- ---- 9. system_settings 佔位 ------------------------------------------
INSERT INTO public.system_settings (key_name, value, description)
VALUES ('PAYMENT_WEBHOOK_URL', '', '勞報單 / 付款流程 Webhook URL（不與其他 webhook 共用）')
ON CONFLICT DO NOTHING;

-- ---- 10. Storage buckets ----------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('payee-documents', 'payee-documents', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-signed-docs', 'payment-signed-docs', false)
ON CONFLICT (id) DO NOTHING;

-- payee-documents policies
CREATE POLICY "Users upload own payee docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payee-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own payee docs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'payee-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own payee docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payee-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins manage payee docs"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'payee-documents'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- payment-signed-docs policies
CREATE POLICY "Users upload own signed docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-signed-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own signed docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-signed-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins manage signed docs"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'payment-signed-docs'
    AND has_role(auth.uid(), 'admin'::app_role)
  );
