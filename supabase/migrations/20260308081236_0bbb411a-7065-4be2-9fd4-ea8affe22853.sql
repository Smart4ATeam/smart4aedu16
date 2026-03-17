INSERT INTO public.user_roles (user_id, role)
VALUES ('9b036eda-69af-4078-b0a9-3a769c609d19', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;