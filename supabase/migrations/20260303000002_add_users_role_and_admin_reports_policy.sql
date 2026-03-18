-- Users tablosuna role sütunu ekle (admin / user)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- content_reports: Admin tüm şikayetleri görebilir
CREATE POLICY "Admins see all reports"
  ON public.content_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- content_reports: Admin status, admin_notes, reviewed_at güncelleyebilir
CREATE POLICY "Admins can update reports"
  ON public.content_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
