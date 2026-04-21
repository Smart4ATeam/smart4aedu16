ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_category_check;
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_category_check
CHECK (category = ANY (ARRAY['system','client','team','task']));