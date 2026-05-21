-- Allow message edits for 15 minutes and keep an edited timestamp.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION public.set_message_edited_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    NEW.edited_at := timezone('utc'::text, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_set_edited_at_before_update ON public.messages;

CREATE TRIGGER messages_set_edited_at_before_update
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.set_message_edited_at();

CREATE POLICY "Sender can edit own recent messages"
  ON public.messages
  FOR UPDATE
  USING (
    auth.uid() = sender_id
    AND created_at >= timezone('utc'::text, now()) - INTERVAL '15 minutes'
  )
  WITH CHECK (
    auth.uid() = sender_id
    AND created_at >= timezone('utc'::text, now()) - INTERVAL '15 minutes'
  );
