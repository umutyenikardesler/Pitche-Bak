-- UGC Güvenliği (1.2): Kullanıcı engelleme ve içerik şikayet tabloları

-- 1) user_blocks: Kullanıcıların birbirini engellemesi
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Blocker kendi engellemelerini görebilir
CREATE POLICY "Users see their blocks"
  ON public.user_blocks
  FOR SELECT
  USING (auth.uid() = blocker_id);

-- Blocker engelleme ekleyebilir
CREATE POLICY "Users can block"
  ON public.user_blocks
  FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

-- Blocker engellemeyi kaldırabilir
CREATE POLICY "Users can unblock"
  ON public.user_blocks
  FOR DELETE
  USING (auth.uid() = blocker_id);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON public.user_blocks (blocked_id);

-- 2) content_reports: İçerik/mesaj şikayetleri (geliştiriciye bildirim için)
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL, -- 'message', 'profile', vb.
  content_id TEXT, -- mesaj id, profil id vb.
  content_preview TEXT, -- şikayet edilen içeriğin özeti (max 500 char)
  reason TEXT, -- kullanıcının belirttiği sebep
  status TEXT NOT NULL DEFAULT 'pending', -- pending, reviewed, resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Sadece reporter kendi şikayetlerini görebilir (opsiyonel, admin için ayrı policy)
CREATE POLICY "Users see own reports"
  ON public.content_reports
  FOR SELECT
  USING (auth.uid() = reporter_id);

-- Kullanıcılar şikayet ekleyebilir
CREATE POLICY "Users can report"
  ON public.content_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE INDEX IF NOT EXISTS content_reports_reporter_idx ON public.content_reports (reporter_id);
CREATE INDEX IF NOT EXISTS content_reports_status_idx ON public.content_reports (status);
CREATE INDEX IF NOT EXISTS content_reports_created_idx ON public.content_reports (created_at DESC);
