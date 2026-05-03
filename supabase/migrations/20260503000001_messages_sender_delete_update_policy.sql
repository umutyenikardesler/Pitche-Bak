-- Mesaj göndereni kendi mesajını silebilsin ve düzenleyebilsin
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    DROP POLICY IF EXISTS "Sender can delete own messages" ON public.messages;
    CREATE POLICY "Sender can delete own messages"
      ON public.messages FOR DELETE TO authenticated
      USING (auth.uid() = sender_id);

    DROP POLICY IF EXISTS "Sender can edit own messages" ON public.messages;
    CREATE POLICY "Sender can edit own messages"
      ON public.messages FOR UPDATE TO authenticated
      USING (auth.uid() = sender_id)
      WITH CHECK (auth.uid() = sender_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
