-- Notifications tablosundaki created_at sütununu Türkiye saati (UTC+3) olarak ayarla

-- Mevcut created_at sütununu Türkiye saati olarak güncelle
ALTER TABLE public.notifications 
ALTER COLUMN created_at SET DEFAULT timezone('Europe/Istanbul'::text, now());

-- Mevcut kayıtları Türkiye saatine çevir (UTC'den +3 saat ekle)
UPDATE public.notifications 
SET created_at = created_at + INTERVAL '3 hours';
