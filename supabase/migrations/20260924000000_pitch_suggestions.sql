-- Saha önerileri: kullanıcılar eksik halı sahaları bildirir, admin onaylayınca
-- pitches tablosuna geçer.
--
-- NEDEN: saha listesi elle dolduruluyordu ve bazı ilçeler eksik kalıyordu.
-- Eksiği en iyi o ilçede oynayan kullanıcı görüyor; öneri kuyruğu bu bilgiyi
-- toplayıp adminin tek dokunuşla eklemesini sağlıyor. Öneriler doğrudan
-- pitches'a yazılmıyor: liste uygulamanın ana verisi, denetimsiz büyümemeli.

CREATE TABLE IF NOT EXISTS public.pitch_suggestions (
  id           BIGSERIAL PRIMARY KEY,
  -- Öneriyi yapan. Kullanıcı silinirse öneri kalsın (kim önerdiği düşer).
  created_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  district_id  BIGINT REFERENCES public.districts(id),
  address      TEXT,
  phone        TEXT,
  price        NUMERIC,
  -- Öneren kişinin işaretlediği özellikler; admin onaylarken düzeltebiliyor.
  features     TEXT[],
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  -- Onaylandığında oluşan saha; tekrar onaylamayı ve izlemeyi kolaylaştırır.
  -- pitches.id UUID.
  pitch_id     UUID REFERENCES public.pitches(id) ON DELETE SET NULL,
  reviewed_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- Diğer tablolarla aynı: Türkiye saati, saat dilimsiz timestamp.
  reviewed_at  TIMESTAMP,
  created_at   TIMESTAMP NOT NULL DEFAULT (now() AT TIME ZONE 'UTC' + INTERVAL '3 hours')::timestamp
);

-- Tablo daha önce (features kolonu olmadan) oluşturulduysa da çalışsın.
ALTER TABLE public.pitch_suggestions ADD COLUMN IF NOT EXISTS features TEXT[];

CREATE INDEX IF NOT EXISTS pitch_suggestions_status_idx
  ON public.pitch_suggestions (status, created_at DESC);

ALTER TABLE public.pitch_suggestions ENABLE ROW LEVEL SECURITY;

-- Giriş yapmış herkes öneri bırakabilir, ama başkasının adına değil.
DROP POLICY IF EXISTS "Users can suggest pitches" ON public.pitch_suggestions;
CREATE POLICY "Users can suggest pitches"
  ON public.pitch_suggestions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Kullanıcı yalnızca kendi önerilerini görür; admin hepsini görür.
DROP POLICY IF EXISTS "Users read own suggestions" ON public.pitch_suggestions;
CREATE POLICY "Users read own suggestions"
  ON public.pitch_suggestions FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Durumu yalnızca admin değiştirir.
DROP POLICY IF EXISTS "Admins review suggestions" ON public.pitch_suggestions;
CREATE POLICY "Admins review suggestions"
  ON public.pitch_suggestions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Saha ekleme yetkisi: pitches tablosunda UPDATE politikaları vardı ama INSERT
-- politikası yoktu, yani uygulama içinden saha eklenemiyordu (RLS reddediyordu).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pitches') THEN
    DROP POLICY IF EXISTS "Admins can insert pitches" ON public.pitches;
    CREATE POLICY "Admins can insert pitches"
      ON public.pitches FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
      );
  END IF;
END $$;
