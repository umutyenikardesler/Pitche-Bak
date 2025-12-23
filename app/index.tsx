import { Redirect } from "expo-router";

/**
 * NOT:
 * Native (Android / iOS) release build'lerinde beyaz ekran sorununu
 * izole etmek için giriş akışını OLDUKÇA basitleştiriyoruz.
 *
 * Şu an sadece her zaman /auth ekranına yönlendiriyoruz.
 * (Yani uygulama açılır açılmaz direkt giriş ekranı gelecek.)
 *
 * Bu ekranda artık:
 * - SplashScreen kontrolü yok
 * - Supabase.session kontrolü yok
 * - AsyncStorage erişimi yok
 *
 * Böylece olası native / Hermes / Supabase kaynaklı hataları
 * başlangıçtan tamamen çıkarmış oluyoruz.
 */

export default function Index() {
  return <Redirect href="/auth" />;
}
