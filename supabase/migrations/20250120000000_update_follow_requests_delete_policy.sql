-- follow_requests tablosu için DELETE ve UPDATE policy'lerini güncelle
-- Hem follower_id (istek gönderen) hem de following_id (istek alan) kendi isteklerini silebilmeli ve güncelleyebilmeli

-- Mevcut DELETE policy'yi sil (eğer varsa)
DROP POLICY IF EXISTS "Kullanıcılar kendi takip isteklerini silebilir" ON public.follow_requests;

-- Yeni DELETE policy oluştur: Hem follower_id hem de following_id silebilmeli
CREATE POLICY "Kullanıcılar kendi takip isteklerini silebilir"
    ON public.follow_requests
    FOR DELETE
    USING (
        (auth.uid() = follower_id) OR  -- İstek gönderen kendi isteğini silebilir
        (auth.uid() = following_id)    -- İstek alan kendi isteğini silebilir (reddetme durumu)
    );

-- Mevcut UPDATE policy'yi sil (eğer varsa)
DROP POLICY IF EXISTS "Kullanıcılar kendi takip isteklerini güncelleyebilir" ON public.follow_requests;

-- Yeni UPDATE policy oluştur: Hem follower_id hem de following_id güncelleyebilmeli
CREATE POLICY "Kullanıcılar kendi takip isteklerini güncelleyebilir"
    ON public.follow_requests
    FOR UPDATE
    USING (
        (auth.uid() = follower_id) OR  -- İstek gönderen kendi isteğini güncelleyebilir
        (auth.uid() = following_id)    -- İstek alan kendi isteğini güncelleyebilir (kabul durumu)
    )
    WITH CHECK (
        (auth.uid() = follower_id) OR  -- İstek gönderen kendi isteğini güncelleyebilir
        (auth.uid() = following_id)    -- İstek alan kendi isteğini güncelleyebilir (kabul durumu)
    );

