# Supabase E-posta Rate Limit Nasıl Artırılır?

## Sorun

"Şifremi Unuttum" kullanırken "Çok fazla deneme yaptınız" (Email rate limit exceeded) hatası alıyorsanız, Supabase'in varsayılan e-posta limitine takılmışsınızdır.

## İki Tür Limit Var

| Limit | Açıklama | Değiştirilebilir mi? |
|-------|----------|----------------------|
| **Aynı kullanıcı** | Aynı e-posta adresi ~60 sn içinde tekrar istek atamaz | Evet – Dashboard'dan |
| **Proje geneli** | Tüm proje saatte X e-posta gönderebilir | Hayır (yerleşik SMTP ile) |

Farklı e-posta ile deneyip hala hata alıyorsanız **proje geneli limit** dolmuştur.

---

## Çözüm 1: Özel SMTP (Önerilen)

Supabase yerleşik SMTP yerine **Resend, SendGrid, Brevo** vb. kullanırsanız hem limitler artar hem de e-posta güvenilirliği iyileşir.

### Resend ile (Ücretsiz plan: 3000 e-posta/ay)

1. [Resend](https://resend.com) hesabı açın
2. **API Keys** → **Create API Key**
3. Domain doğrulayın (örn. `sahayabak.com`)
4. **Supabase Dashboard** → **Authentication** → **Providers** → **Email**
5. **SMTP Settings** bölümünde:
   - **Enable Custom SMTP**: Açık
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **User**: `resend`
   - **Password**: Resend API Key
   - **Sender email**: `noreply@sahayabak.com` (doğrulanmış domain)
   - **Sender name**: `SahayaBak`

6. **Save** ile kaydedin

Artık e-posta limitleri Resend planınıza göre uygulanır.

---

## Çözüm 2: Rate Limit Sürelerini Ayarlama

Aynı kullanıcının tekrar deneyebilmesi için bekleme süresini kısaltabilirsiniz:

1. **Supabase Dashboard** → **Authentication** → **Rate Limits**
2. **Password Reset** (veya benzeri) ayarında `period` değerini düşürün (saniye cinsinden)

Not: Bu sadece **aynı e-posta** için geçerlidir. Proje geneli saatlik limiti değiştirmez.

---

## Çözüm 3: Beklemek

Yerleşik SMTP kullanıyorsanız ve proje limiti dolmuşsa, bir süre (genellikle 1 saat) bekleyin. Limit saatlik pencerede yenilenir.
