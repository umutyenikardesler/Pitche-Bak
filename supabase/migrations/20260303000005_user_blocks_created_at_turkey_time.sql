-- user_blocks.created_at: Türkiye saati (UTC+3) olarak saklanacak (timestamp without time zone)
-- Böylece Supabase tablosunda doğru Türkiye saati görünür
ALTER TABLE public.user_blocks
  ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE
  USING created_at AT TIME ZONE 'UTC' + INTERVAL '3 hours';

ALTER TABLE public.user_blocks
  ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'UTC' + INTERVAL '3 hours')::timestamp;
