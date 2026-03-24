
-- =============================================
-- 學習中心模組：10 張表 + RLS + 觸發器
-- =============================================

-- 1. 合作單位
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'internal',
  category text DEFAULT '',
  contact_name text DEFAULT '',
  contact_email text DEFAULT '',
  contact_phone text DEFAULT '',
  logo_url text,
  description text DEFAULT '',
  website_url text,
  contract_start date,
  contract_end date,
  contract_status text NOT NULL DEFAULT 'active',
  revenue_share numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners viewable by authenticated" ON public.partners FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage partners" ON public.partners FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. 講師
CREATE TABLE public.instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  name text NOT NULL,
  avatar_url text,
  bio text DEFAULT '',
  specialties text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors viewable by authenticated" ON public.instructors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage instructors" ON public.instructors FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. 課程定義
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  category text NOT NULL DEFAULT 'basic',
  tags text[] DEFAULT '{}',
  cover_url text,
  price numeric NOT NULL DEFAULT 0,
  total_hours numeric DEFAULT 0,
  materials_url text,
  series_id uuid,
  status text NOT NULL DEFAULT 'draft',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Courses viewable by authenticated" ON public.courses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage courses" ON public.courses FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER courses_updated_at BEFORE UPDATE ON public.courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. 開課梯次
CREATE TABLE public.course_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  instructor_id uuid REFERENCES public.instructors(id) ON DELETE SET NULL,
  title_suffix text DEFAULT '',
  price numeric,
  max_students int,
  location text DEFAULT '',
  start_date date,
  end_date date,
  schedule_type text NOT NULL DEFAULT 'recurring',
  recurrence_rule text DEFAULT '',
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.course_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sessions viewable by authenticated" ON public.course_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sessions" ON public.course_sessions FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. 課程單元
CREATE TABLE public.course_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE public.course_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Units viewable by authenticated" ON public.course_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage units" ON public.course_units FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. 單元內容區塊
CREATE TABLE public.unit_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id uuid NOT NULL REFERENCES public.course_units(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'text',
  content_json jsonb NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0
);

ALTER TABLE public.unit_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sections viewable by authenticated" ON public.unit_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage sections" ON public.unit_sections FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- 7. 報名
CREATE TABLE public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.course_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  paid boolean NOT NULL DEFAULT false,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_id)
);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own enrollments" ON public.course_enrollments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own enrollments" ON public.course_enrollments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage enrollments" ON public.course_enrollments FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- 8. 報到
CREATE TABLE public.course_attendances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  attended boolean NOT NULL DEFAULT false
);

ALTER TABLE public.course_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attendances" ON public.course_attendances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.course_enrollments WHERE id = course_attendances.enrollment_id AND user_id = auth.uid()));
CREATE POLICY "Admins can manage attendances" ON public.course_attendances FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- 9. 測驗
CREATE TABLE public.course_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]',
  passing_score int NOT NULL DEFAULT 60,
  time_limit_minutes int DEFAULT 30
);

ALTER TABLE public.course_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quizzes viewable by authenticated" ON public.course_quizzes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage quizzes" ON public.course_quizzes FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- 10. 作答紀錄
CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',
  score int NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts" ON public.quiz_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attempts" ON public.quiz_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage attempts" ON public.quiz_attempts FOR ALL TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- 觸發器：報到 +10 積分
-- =============================================
CREATE OR REPLACE FUNCTION public.on_attendance_recorded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _user_id uuid;
BEGIN
  IF NEW.attended = true THEN
    SELECT user_id INTO _user_id FROM public.course_enrollments WHERE id = NEW.enrollment_id;
    IF _user_id IS NOT NULL THEN
      UPDATE public.profiles SET total_points = total_points + 10 WHERE id = _user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_points
AFTER INSERT ON public.course_attendances
FOR EACH ROW EXECUTE FUNCTION on_attendance_recorded();

-- =============================================
-- 觸發器：測驗通過 +20 積分 + 檢查成就
-- =============================================
CREATE OR REPLACE FUNCTION public.on_quiz_passed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.passed = true THEN
    UPDATE public.profiles SET total_points = total_points + 20 WHERE id = NEW.user_id;
    PERFORM check_and_grant_achievements(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quiz_points
AFTER INSERT ON public.quiz_attempts
FOR EACH ROW EXECUTE FUNCTION on_quiz_passed();

-- =============================================
-- 新增成就
-- =============================================
INSERT INTO public.achievements (name, description, icon, category) VALUES
  ('首次上課', '完成第一次課程報到', '📚', 'learning'),
  ('學霸', '通過 5 次以上測驗', '🎓', 'learning')
ON CONFLICT DO NOTHING;
