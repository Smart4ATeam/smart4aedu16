
-- 1. Extend course_quizzes
ALTER TABLE public.course_quizzes
  ADD COLUMN IF NOT EXISTS allow_retake boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- 2. Create certificates table
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quiz_attempt_id uuid REFERENCES public.quiz_attempts(id) ON DELETE SET NULL,
  course_id uuid NOT NULL,
  course_name text NOT NULL,
  student_name text NOT NULL,
  training_date date NOT NULL,
  score integer NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  image_url text,
  status text NOT NULL DEFAULT 'pending'
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own certificates"
  ON public.certificates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own certificates"
  ON public.certificates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all certificates"
  ON public.certificates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create certificates storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: admin full access
CREATE POLICY "Admins can manage certificate files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'certificates' AND has_role(auth.uid(), 'admin'::app_role));

-- Students can read their own certificate files (folder = user_id)
CREATE POLICY "Users can read own certificate files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates' AND auth.uid()::text = (storage.foldername(name))[1]);
