# Şifre Sıfırlama – Hosting Yapılandırması

## Klasör Yapısı ve Dosyalar

Hosting’e yükleyeceğiniz `web/` klasörünün yapısı:

```
web/
├── index.html              ← Ana sayfa (https://sahayabak.com/)
├── auth/
│   └── callback.html       ← Şifre sıfırlama yönlendirme sayfası
├── app/                    ← Expo export (dist) içeriği
│   ├── index.html
│   ├── auth/
│   │   ├── index.html
│   │   └── callback.html   (Expo route - karıştırmayın)
│   └── ...
├── images/
├── landing.css
└── ...
```

## Önemli Dosya: `web/auth/callback.html`

Bu dosya **şifre sıfırlama** ve **e-posta doğrulama (kayıt)** akışları için gereklidir:

- **Şifre sıfırlama:** Link → Supabase'de yeni şifre → bu sayfaya yönlendirme
- **E-posta doğrulama:** Kayıt sonrası doğrulama linki → bu sayfaya yönlendirme

Her iki akışta da Supabase kullanıcıyı `https://sahayabak.com/auth/callback.html#access_token=...` adresine yönlendirir; bu sayfa hash'i okuyup `myapp://auth/callback?access_token=...` ile uygulamayı açar.

## Hosting’e Yükleme

1. `web/` klasörünü hosting root’una yükleyin.
2. `web/auth/callback.html` dosyasının erişilebilir olduğundan emin olun.
3. Doğrulama: Tarayıcıda `https://sahayabak.com/auth/callback.html` adresine gidin; sayfa açılmalı (bağlantı geçersiz uyarısı normal, hash olmadığı için).

## Supabase Ayarları

**Authentication → URL Configuration → Redirect URLs** bölümüne ekleyin:

```
https://sahayabak.com/auth/callback.html
```

## Export Sonrası

`npx expo export -p web` çalıştırdığınızda:

- Export sonucu `dist/` klasörüne gelir
- Bu içeriği `web/app/` altına kopyalayın
- `web/auth/callback.html` dosyası manuel olarak duruyor; export sırasında değişmez
- Hosting’e `web/` klasörünü yükleyin

## Build + Deploy Script Örneği

```bash
# 1. Expo web export
npx expo export -p web

# 2. dist içeriğini web/app'e taşı (mevcut yapınıza uygun komut)
# Örn: Windows: xcopy dist\* web\app\ /E /Y
#      Mac/Linux: cp -r dist/* web/app/

# 3. web/auth/callback.html zaten web/ altında; hosting'e web/ yükleyin
```
