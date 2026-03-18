-- user_blocks: status ve reviewed_at sütunları ekle
-- Admin Şikayet Raporları'nda "Kullanıcı Engellendi" durumunu onaylayınca bu tabloya da yansır
ALTER TABLE public.user_blocks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.user_blocks
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITHOUT TIME ZONE;

-- Mevcut kayıtlar için default 'pending' zaten uygulanır
COMMENT ON COLUMN public.user_blocks.status IS 'pending, resolved, reviewed, rejected, checked';
COMMENT ON COLUMN public.user_blocks.reviewed_at IS 'Türkiye saati (UTC+3) - admin inceleme tarihi';

-- Admin: user_blocks status ve reviewed_at güncelleyebilir (Şikayet Raporları'ndan)
CREATE POLICY "Admins can update user_blocks"
  ON public.user_blocks
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
