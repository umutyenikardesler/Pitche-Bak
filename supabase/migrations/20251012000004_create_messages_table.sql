-- Messages table for direct chat between users (optionally scoped to a match)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NULL REFERENCES public.match(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  read_at TIMESTAMPTZ NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Select: either party can read
CREATE POLICY "Users read their conversations"
  ON public.messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Insert: only as sender
CREATE POLICY "Users send messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND auth.uid() IS NOT NULL);

-- Update (mark read): only recipient can update their messages
CREATE POLICY "Recipient can mark as read"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS messages_participants_idx
  ON public.messages (sender_id, recipient_id, created_at);

CREATE INDEX IF NOT EXISTS messages_recipient_created_idx
  ON public.messages (recipient_id, created_at);

CREATE INDEX IF NOT EXISTS messages_match_idx
  ON public.messages (match_id);

