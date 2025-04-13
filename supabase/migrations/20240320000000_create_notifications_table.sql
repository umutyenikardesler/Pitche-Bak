-- Bildirimler tablosunu oluştur
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT notifications_type_check CHECK (type IN ('follow_request'))
);

-- Bildirimler tablosu için indeksler
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_sender_id_idx ON public.notifications(sender_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at);

-- RLS politikaları
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar sadece kendi bildirimlerini görebilir
CREATE POLICY "Kullanıcılar kendi bildirimlerini görebilir"
    ON public.notifications
    FOR SELECT
    USING (auth.uid() = user_id);

-- Kullanıcılar sadece kendi bildirimlerini güncelleyebilir
CREATE POLICY "Kullanıcılar kendi bildirimlerini güncelleyebilir"
    ON public.notifications
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Kullanıcılar sadece kendi bildirimlerini silebilir
CREATE POLICY "Kullanıcılar kendi bildirimlerini silebilir"
    ON public.notifications
    FOR DELETE
    USING (auth.uid() = user_id);

-- Bildirim oluşturma izni (sadece uygulama tarafından)
CREATE POLICY "Bildirim oluşturma izni"
    ON public.notifications
    FOR INSERT
    WITH CHECK (true); 