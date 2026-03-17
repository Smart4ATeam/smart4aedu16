
-- =============================================
-- 1. Profiles (學員資料)
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  student_id TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  bio TEXT DEFAULT '',
  avatar_url TEXT,
  learning_days INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  total_badges INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
  organization_id TEXT,
  server_location TEXT DEFAULT 'US1',
  learning_goal TEXT DEFAULT '',
  difficulty_preference TEXT DEFAULT '初級',
  daily_learning_time TEXT DEFAULT '1 小時',
  webhook_url TEXT,
  auto_sync BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================
-- 2. User Roles (角色管理)
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 3. Tasks (任務中心)
-- =============================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in-progress', 'completed', 'cancelled')),
  deadline DATE,
  difficulty TEXT NOT NULL DEFAULT '初級' CHECK (difficulty IN ('初級', '中級', '進階')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks are viewable by all authenticated users" ON public.tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage tasks" ON public.tasks
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 4. Task Applications (任務申請/接案)
-- =============================================
CREATE TABLE public.task_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied' CHECK (status IN ('applied', 'accepted', 'rejected', 'completed')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (task_id, user_id)
);

ALTER TABLE public.task_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own applications" ON public.task_applications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can apply for tasks" ON public.task_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage applications" ON public.task_applications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 5. Achievements (勳章/成就)
-- =============================================
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🏆',
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements are viewable by all authenticated users" ON public.achievements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage achievements" ON public.achievements
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 6. User Achievements (學員獲得的勳章)
-- =============================================
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements" ON public.user_achievements
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage user achievements" ON public.user_achievements
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 7. Learning Paths (學習路徑/課程)
-- =============================================
CREATE TABLE public.learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  difficulty TEXT NOT NULL DEFAULT '初級',
  total_steps INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learning paths are viewable by all authenticated users" ON public.learning_paths
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage learning paths" ON public.learning_paths
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 8. User Learning Progress (學習進度)
-- =============================================
CREATE TABLE public.user_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  learning_path_id UUID REFERENCES public.learning_paths(id) ON DELETE CASCADE NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, learning_path_id)
);

ALTER TABLE public.user_learning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own progress" ON public.user_learning_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_learning_progress
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.user_learning_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 9. Calendar Events (行事曆事件)
-- =============================================
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  event_date DATE NOT NULL,
  event_time TIME,
  color TEXT NOT NULL DEFAULT 'gradient-orange',
  is_global BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and global events" ON public.calendar_events
  FOR SELECT TO authenticated USING (is_global = true OR auth.uid() = user_id);
CREATE POLICY "Users can manage own events" ON public.calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.calendar_events
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all events" ON public.calendar_events
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 10. Conversations (對話)
-- =============================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'system' CHECK (category IN ('system', 'client', 'team')),
  title TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 11. Conversation Participants (對話參與者)
-- =============================================
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unread BOOLEAN NOT NULL DEFAULT false,
  starred BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own participations" ON public.conversation_participants
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own participations" ON public.conversation_participants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view conversations they participate in" ON public.conversations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = conversations.id AND user_id = auth.uid()
    )
  );

-- =============================================
-- 12. Messages (訊息)
-- =============================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations" ON public.messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "Users can send messages to their conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

-- =============================================
-- 13. Resources (資源中心)
-- =============================================
CREATE TABLE public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'plugins' CHECK (category IN ('plugins', 'extensions', 'templates', 'videos')),
  author TEXT DEFAULT '',
  version TEXT DEFAULT '',
  thumbnail_url TEXT,
  download_url TEXT,
  installs INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  difficulty TEXT DEFAULT '初級',
  is_hot BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Resources are viewable by all authenticated users" ON public.resources
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage resources" ON public.resources
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 14. Notification Settings (通知設定)
-- =============================================
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  course_reminder BOOLEAN NOT NULL DEFAULT true,
  deadline_reminder BOOLEAN NOT NULL DEFAULT true,
  community_notify BOOLEAN NOT NULL DEFAULT true,
  show_info BOOLEAN NOT NULL DEFAULT false,
  show_success BOOLEAN NOT NULL DEFAULT true,
  show_warning BOOLEAN NOT NULL DEFAULT true,
  show_error BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification settings" ON public.notification_settings
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notification settings" ON public.notification_settings
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification settings" ON public.notification_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 15. Revenue Records (收益記錄)
-- =============================================
CREATE TABLE public.revenue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  source TEXT NOT NULL DEFAULT 'task',
  description TEXT DEFAULT '',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.revenue_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own revenue" ON public.revenue_records
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage revenue records" ON public.revenue_records
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- Auto-create profile on signup trigger
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  INSERT INTO public.notification_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Auto-update updated_at trigger
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER notification_settings_updated_at BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
