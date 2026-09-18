-- Mesaj tepkileri (emoji).
--
-- Neden ayrı tablo: `messages` satırını RLS gereği yalnızca GÖNDEREN
-- güncelleyebiliyor; tepkiyi ise mesajın ALICISI veriyor. Tepki mesaj satırına
-- yazılamadığı için kendi tablosunda duruyor.
--
-- Kural: tepkiyi yalnızca mesajın alıcısı verir (karşı tarafın mesajına), kişi
-- başına mesaj başına tek tepki. Mesajın iki tarafı da tepkiyi görür.

CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id  UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Serbest metin yazılmasın diye kısa tutuluyor (bileşik emojiler birkaç karakter).
  emoji       TEXT NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Birincil anahtar hem "tek tepki" kuralını sağlıyor hem de realtime DELETE
  -- olaylarında hangi tepkinin silindiğinin bilinmesini (eski kayıt yalnızca
  -- birincil anahtarı taşıyor).
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Okuma: mesajın iki tarafı da tepkiyi görür.
DROP POLICY IF EXISTS "Participants can read reactions" ON public.message_reactions;
CREATE POLICY "Participants can read reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
    )
  );

-- Ekleme: yalnızca kendi adına ve yalnızca SANA gelen mesaja.
DROP POLICY IF EXISTS "Recipient can react" ON public.message_reactions;
CREATE POLICY "Recipient can react"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.recipient_id = auth.uid()
    )
  );

-- Değiştirme (upsert'in güncelleme yolu da buradan geçer).
DROP POLICY IF EXISTS "Recipient can change own reaction" ON public.message_reactions;
CREATE POLICY "Recipient can change own reaction"
  ON public.message_reactions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.recipient_id = auth.uid()
    )
  );

-- Kaldırma: yalnızca kendi tepkisi.
DROP POLICY IF EXISTS "Users can remove own reaction" ON public.message_reactions;
CREATE POLICY "Users can remove own reaction"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Realtime: gönderen, mesajına bırakılan tepkiyi sohbet açıkken anında görsün.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'message_reactions'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
  END IF;
END $$;
