-- Add columns for join request feature and allow new type

-- 1) Add match_id and position columns if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'notifications'
      AND column_name  = 'match_id'
  ) THEN
    ALTER TABLE public.notifications
      ADD COLUMN match_id UUID REFERENCES public.match(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'notifications'
      AND column_name  = 'position'
  ) THEN
    ALTER TABLE public.notifications
      ADD COLUMN position TEXT;
  END IF;
END $$;

-- 2) Relax/extend the type check constraint to include 'join_request'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc ON cc.constraint_name = tc.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.table_name   = 'notifications'
      AND tc.constraint_name = 'notifications_type_check'
  ) THEN
    ALTER TABLE public.notifications
      DROP CONSTRAINT notifications_type_check;
  END IF;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('follow_request', 'join_request'));
END $$;

-- 3) Helpful indexes
CREATE INDEX IF NOT EXISTS notifications_match_id_idx ON public.notifications(match_id);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON public.notifications(type);


