
-- =============================================
-- 課程報名系統 reg_ 表格建立
-- =============================================

-- 1. reg_courses — 課程主檔
CREATE TABLE public.reg_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code text NOT NULL UNIQUE,
  course_name text NOT NULL,
  course_type text NOT NULL DEFAULT 'basic',
  course_date daterange,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reg_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reg_courses" ON public.reg_courses
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view reg_courses" ON public.reg_courses
  FOR SELECT TO authenticated USING (true);

-- 2. reg_orders — 訂單總表
CREATE TABLE public.reg_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE,
  course_ids uuid[] NOT NULL DEFAULT '{}',
  course_snapshot jsonb DEFAULT '{}',
  p1_name text,
  p1_phone text,
  p1_email text,
  p2_name text,
  p2_phone text,
  p2_email text,
  p3_name text,
  p3_phone text,
  p3_email text,
  payment_status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  payment_method text,
  total_amount numeric NOT NULL DEFAULT 0,
  discount_plan text,
  invoice_type text,
  invoice_title text,
  invoice_number text,
  invoice_status text NOT NULL DEFAULT 'active',
  invoice_void_reason text,
  invoice_void_at timestamptz,
  invoice_reissued_number text,
  invoice_reissued_at timestamptz,
  dealer_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reg_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reg_orders" ON public.reg_orders
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view reg_orders" ON public.reg_orders
  FOR SELECT TO authenticated USING (true);

-- 3. reg_members — 學員主檔
CREATE TABLE public.reg_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_no text UNIQUE,
  name text NOT NULL,
  phone text,
  email text,
  course_level text,
  points integer NOT NULL DEFAULT 0,
  referral_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reg_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reg_members" ON public.reg_members
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view reg_members" ON public.reg_members
  FOR SELECT TO authenticated USING (true);

-- 4. reg_enrollments — 報名明細
CREATE TABLE public.reg_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.reg_orders(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.reg_members(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.reg_courses(id) ON DELETE SET NULL,
  course_type text,
  status text NOT NULL DEFAULT 'enrolled',
  payment_status text,
  paid_at timestamptz,
  invoice_title text,
  dealer_id text,
  referrer text,
  checked_in boolean NOT NULL DEFAULT false,
  post_survey text,
  post_test text,
  test_score numeric,
  certificate text,
  pre_notification_sent boolean NOT NULL DEFAULT false,
  points_awarded integer NOT NULL DEFAULT 0,
  lovable_invite text,
  notes text,
  enrolled_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reg_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reg_enrollments" ON public.reg_enrollments
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view reg_enrollments" ON public.reg_enrollments
  FOR SELECT TO authenticated USING (true);

-- 5. reg_point_transactions — 點數流水帳
CREATE TABLE public.reg_point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.reg_members(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.reg_orders(id) ON DELETE SET NULL,
  points_delta integer NOT NULL,
  type text NOT NULL DEFAULT 'manual',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reg_point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage reg_point_transactions" ON public.reg_point_transactions
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view reg_point_transactions" ON public.reg_point_transactions
  FOR SELECT TO authenticated USING (true);

-- 6. reg_operation_logs — 操作紀錄 (append-only)
CREATE TABLE public.reg_operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text NOT NULL,
  operated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reg_operation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert reg_operation_logs" ON public.reg_operation_logs
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view reg_operation_logs" ON public.reg_operation_logs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- Triggers
-- =============================================

-- Trigger 1: 自動產生 member_no (SA + YYMM + 4位流水號)
CREATE OR REPLACE FUNCTION public.generate_member_no()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text;
  seq int;
BEGIN
  prefix := 'SA' || to_char(now(), 'YYMM');
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(member_no, '^SA\d{4}', ''), '')::int
  ), 0) + 1
  INTO seq
  FROM public.reg_members
  WHERE member_no LIKE prefix || '%';
  
  NEW.member_no := prefix || lpad(seq::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_member_no
  BEFORE INSERT ON public.reg_members
  FOR EACH ROW
  WHEN (NEW.member_no IS NULL)
  EXECUTE FUNCTION public.generate_member_no();

-- Trigger 2: 點數交易後同步更新 reg_members.points
CREATE OR REPLACE FUNCTION public.sync_member_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.reg_members
  SET points = (
    SELECT COALESCE(SUM(points_delta), 0)
    FROM public.reg_point_transactions
    WHERE member_id = NEW.member_id
  )
  WHERE id = NEW.member_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_member_points
  AFTER INSERT ON public.reg_point_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_member_points();

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX idx_reg_enrollments_order_id ON public.reg_enrollments(order_id);
CREATE INDEX idx_reg_enrollments_member_id ON public.reg_enrollments(member_id);
CREATE INDEX idx_reg_enrollments_course_id ON public.reg_enrollments(course_id);
CREATE INDEX idx_reg_enrollments_course_type ON public.reg_enrollments(course_type);
CREATE INDEX idx_reg_point_transactions_member_id ON public.reg_point_transactions(member_id);
CREATE INDEX idx_reg_orders_payment_status ON public.reg_orders(payment_status);
CREATE INDEX idx_reg_members_email ON public.reg_members(email);
