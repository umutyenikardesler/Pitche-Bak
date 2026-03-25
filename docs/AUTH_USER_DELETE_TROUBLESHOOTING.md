# Auth Kullanıcı Silme Hatası – Çözüm Kılavuzu

## Hata
```
Failed to delete selected users: Database error deleting user
```

## 1. Migration'ı uygula
Önce `20260303200000_auth_user_delete_trigger.sql` migration'ının çalıştığından emin ol:

```bash
npx supabase db push
```

veya Supabase Dashboard → SQL Editor üzerinden migration dosyasının içeriğini çalıştır.

## 2. Hâlâ hata alıyorsan: Engellemeyi bul

**Nerede:** Supabase Dashboard → projen → sol menü **SQL Editor** → Yeni sorgu aç.

Bu sorguyu yapıştır ve **Run** (veya Ctrl+Enter) ile çalıştır:

```sql
-- auth.users'a referans veren tüm foreign key'leri listele
SELECT
  c.conname AS constraint_name,
  c.conrelid::regclass AS referencing_table,
  a.attname AS referencing_column,
  confrelid::regclass AS referenced_table,
  CASE c.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY (c.confkey)
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass
ORDER BY referencing_table;
```

**Alternatif:** Projede `supabase/diagnostic_auth_delete_fk.sql` dosyası var; içeriğini kopyalayıp SQL Editor'e yapıştırabilirsin.

`on_delete` değeri `NO ACTION` veya `RESTRICT` olan satırlar silmeyi engelliyor olabilir.

## 3. Yaygın engeller ve çözümleri

### storage.objects (profil/maç resimleri)
Uygulama `pictures` bucket'ına resim yüklüyor. Kullanıcı silmeden önce bu tablodaki referanslar temizlenmeli. Bu işlem migration içindeki trigger ile otomatik yapılıyor.

### Geçici çözüm: SQL Editor ile sil
Dashboard'dan silme işlemi başarısız olursa, SQL Editor'de doğrudan şunu deneyebilirsin:

```sql
-- Kullanıcı ID'sini değiştir
DELETE FROM auth.users WHERE id = 'BURAYA-USER-UUID-YAZ';
```

Trigger varsa bu sorgu çalıştığında `public.users` ve `storage.objects` referansları otomatik temizlenir.

## 4. Trigger kontrolü
Trigger gerçekten kurulmuş mu kontrol et:

```sql
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;
```

`on_auth_user_before_delete` görünüyorsa trigger aktif demektir.
