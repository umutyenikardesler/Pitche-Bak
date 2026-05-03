-- Push notification token'larını saklamak için tablo
-- Her kullanıcının birden fazla cihazı olabilir

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT CHECK (platform IN ('ios', 'android')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Kullanıcı kendi token'larını okuyabilir ve yazabilir
CREATE POLICY "User manages own push tokens"
  ON public.push_tokens FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Edge Function'ın tüm token'lara erişebilmesi için service_role okuyabilir
-- (service_role RLS bypass eder, bu policy ek güvence için)
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens (user_id);
