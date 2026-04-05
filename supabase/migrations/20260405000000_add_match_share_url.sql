-- Add share_url to match table (deep link)
-- Stores a stable per-match URL that opens the mobile app: myapp://match/<id>

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'match'
      AND column_name  = 'share_url'
  ) THEN
    ALTER TABLE public.match
      ADD COLUMN share_url TEXT
      GENERATED ALWAYS AS ('myapp://match/' || id::text) STORED;
  END IF;
END $$;

