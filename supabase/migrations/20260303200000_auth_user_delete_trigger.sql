-- Auth users silinmeden önce tüm referansları temizle (Dashboard'dan silme hatasını giderir)
-- "Failed to delete user: Database error deleting user" hatası genelde şunlardan kaynaklanır:
-- 1. public.users (ve ilişkili tablolar)
-- 2. storage.objects (owner/owner_id - profil/maç resimleri)
CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. storage.objects: owner/owner_id referansını kaldır (FK engelini önler)
  --    Dosyalar silinmez, sadece owner null yapılır. owner_id text, owner uuid olabilir.
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'storage' AND table_name = 'objects' AND column_name = 'owner') THEN
      UPDATE storage.objects SET owner = NULL WHERE owner = OLD.id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'storage' AND table_name = 'objects' AND column_name = 'owner_id') THEN
      UPDATE storage.objects SET owner_id = NULL WHERE owner_id = OLD.id::text;
    END IF;
  END IF;

  -- 2. public.users'dan sil (CASCADE ile messages, notifications, user_blocks vb. temizlenir)
  DELETE FROM public.users WHERE id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_before_delete ON auth.users;
CREATE TRIGGER on_auth_user_before_delete
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_delete();
