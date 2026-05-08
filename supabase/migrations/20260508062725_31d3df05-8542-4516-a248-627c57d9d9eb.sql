DO $$
DECLARE
  v_base text;
BEGIN
  SELECT NULLIF(trim(value), '') INTO v_base FROM public.system_settings WHERE key_name = 'APP_BASE_URL';
  IF v_base IS NULL THEN
    RETURN;
  END IF;
  v_base := regexp_replace(v_base, '/+$', '');

  UPDATE public.messages
     SET content = regexp_replace(
                     content,
                     'https?://id-preview--[a-z0-9-]+\.lovable\.app',
                     v_base,
                     'g'
                   )
   WHERE content ~ 'https?://id-preview--[a-z0-9-]+\.lovable\.app';
END $$;