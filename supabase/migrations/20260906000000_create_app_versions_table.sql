-- Mağazadaki en güncel sürümün tek doğruluk kaynağı.
--
-- NEDEN: iOS için iTunes lookup API'si kullanılabiliyor ama yanıtı CDN'de
-- önbelleğe alındığı için yeni sürüm bir süre görünmeyebiliyor. Android tarafında
-- ise Google Play'in "en son sürüm" veren herkese açık bir API'si hiç yok.
-- Bu tablo ile sürüm yayınlarken tek satır güncelleniyor ve iki platform da
-- anında doğru bilgiyi görüyor.

CREATE TABLE IF NOT EXISTS public.app_versions (
  platform        TEXT PRIMARY KEY CHECK (platform IN ('ios', 'android')),
  latest_version  TEXT NOT NULL,
  -- Bu sürümün altındaki istemciler için güncelleme zorunlu sayılabilir.
  -- Şu an uygulama uyarıyı kapatılabilir gösteriyor; ileride kullanılmak üzere.
  min_supported_version TEXT,
  store_url       TEXT,
  -- Uyarı kartında gösterilecek özel açıklama; boşsa uygulamadaki varsayılan metin kullanılır.
  release_notes   TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Sürüm bilgisi gizli değil: giriş yapmamış kullanıcılar da (misafir modu)
-- güncelleme uyarısını görebilmeli.
DROP POLICY IF EXISTS "Anyone can read app versions" ON public.app_versions;
CREATE POLICY "Anyone can read app versions"
  ON public.app_versions FOR SELECT TO anon, authenticated
  USING (true);

-- Yazma yalnızca admin'e açık; sürüm yayınlarken bu satır güncellenir.
DROP POLICY IF EXISTS "Admins manage app versions" ON public.app_versions;
CREATE POLICY "Admins manage app versions"
  ON public.app_versions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
  );

-- Mevcut sürümle başlangıç kayıtları. Yeni sürüm yayınlarken `latest_version`
-- (gerekirse `release_notes`) güncellenmeli.
INSERT INTO public.app_versions (platform, latest_version, store_url)
VALUES
  ('ios', '2.1.0', NULL),
  ('android', '2.1.0', 'https://play.google.com/store/apps/details?id=com.tumurelsedrakiney.pitchebak')
ON CONFLICT (platform) DO NOTHING;
