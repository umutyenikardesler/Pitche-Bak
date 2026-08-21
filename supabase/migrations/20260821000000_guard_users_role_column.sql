-- GÜVENLİK: users.role sütununu istemci tarafından değiştirilmeye karşı koru.
--
-- SORUN
-- 20260303000002 ile users tablosuna `role` sütunu eklendi ve content_reports,
-- user_blocks, pitches politikaları `role = 'admin'` kontrolüne bağlandı.
-- Ancak users üzerindeki politikalar sütun ayrımı yapmıyor:
--
--   UPDATE ... USING (auth.uid() = id) WITH CHECK (auth.uid() = id)
--   INSERT ... WITH CHECK (auth.uid() = id AND auth.uid() IS NOT NULL)
--
-- Yani herhangi bir oturum açmış kullanıcı, anon anahtarla:
--   UPDATE users SET role = 'admin' WHERE id = auth.uid();
-- ya da satırı henüz yoksa:
--   INSERT INTO users (id, role) VALUES (auth.uid(), 'admin');
-- çalıştırıp kendini admin yapabiliyordu. Kazanılan yetkiler:
--   * content_reports: tüm şikayetleri görme ve güncelleme
--   * user_blocks:     tüm engelleri güncelleme
--   * pitches:         tüm sahaları güncelleme
--
-- ÇÖZÜM
-- role sütununa dokunan INSERT/UPDATE'leri bir BEFORE trigger'ı ile süz.
-- Politikaları değiştirmiyoruz: kullanıcı kendi satırının diğer alanlarını
-- (name, surname, age, ...) eskisi gibi güncellemeye devam eder.
--
-- Trigger'ın izin verdiği tek meşru durumlar:
--   1. JWT yok            -> migration / psql / sunucu tarafı trigger zinciri
--   2. JWT role=service_role -> edge function veya admin backend
--   3. Çağıran zaten admin   -> admin başka birine rol atayabilir
-- Diğer her durumda 42501 (insufficient_privilege) ile reddedilir.

-- ---------------------------------------------------------------------------
-- 1) Admin kontrolü için yardımcı fonksiyon
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: kontrolün users üzerindeki RLS politikalarından bağımsız
-- olması için. Aksi halde ileride users SELECT politikası daraltılırsa bu
-- kontrol sessizce false dönmeye başlar ve adminler rol atayamaz hale gelir.
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = uid AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) role sütununu koruyan trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_users_role_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims text := current_setting('request.jwt.claims', true);
  jwt_role   text;
BEGIN
  -- role fiilen değişmiyorsa dokunma.
  -- INSERT'te sütun atlanırsa DEFAULT 'user' gelir; bu da bir yükseltme değil.
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS NULL OR NEW.role = 'user' THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.role IS NOT DISTINCT FROM OLD.role THEN
    RETURN NEW;
  END IF;

  -- (1) JWT yok: migration, psql veya handle_new_user gibi sunucu tarafı akış.
  IF jwt_claims IS NULL OR jwt_claims = '' THEN
    RETURN NEW;
  END IF;

  -- Bozuk/beklenmedik claim formatı trigger'ı patlatmasın; NULL kabul edip
  -- aşağıdaki admin kontrolüne düşsün (fail-closed).
  BEGIN
    jwt_role := (jwt_claims::jsonb) ->> 'role';
  EXCEPTION WHEN others THEN
    jwt_role := NULL;
  END;

  -- (2) service_role anahtarı: sunucu tarafı, serbest.
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- (3) Çağıran zaten admin ise rol atamasına izin ver.
  IF public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Yetkisiz işlem: users.role sütunu değiştirilemez'
    USING ERRCODE = '42501';
END;
$$;

-- `UPDATE OF role`: sütun UPDATE ifadesinde anılmıyorsa trigger hiç çalışmaz,
-- yani normal profil güncellemelerine ek maliyet getirmez.
DROP TRIGGER IF EXISTS guard_users_role ON public.users;
CREATE TRIGGER guard_users_role
  BEFORE INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_users_role_column();

-- ---------------------------------------------------------------------------
-- 3) role için değer kısıtı (yazım hatası / beklenmedik değer koruması)
-- ---------------------------------------------------------------------------
-- Mevcut veride 'user'/'admin' dışında bir değer varsa constraint eklenmez ve
-- migration kırılmaz; bunun yerine uyarı basılır.
DO $$
DECLARE
  invalid_count integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_role_allowed_values'
      AND conrelid = 'public.users'::regclass
  ) THEN
    RETURN;
  END IF;

  SELECT count(*) INTO invalid_count
  FROM public.users
  WHERE role IS NULL OR role NOT IN ('user', 'admin');

  IF invalid_count > 0 THEN
    RAISE NOTICE 'users.role içinde beklenmeyen % satır var; CHECK constraint atlandı.', invalid_count;
    RETURN;
  END IF;

  ALTER TABLE public.users
    ADD CONSTRAINT users_role_allowed_values CHECK (role IN ('user', 'admin'));
END $$;

-- ---------------------------------------------------------------------------
-- Doğrulama (elle çalıştır)
-- ---------------------------------------------------------------------------
-- Normal bir kullanıcının oturumunda (anon anahtar + kullanıcı JWT'si)
-- aşağıdaki iki sorgu da 42501 vermelidir:
--
--   update users set role = 'admin' where id = auth.uid();
--   insert into users (id, role) values (auth.uid(), 'admin');
--
-- Aynı oturumda bu ise başarılı olmalıdır (role'e dokunmuyor):
--
--   update users set name = 'Test' where id = auth.uid();
--
-- Mevcut adminlerin etkilenmediğini görmek için:
--
--   select id, email, role from users where role = 'admin';
