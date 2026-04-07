
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system settings"
ON public.system_settings FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update system settings"
ON public.system_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert system settings"
ON public.system_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete system settings"
ON public.system_settings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default API key entry (user will set the real value)
INSERT INTO public.system_settings (key_name, value, description)
VALUES ('api_integration_key', '', 'API 串接金鑰，供 Make.com / AI Agent 等外部系統使用');
