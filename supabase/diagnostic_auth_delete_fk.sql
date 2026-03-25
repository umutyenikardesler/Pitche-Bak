-- Bu dosyayı Supabase Dashboard → SQL Editor'de çalıştır
-- auth.users silmeyi engelleyen foreign key'leri listeler

SELECT
  c.conname AS constraint_name,
  c.conrelid::regclass AS referencing_table,
  a.attname AS referencing_column,
  CASE c.confdeltype
    WHEN 'a' THEN 'NO ACTION (engelliyor)'
    WHEN 'r' THEN 'RESTRICT (engelliyor)'
    WHEN 'c' THEN 'CASCADE (izin veriyor)'
    WHEN 'n' THEN 'SET NULL (izin veriyor)'
    WHEN 'd' THEN 'SET DEFAULT (izin veriyor)'
  END AS on_delete
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f'
  AND c.confrelid = 'auth.users'::regclass
ORDER BY referencing_table;
