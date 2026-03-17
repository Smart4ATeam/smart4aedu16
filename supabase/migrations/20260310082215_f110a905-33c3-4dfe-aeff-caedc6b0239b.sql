
-- 1. Create resource_sub_categories table
CREATE TABLE public.resource_sub_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resource_sub_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sub categories viewable by authenticated"
  ON public.resource_sub_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage sub categories"
  ON public.resource_sub_categories FOR ALL
  TO public USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add new columns to resources table
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS sub_category text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS hot_rank integer,
  ADD COLUMN IF NOT EXISTS flow_count integer,
  ADD COLUMN IF NOT EXISTS usage_count integer,
  ADD COLUMN IF NOT EXISTS industry_tag text,
  ADD COLUMN IF NOT EXISTS duration text,
  ADD COLUMN IF NOT EXISTS video_type text,
  ADD COLUMN IF NOT EXISTS trial_url text;
