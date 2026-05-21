-- public.messages created_at / edited_at: Türkiye saati (UTC+3) olarak saklansın.
-- Projedeki diger tablolarda oldugu gibi timestamp without time zone + UTC+3 default kullanilir.

DO $$
DECLARE
  created_type text;
  edited_type text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'created_at'
  ) THEN
    SELECT data_type
    INTO created_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'created_at'
    LIMIT 1;

    IF created_type = 'timestamp with time zone' THEN
      EXECUTE $SQL$
        ALTER TABLE public.messages
          ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE
          USING (created_at AT TIME ZONE 'UTC' + INTERVAL '3 hours');
      $SQL$;
    END IF;

    EXECUTE $SQL$
      ALTER TABLE public.messages
        ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'UTC' + INTERVAL '3 hours')::timestamp;
    $SQL$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'edited_at'
  ) THEN
    EXECUTE $SQL$
      ALTER TABLE public.messages
        ADD COLUMN edited_at TIMESTAMP WITHOUT TIME ZONE NULL;
    $SQL$;
  ELSE
    SELECT data_type
    INTO edited_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'edited_at'
    LIMIT 1;

    IF edited_type = 'timestamp with time zone' THEN
      EXECUTE $SQL$
        ALTER TABLE public.messages
          ALTER COLUMN edited_at TYPE TIMESTAMP WITHOUT TIME ZONE
          USING (
            CASE
              WHEN edited_at IS NULL THEN NULL
              ELSE (edited_at AT TIME ZONE 'UTC' + INTERVAL '3 hours')
            END
          );
      $SQL$;
    END IF;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_message_edited_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.edited_at := (now() AT TIME ZONE 'UTC' + INTERVAL '3 hours')::timestamp;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_set_edited_at_before_update ON public.messages;

CREATE TRIGGER messages_set_edited_at_before_update
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.set_message_edited_at();

DROP POLICY IF EXISTS "Sender can edit own recent messages" ON public.messages;

CREATE POLICY "Sender can edit own recent messages"
  ON public.messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND created_at >= ((now() AT TIME ZONE 'UTC' + INTERVAL '3 hours')::timestamp - INTERVAL '15 minutes')
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND created_at >= ((now() AT TIME ZONE 'UTC' + INTERVAL '3 hours')::timestamp - INTERVAL '15 minutes')
  );
