-- Şikayet edilen bir mesaj admin tarafından onaylandığında (raporda "Onayla"
-- seçilince) silinebilsin diye admin'e DELETE izni ekliyor.
--
-- NEDEN: mevcut politika yalnızca gönderenin kendi mesajını silmesine izin
-- veriyordu (auth.uid() = sender_id). Admin panelindeki "Onayla" butonu
-- şikayet edilen mesajı silmeye çalışırken RLS sessizce reddediyordu.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages') THEN
    DROP POLICY IF EXISTS "Admins can delete any message" ON public.messages;
    CREATE POLICY "Admins can delete any message"
      ON public.messages FOR DELETE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
