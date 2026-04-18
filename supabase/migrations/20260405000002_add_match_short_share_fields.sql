-- Add real short share link fields for matches.
-- Long share_url stays as https://sahayabak.com/m/<id>
-- New short link becomes https://sahayabak.com/s/<share_code>

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match'
      AND column_name = 'share_code'
  ) THEN
    ALTER TABLE public.match
      ADD COLUMN share_code TEXT
      GENERATED ALWAYS AS (substring(md5(id::text), 1, 10)) STORED;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match'
      AND column_name = 'share_short_url'
  ) THEN
    ALTER TABLE public.match
      ADD COLUMN share_short_url TEXT
      GENERATED ALWAYS AS ('https://sahayabak.com/s/' || substring(md5(id::text), 1, 10)) STORED;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS match_share_code_unique_idx
  ON public.match (share_code);
