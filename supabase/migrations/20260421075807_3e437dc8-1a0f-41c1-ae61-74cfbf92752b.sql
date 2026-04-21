-- 任務等級選項表
CREATE TABLE public.task_difficulties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_difficulties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Difficulties viewable by authenticated"
  ON public.task_difficulties FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage difficulties"
  ON public.task_difficulties FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.task_difficulties (label, sort_order) VALUES
  ('初級', 1),
  ('中級', 2),
  ('高級', 3);

-- 任務類別選項表
CREATE TABLE public.task_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories viewable by authenticated"
  ON public.task_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage categories"
  ON public.task_categories FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.task_categories (value, label, sort_order) VALUES
  ('general', '一般', 1),
  ('development', '開發', 2),
  ('design', '設計', 3),
  ('marketing', '行銷', 4),
  ('automation', '自動化', 5);