# SahayaBak

Halı saha maçı bulma ve oluşturma uygulaması. Kullanıcılar maç oluşturur, eksik
mevkilere oyuncu arar, birbirini takip eder ve mesajlaşır.

iOS, Android ve web'de tek kod tabanından çalışır.

## Teknoloji

| Katman | Seçim |
| --- | --- |
| Uygulama | Expo SDK 54, React Native 0.81, React 19 |
| Yönlendirme | expo-router (dosya bazlı, `app/`), typed routes açık |
| Stil | NativeWind 4 + Tailwind 3 (`global.css`, `tailwind.config.js`) |
| Backend | Supabase (Postgres + RLS, Auth, Realtime, Storage, Edge Functions) |
| Bildirim | expo-notifications + Expo Push, `send-push-notification` edge function |
| Harita | react-native-maps (native), Leaflet (web) |
| Build | EAS Build |

## Başlarken

```bash
npm install          # .npmrc: legacy-peer-deps=true
npx expo start       # Metro
```

Uygulama Expo Go'da tam çalışmaz — push bildirimleri, Apple Sign-In, AdMob ve
haritalar native modül gerektirir. Geliştirme için **development build** kullan:

```bash
npm run android      # expo run:android
npm run ios          # expo run:ios
npm run web          # expo start --web
```

## Proje yapısı

```
app/                    expo-router ekranları
  (tabs)/               ana sekmeler: index, pitches, create, message,
                        profile, notifications (+ guest-landing)
  auth/                 giriş, kayıt, e-posta onayı, şifre sıfırlama, OAuth callback
  match/[id].tsx        maç paylaşım linki (deep link) hedefi
  message/chat.tsx      birebir sohbet
  admin/reports.tsx     içerik şikayeti paneli (users.role = 'admin')
components/             özellik bazlı; matchDetails/ kendi hooks/ + components/ ayrımıyla
contexts/               Auth, Theme (dark mode), Language, GuestAuthModal
  translations/         tr.ts / en.ts — çeviri sözlükleri
services/               supabase istemcisi, analytics, push, blocks, contentReports
lib/                    auth akışı yardımcıları (deep link kilidi, şifre politikası, JWT)
supabase/
  migrations/           şema + RLS politikaları
  functions/            Deno edge functions
scripts/                dev/prod native variant konfigürasyonu
web/                    sahayabak.com için statik export + yasal sayfalar
```

## Dev / Prod varyantları

Aynı cihazda iki build yan yana durabilir. `APP_VARIANT` ortam değişkeni
`app.config.js` üzerinden isim, scheme ve bundle id'yi belirler:

| | prod (varsayılan) | dev |
| --- | --- | --- |
| Ad | SahayaBak | SahayaBak Dev |
| Scheme | `myapp` | `myapp-dev` |
| iOS bundle | `com.tumurelsedrakiney.PitcheBak` | `...PitcheBak.dev` |
| Android package | `com.tumurelsedrakiney.pitchebak` | `...pitchebak.dev` |

Native projeleri (`android/`, `ios/`) varyanta göre ayarlamak için:

```bash
npm run native:dev
npm run native:prod
```

Bu script EAS'te `eas-build-pre-install` / `post-install` hook'u olarak da
otomatik çalışır.

## Build

```bash
eas build --profile development --platform android   # dev client, apk
eas build --profile preview     --platform android   # prod varyantı, apk
eas build --profile production  --platform android   # aab (store)
eas build --profile production  --platform ios
```

Profiller `eas.json`'da. Sürüm numarası uzaktan yönetiliyor
(`cli.appVersionSource: "remote"`), production'da `autoIncrement` açık.

`android/` ve `ios/` dizinleri **bilerek git'te tutuluyor** — EAS yüklemesinin
`gradlew` gibi dosyaları atlamaması için. `.gitignore`'da yalnızca build
çıktıları hariç tutulmuş durumda.

## Supabase

Şema değişiklikleri `supabase/migrations/` altında zaman damgalı SQL dosyaları.
RLS tüm kullanıcı tablolarında açık; yeni tablo eklerken politikayı aynı
migration'da tanımla.

Push bildirimi akışı: `notifications` tablosuna INSERT → pg_net trigger →
`send-push-notification` edge function → Expo Push API. Fonksiyon
`SUPABASE_SERVICE_ROLE_KEY`'i ortamdan okur, repoda anahtar tutulmaz.

Edge function deploy:

```bash
supabase functions deploy send-push-notification
```

İşletme notları ve sorun giderme: `docs/`.

## Çeviri ekleme

`contexts/translations/tr.ts` kaynak dil. Oraya bir anahtar eklediğinde
`en.ts`'e de eklemek zorunlu — `en.ts`, `Record<TranslationKey, string>` olarak
tiplendiği için eksik anahtar derleme hatası verir.

## Kalite

```bash
npx tsc --noEmit     # tip kontrolü
npm run lint         # expo lint
```

`tsc` çıktısında `node_modules/expo-file-system` ve
`supabase/functions/**` (Deno globalleri) kaynaklı hatalar beklenen gürültüdür;
uygulama kodu hatasız olmalı.

> Otomatik test yok. `jest` + `jest-expo` kurulu ve `npm test` tanımlı, ancak
> henüz test dosyası bulunmuyor.
