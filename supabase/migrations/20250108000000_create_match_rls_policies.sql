-- Match tablosu için RLS politikaları

-- RLS'yi etkinleştir
ALTER TABLE public.match ENABLE ROW LEVEL SECURITY;

-- SELECT: Herkes maçları görebilir
CREATE POLICY "Herkes maçları görebilir"
    ON public.match
    FOR SELECT
    USING (true);

-- INSERT: Sadece authenticated kullanıcılar maç oluşturabilir
CREATE POLICY "Authenticated kullanıcılar maç oluşturabilir"
    ON public.match
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Sadece maç sahibi kendi maçını güncelleyebilir
CREATE POLICY "Maç sahibi kendi maçını güncelleyebilir"
    ON public.match
    FOR UPDATE
    USING (auth.uid() = create_user)
    WITH CHECK (auth.uid() = create_user);

-- DELETE: Sadece maç sahibi kendi maçını silebilir
CREATE POLICY "Maç sahibi kendi maçını silebilir"
    ON public.match
    FOR DELETE
    USING (auth.uid() = create_user);
