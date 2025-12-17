-- Users tablosuna otomatik kullanıcı kaydı oluşturan trigger

-- Fonksiyon: auth.users tablosuna yeni kullanıcı eklendiğinde public.users tablosuna da ekle
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
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Eğer zaten varsa hata verme
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: auth.users tablosuna INSERT yapıldığında fonksiyonu çağır
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

