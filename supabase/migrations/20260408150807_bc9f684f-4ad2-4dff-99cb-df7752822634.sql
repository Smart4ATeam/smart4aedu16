-- resources 表新增欄位
ALTER TABLE public.resources ADD COLUMN app_id text;
ALTER TABLE public.resources ADD COLUMN trial_enabled boolean NOT NULL DEFAULT false;

-- 新建 resource_trials 表
CREATE TABLE public.resource_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_id uuid REFERENCES public.resources(id) ON DELETE CASCADE NOT NULL,
  member_no text,
  organization_id text NOT NULL,
  app_id text NOT NULL,
  resource_category text NOT NULL,
  api_key text,
  webhook_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource_id)
);

ALTER TABLE public.resource_trials ENABLE ROW LEVEL SECURITY;

-- 學員可查看自己的領用紀錄
CREATE POLICY "Users can view own trials"
  ON public.resource_trials FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 學員可新增自己的領用紀錄
CREATE POLICY "Users can insert own trials"
  ON public.resource_trials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 管理員可查看所有領用紀錄
CREATE POLICY "Admins can manage all trials"
  ON public.resource_trials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));