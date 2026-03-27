import '@/global.css';
import { Stack, usePathname, useGlobalSearchParams } from "expo-router";
import { LogBox, Platform, View } from "react-native";
import { Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { NotificationProvider } from '@/components/NotificationContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { GuestAuthModalProvider } from '@/contexts/GuestAuthModalContext';
import AnalyticsProvider from '@/components/AnalyticsProvider';
import { setPendingAuthUrl } from '@/lib/pendingAuthUrl';
import { setLastNonAuthRoute } from "@/lib/lastNonAuthRoute";
import { isAuthCallbackLocked, lockAuthCallbackFor } from "@/lib/authCallbackLock";

// Sadece belirli logları ignore et, tüm logları değil
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();

  // Arka plandayken gelen auth callback URL'sini yakala
  useEffect(() => {
    let lastUrl: string | null = null;
    let lastAt = 0;
    const sub = Linking.addEventListener("url", (e) => {
      if (!e.url) return;
      if (isAuthCallbackLocked()) return;
      // Reset-password ekranındayken duplicate deep link gelirse kullanıcı yazarken ekrandan atmasın
      if (pathname?.startsWith("/auth/reset-password")) return;

      // Bazı tarayıcılar deep link'i 2 kez tetikleyebilir → debounce (URL farklı bile olsa)
      const now = Date.now();
      if (now - lastAt < 2000) return;
      lastUrl = e.url;
      lastAt = now;

      if (e.url.includes("auth/callback") || e.url.includes("access_token") || e.url.includes("code=")) {
        // Aynı deep link bazen 2 kez gelir → root seviyesinde hemen kilitle
        lockAuthCallbackFor(8000);
        setPendingAuthUrl(e.url);
        router.replace("/auth/callback" as any);
      }
    });
    return () => sub.remove();
  }, [pathname, router]);

  // Auth ekranına nereden gelindiğini takip et (geri dönüş için)
  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/auth")) return;

    const qp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (v == null) continue;
      if (Array.isArray(v)) {
        for (const it of v) {
          if (it != null && `${it}`.length) qp.append(k, `${it}`);
        }
      } else if (`${v}`.length) {
        qp.set(k, `${v}`);
      }
    }
    const full = qp.toString() ? `${pathname}?${qp.toString()}` : pathname;
    setLastNonAuthRoute(full);
  }, [pathname, searchParams]);
  return (
    <LanguageProvider>
      <AuthProvider>
        <GuestAuthModalProvider>
        <NotificationProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AnalyticsProvider />
            {Platform.OS === 'web' ? (
              <View style={{ flex: 1, backgroundColor: '#f3f4f6', alignItems: 'center' }}>
                <View
                  style={{
                    flex: 1,
                    width: '50%',
                    minWidth: 360,
                    maxWidth: 520,
                    backgroundColor: '#ffffff',
                    overflow: 'hidden',
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderColor: '#e5e7eb',
                  }}
                >
                  <Stack screenOptions={{ headerShown: false }} />
                </View>
              </View>
            ) : (
              <Stack screenOptions={{ headerShown: false }} />
            )}
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </NotificationProvider>
        </GuestAuthModalProvider>
    </AuthProvider>
    </LanguageProvider>
  );
}
