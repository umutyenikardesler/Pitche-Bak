# Supabase E-posta Şablonunu Türkçe Yapma

Şifremi unuttum e-postasını Türkçe göstermek için Supabase Dashboard'dan şablonu güncelleyin.

## Önemli: Redirect URL Yapılandırması

Mobil uygulama için şifre sıfırlama çalışması için Supabase Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs** bölümünde şu URL'lerin tanımlı olması gerekir:

- `myapp://auth/callback` (uygulama deep link)
- `https://sahayabak.com/auth/callback.html` (web aracı sayfası - hash fragment mobilde kaybolduğu için gerekli)

`app.json` içindeki `extra.webBaseUrl` değeri `https://sahayabak.com` olarak ayarlıdır.

## Adımlar

1. [Supabase Dashboard](https://app.supabase.com) → Projenizi seçin
2. **Authentication** → **Email Templates**
3. **Reset password** şablonunu seçin

## Türkçe Şablon

### Subject (Konu)
```
Şifrenizi Sıfırlayın
```

### Message body (Mesaj gövdesi)

```html
<h2>Şifrenizi Sıfırlayın</h2>

<p>Aşağıdaki bağlantıya tıklayarak şifrenizi sıfırlayabilirsiniz:</p>

<p><a href="{{ .ConfirmationURL }}">Şifremi Sıfırla</a></p>

<p>Bu bağlantı 24 saat içinde geçerliliğini yitirecektir.</p>

<p>Bu işlemi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
```

## Değişkenler

- `{{ .ConfirmationURL }}` - Şifre sıfırlama bağlantısı (mutlaka kullanın)
- `{{ .Email }}` - Kullanıcının e-posta adresi
- `{{ .SiteURL }}` - Uygulama site URL'si
- `{{ .Token }}` - 6 haneli OTP kodu (varsa)

Bu şablonu Supabase Email Templates sayfasındaki ilgili alanlara yapıştırın ve **Save** ile kaydedin.
