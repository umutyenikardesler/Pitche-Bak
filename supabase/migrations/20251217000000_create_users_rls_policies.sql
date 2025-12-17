-- Users tablosu için RLS politikaları

-- RLS'yi etkinleştir (eğer zaten etkin değilse)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Mevcut policy'leri sil (eğer varsa, hata vermez)
DROP POLICY IF EXISTS "Herkes kullanıcıları görebilir" ON public.users;
DROP POLICY IF EXISTS "Kullanıcılar kendi kayıtlarını oluşturabilir" ON public.users;
DROP POLICY IF EXISTS "Kullanıcılar kendi bilgilerini güncelleyebilir" ON public.users;

-- SELECT: Herkes kullanıcıları görebilir (profil görüntüleme için)
CREATE POLICY "Herkes kullanıcıları görebilir"
    ON public.users
    FOR SELECT
    USING (true);

-- INSERT: Authenticated kullanıcılar sadece kendi kayıtlarını oluşturabilir
CREATE POLICY "Kullanıcılar kendi kayıtlarını oluşturabilir"
    ON public.users
    FOR INSERT
    WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL);

-- UPDATE: Kullanıcılar sadece kendi bilgilerini güncelleyebilir
CREATE POLICY "Kullanıcılar kendi bilgilerini güncelleyebilir"
    ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- DELETE: Kullanıcılar kendi hesaplarını silebilir (opsiyonel, gerekirse eklenebilir)
-- DROP POLICY IF EXISTS "Kullanıcılar kendi hesaplarını silebilir" ON public.users;
-- CREATE POLICY "Kullanıcılar kendi hesaplarını silebilir"
--     ON public.users
--     FOR DELETE
--     USING (auth.uid() = id);

