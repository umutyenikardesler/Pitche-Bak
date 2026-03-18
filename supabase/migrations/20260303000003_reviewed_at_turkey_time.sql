-- reviewed_at: Türkiye saati (UTC+3) olarak saklanacak (timestamp without time zone)
-- Böylece Supabase tablosunda doğru Türkiye saati görünür
ALTER TABLE public.content_reports
  ALTER COLUMN reviewed_at TYPE TIMESTAMP WITHOUT TIME ZONE
  USING reviewed_at AT TIME ZONE 'UTC' + INTERVAL '3 hours';
