-- Normalize short share links to 6 chars and /s/<code> format.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match'
      AND column_name = 'share_short_url'
  ) THEN
    ALTER TABLE public.match DROP COLUMN share_short_url;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'match'
      AND column_name = 'share_code'
  ) THEN
    ALTER TABLE public.match DROP COLUMN share_code;
  END IF;

  ALTER TABLE public.match
    ADD COLUMN share_code TEXT
    GENERATED ALWAYS AS (substring(md5(id::text), 1, 6)) STORED;

  ALTER TABLE public.match
    ADD COLUMN share_short_url TEXT
    GENERATED ALWAYS AS ('https://sahayabak.com/s/' || substring(md5(id::text), 1, 6)) STORED;
END $$;

DROP INDEX IF EXISTS match_share_code_unique_idx;

CREATE UNIQUE INDEX IF NOT EXISTS match_share_code_unique_idx
  ON public.match (share_code);
