ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS broadcast_filter jsonb,
  ADD COLUMN IF NOT EXISTS recipient_count integer,
  ADD COLUMN IF NOT EXISTS created_by uuid;