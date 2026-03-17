
-- Add personal integration key columns to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_provider text DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS ai_api_key text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS make_api_token text DEFAULT NULL;
