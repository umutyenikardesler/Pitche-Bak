-- pitches tablosuna price güncelleme izni
-- Admin veya en az 3 maç yapmış (kondisyon kazanmış) kullanıcılar saha ücretini güncelleyebilir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pitches') THEN
    DROP POLICY IF EXISTS "Admins can update pitches" ON public.pitches;
    DROP POLICY IF EXISTS "Admin or 3+ matches can update pitches" ON public.pitches;
    CREATE POLICY "Admin or 3+ matches can update pitches"
      ON public.pitches FOR UPDATE TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        OR (SELECT COUNT(*) FROM public.match m WHERE m.create_user = auth.uid()) >= 3
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
        OR (SELECT COUNT(*) FROM public.match m WHERE m.create_user = auth.uid()) >= 3
      );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
