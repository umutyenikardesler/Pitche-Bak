-- Notifications tablosu için RLS policy'leri
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Herkes bildirimleri görebilir (kendi bildirimleri)
CREATE POLICY "Kullanıcılar kendi bildirimlerini görebilir"
    ON public.notifications
    FOR SELECT
    USING ((auth.uid() = user_id) OR (auth.uid() = sender_id));

-- Authenticated kullanıcılar bildirim oluşturabilir
CREATE POLICY "Authenticated kullanıcılar bildirim oluşturabilir"
    ON public.notifications
    FOR INSERT
    WITH CHECK ((auth.uid() = sender_id) AND (auth.uid() IS NOT NULL));

-- Kullanıcılar kendi bildirimlerini güncelleyebilir (is_read gibi)
CREATE POLICY "Kullanıcılar kendi bildirimlerini güncelleyebilir"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Kullanıcılar kendi bildirimlerini silebilir
CREATE POLICY "Kullanıcılar kendi bildirimlerini silebilir"
    ON public.notifications
    FOR DELETE
    USING ((auth.uid() = user_id) OR (auth.uid() = sender_id));
