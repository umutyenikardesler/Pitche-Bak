-- Maçı oluşturan kullanıcı, o maçın sahasının fiyatını güncelleyebilir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pitches') THEN
    DROP POLICY IF EXISTS "Match creator can update pitch price" ON public.pitches;
    CREATE POLICY "Match creator can update pitch price"
      ON public.pitches FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.match m
          WHERE m.create_user = auth.uid()
            AND m.location::text = pitches.id::text
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.match m
          WHERE m.create_user = auth.uid()
            AND m.location::text = pitches.id::text
        )
      );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
