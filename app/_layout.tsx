import '@/global.css';
import { Stack, usePathname, useGlobalSearchParams } from "expo-router";
import { LogBox, Platform, View, AppState, Linking } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useRouter, useRootNavigationState } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { NotificationProvider } from '@/components/NotificationContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { GuestAuthModalProvider } from '@/contexts/GuestAuthModalContext';
import { ThemeProvider, useAppTheme } from '@/contexts/ThemeContext';
import AnalyticsProvider from '@/components/AnalyticsProvider';
import { setPendingAuthUrl } from '@/lib/pendingAuthUrl';
import { setLastNonAuthRoute } from "@/lib/lastNonAuthRoute";
import { isAuthCallbackLocked, lockAuthCallbackFor } from "@/lib/authCallbackLock";
import { supabase } from "@/services/supabase";
import { registerPushToken, unregisterPushToken } from "@/services/pushNotifications";
import * as Notifications from "expo-notifications";
import LaunchLogoOverlay from "@/components/LaunchLogoOverlay";
import UpdateAvailableModal from "@/components/modals/UpdateAvailableModal";

// Sadece belirli logları ignore et, tüm logları değil
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'Default FirebaseApp is not initialized',
  'FirebaseApp',
  'expo-notifications',
]);

// Açılış geçişi uygulama başına bir kez oynasın (Fast Refresh'te tekrarlamasın).
let launchAnimationPlayed = false;

function AppShell() {
  const [showLaunchOverlay, setShowLaunchOverlay] = useState(!launchAnimationPlayed);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useGlobalSearchParams();
  const { colors } = useAppTheme();

  // Kök navigasyon ağacı hazır olana kadar `key` tanımsızdır; yönlendirme öncesi beklenir.
  const rootNavigationState = useRootNavigationState();
  const navigationReady = !!rootNavigationState?.key;
  // Soğuk açılıştaki bildirim yanıtı yalnızca bir kez işlensin.
  const coldStartHandledRef = useRef(false);
  const handledResponseIdRef = useRef<string | null>(null);

  // Push bildirimine dokunulduğunda bildirimler sayfasını aç.
  // Hem uygulama açıkken/arka plandayken (listener) hem de bildirimle soğuk açılışta
  // (getLastNotificationResponseAsync) çalışması gerekiyor.
  //
  // ÖNEMLİ: Navigasyon ağacı hazır olmadan router.push çağırmak soğuk açılışta beyaz
  // ekrana yol açıyor. Bu yüzden `navigationReady` beklenir. Ayrıca
  // getLastNotificationResponseAsync, uygulama bildirime dokunularak açılmasa da en son
  // yanıtı döndürebildiğinden, o yanıt yalnızca BİR KEZ ve kimliğine göre işlenir.
  useEffect(() => {
    if (!navigationReady) return;

    let isMounted = true;

    // Bildirim tipine göre hedef: mesaj bildirimi doğrudan ilgili sohbeti,
    // takip ve katılım istekleri bildirimler sayfasını açar.
    // Alanlar Edge Function'ın push yüküne koyduğu `data`dan okunuyor.
    const openForResponse = (response: Notifications.NotificationResponse) => {
      if (!isMounted) return;

      const data = (response?.notification?.request?.content?.data ?? {}) as {
        type?: string;
        senderId?: string | null;
        senderName?: string | null;
        matchId?: string | null;
      };

      if (data.type !== 'direct_message') {
        router.push('/notifications');
        return;
      }

      // Gönderen bilinmiyorsa sohbeti açamayız; mesaj listesine düşüyoruz.
      if (!data.senderId) {
        router.push('/message');
        return;
      }

      router.push({
        pathname: '/message/chat',
        params: {
          to: data.senderId,
          name: data.senderName ?? '',
          ...(data.matchId ? { matchId: data.matchId } : {}),
        },
      });
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handledResponseIdRef.current = response?.notification?.request?.identifier ?? null;
      openForResponse(response);
    });

    (async () => {
      try {
        if (coldStartHandledRef.current) return;
        coldStartHandledRef.current = true;

        const last = await Notifications.getLastNotificationResponseAsync();
        const id = last?.notification?.request?.identifier ?? null;
        // Aynı yanıt listener tarafından zaten işlendiyse tekrar yönlendirme.
        if (last && id !== handledResponseIdRef.current) {
          handledResponseIdRef.current = id;
          openForResponse(last);
        }
      } catch (_) {}
    })();

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [navigationReady, router]);

  // Online kullanıcı sayısı için Realtime Presence.
  // Not: "anlık aktif kullanıcı" sayısı bu kanala bağlı olan unique user sayısıdır.
  useEffect(() => {
    let channel: any = null;
    let isMounted = true;
    let currentUserId: string | null = null;
    let appStateSub: any = null;

    const teardown = () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch (_) {}
      channel = null;
    };

    const setupForUser = async (userId: string) => {
      teardown();
      currentUserId = userId;
      channel = supabase.channel("online-users", {
        config: { presence: { key: userId } },
      });

      channel.subscribe(async (status: string) => {
        if (!isMounted) return;
        if (status !== "SUBSCRIBED") return;
        try {
          await channel.track({ online_at: new Date().toISOString() });
        } catch (_) {}
      });
    };

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id ?? null;
        if (!isMounted) return;
        if (userId) {
          await setupForUser(userId);
          try { await registerPushToken(userId); } catch (_) {}
        }
      } catch (_) {}
    })();

    // ÖNEMLİ: onAuthStateChange geri çağrısı içinde Supabase çağrısı beklenmemeli.
    // Geri çağrı auth kilidini tutuyor; içeride `await supabase...` yapmak signOut()'un
    // hiç çözülmemesine yol açıyordu (çıkışta ekran "Çıkış yapılıyor"da kalıyordu).
    // Bu yüzden ağ işlerini setTimeout ile kilidin dışına alıyoruz.
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const nextId = session?.user?.id ?? null;
      if (nextId === currentUserId) return;

      if (!nextId) {
        const previousId = currentUserId;
        currentUserId = null;
        teardown();
        if (previousId) {
          setTimeout(() => {
            unregisterPushToken(previousId).catch(() => {});
          }, 0);
        }
        return;
      }

      currentUserId = nextId;
      setTimeout(() => {
        if (!isMounted) return;
        setupForUser(nextId).catch(() => {});
        registerPushToken(nextId).catch(() => {});
      }, 0);
    });

    // App tekrar foreground olunca presence ping at (bazı cihazlarda bağlantı kesilebiliyor)
    try {
      appStateSub = AppState.addEventListener("change", async (st) => {
        if (!isMounted) return;
        if (st !== "active") return;
        try {
          if (channel) await channel.track({ online_at: new Date().toISOString() });
        } catch (_) {}
        if (currentUserId) {
          try { await registerPushToken(currentUserId); } catch (_) {}
        }
      });
    } catch (_) {}

    return () => {
      isMounted = false;
      try {
        authSub?.subscription?.unsubscribe?.();
      } catch (_) {}
      try {
        appStateSub?.remove?.();
      } catch (_) {}
      teardown();
    };
  }, []);

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
              <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center' }}>
                <View
                  style={{
                    flex: 1,
                    width: '50%',
                    minWidth: 360,
                    maxWidth: 520,
                    backgroundColor: colors.surface,
                    overflow: 'hidden',
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen
                      name="(tabs)"
                      options={{
                        // Giriş yaptıktan sonra tabs kök ekranından Landing'e swipe-back olmasın
                        // (detay ekranlar kendi stack'inde geri dönebilmeli)
                        gestureEnabled: false,
                      }}
                    />
                  </Stack>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1, backgroundColor: colors.background }}>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen
                  name="(tabs)"
                  options={{
                    // Giriş yaptıktan sonra tabs kök ekranından Landing'e swipe-back olmasın
                    // (detay ekranlar kendi stack'inde geri dönebilmeli)
                    gestureEnabled: false,
                  }}
                />
              </Stack>
              </View>
            )}

            {/* Açılış geçişi: logo ortadan header'daki yerine kayarken index arkada yüklenir. */}
            {showLaunchOverlay && (
              <LaunchLogoOverlay
                onDone={() => {
                  launchAnimationPlayed = true;
                  setShowLaunchOverlay(false);
                }}
              />
            )}

            {/* Mağazada yeni sürüm varsa açılışta uyarı. Açılış animasyonu
                bitmeden gösterilmiyor ki iki katman üst üste binmesin. */}
            {!showLaunchOverlay && <UpdateAvailableModal />}
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </NotificationProvider>
        </GuestAuthModalProvider>
    </AuthProvider>
    </LanguageProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
