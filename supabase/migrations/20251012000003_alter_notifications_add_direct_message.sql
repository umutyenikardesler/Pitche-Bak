-- Allow direct messages in notifications.type
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
    CHECK (type IN ('follow_request', 'join_request', 'direct_message'));
END $$;

CREATE INDEX IF NOT EXISTS notifications_type_idx ON public.notifications(type);

