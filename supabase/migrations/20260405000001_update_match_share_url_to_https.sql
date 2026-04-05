-- Make match.share_url a short https link (clickable in chats)
-- It should redirect to the app deep link (myapp://match/<id>) on the web side.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'match'
      AND column_name  = 'share_url'
  ) THEN
    -- share_url was previously a generated deep link; we recreate it as a generated https link.
    ALTER TABLE public.match DROP COLUMN share_url;
  END IF;

  ALTER TABLE public.match
    ADD COLUMN share_url TEXT
    GENERATED ALWAYS AS ('https://sahayabak.com/m/' || id::text) STORED;
END $$;

