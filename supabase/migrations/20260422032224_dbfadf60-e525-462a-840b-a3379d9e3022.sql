-- 1) 建立 profile（若不存在）
INSERT INTO public.profiles (id, display_name, email, student_id, activated)
VALUES (
  '421d914e-2768-4d29-9863-593e19b6bee5',
  '沈益昌',
  'Syichg@gmail.com',
  'SA26010119',
  true
)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  email = EXCLUDED.email,
  student_id = EXCLUDED.student_id,
  activated = true,
  updated_at = now();

-- 2) 綁定 reg_members → user_id
UPDATE public.reg_members
SET user_id = '421d914e-2768-4d29-9863-593e19b6bee5'
WHERE id = '42de654b-157f-4753-85f4-1e0e4ded1d29';

-- 3) 確保 user_roles 有 'user' 角色
INSERT INTO public.user_roles (user_id, role)
VALUES ('421d914e-2768-4d29-9863-593e19b6bee5', 'user')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4) 確保 notification_settings 存在
INSERT INTO public.notification_settings (user_id)
VALUES ('421d914e-2768-4d29-9863-593e19b6bee5')
ON CONFLICT (user_id) DO NOTHING;