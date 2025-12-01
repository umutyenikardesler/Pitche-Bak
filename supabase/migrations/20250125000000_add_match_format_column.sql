-- Add match_format column to match table
-- This column stores the match format (5-5, 6-6, 7-7) for determining position limits

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'match'
      AND column_name  = 'match_format'
  ) THEN
    ALTER TABLE public.match
      ADD COLUMN match_format TEXT DEFAULT '5-5' CHECK (match_format IN ('5-5', '6-6', '7-7'));
    
    -- Update existing matches: try to infer format from missing_groups
    -- Default to '5-5' if cannot be determined
    UPDATE public.match
    SET match_format = CASE
      WHEN missing_groups IS NULL OR array_length(missing_groups, 1) = 0 THEN '5-5'
      ELSE '5-5' -- Default, will be updated when positions are edited
    END;
  END IF;
END $$;

