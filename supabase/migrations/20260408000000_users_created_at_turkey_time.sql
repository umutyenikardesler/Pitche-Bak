-- public.users.created_at: Türkiye saati (UTC+3) olarak saklanacak
-- Not: Bu repo'da bazı tablolar created_at'ı "timestamp without time zone" olarak TR saatiyle saklıyor.
-- Bu migration da users.created_at için aynı yaklaşımı uygular ve auth->public.users trigger'ını günceller.

DO $$
DECLARE
  col_type text;
BEGIN
  -- created_at kolonu yoksa çık
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'created_at'
  ) THEN
    RETURN;
  END IF;

  SELECT data_type
  INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'created_at'
  LIMIT 1;

  -- timestamptz ise: UTC -> UTC+3 kaydırarak timestamp'a çevir
  IF col_type = 'timestamp with time zone' THEN
    EXECUTE $SQL$
      ALTER TABLE public.users
        ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE
        USING (created_at AT TIME ZONE 'UTC' + INTERVAL '3 hours');
    $SQL$;
  ELSE
    -- Zaten timestamp ise tip dönüşümü yapma
    EXECUTE $SQL$
      ALTER TABLE public.users
        ALTER COLUMN created_at TYPE TIMESTAMP WITHOUT TIME ZONE
        USING created_at;
    $SQL$;
  END IF;

  -- Default'u TR saati yap
  EXECUTE $SQL$
    ALTER TABLE public.users
      ALTER COLUMN created_at SET DEFAULT (now() AT TIME ZONE 'UTC' + INTERVAL '3 hours')::timestamp;
  $SQL$;

  -- Eski kullanıcılar:
  -- public.users.created_at geçmişte genelde auth.users.created_at ile aynı (UTC timestamp) yazıldı.
  -- Eğer bu eşitlik varsa, +3'e çevir. Zaten çevrilmişse eşitlik tutmaz, double-shift olmaz.
  UPDATE public.users u
  SET created_at = ((a.created_at AT TIME ZONE 'UTC') + INTERVAL '3 hours')::timestamp
  FROM auth.users a
  WHERE a.id = u.id
    AND u.created_at = (a.created_at AT TIME ZONE 'UTC')::timestamp;
END $$;

-- auth.users -> public.users trigger fonksiyonu da TR saati yazmalı
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, surname, age, height, weight, description, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    'Yeni Kullanıcı',
    '',
    NULL,
    NULL,
    NULL,
    '',
    (now() AT TIME ZONE 'UTC' + INTERVAL '3 hours')::timestamp
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

