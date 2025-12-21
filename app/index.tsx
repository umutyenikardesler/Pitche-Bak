import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator, Text } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "@/services/supabase";

// Splash screen'i başlangıçta tut
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("Başlatılıyor...");

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        if (isMounted) setDebugInfo("Supabase bağlantısı kontrol ediliyor...");
        
        // Timeout ile supabase çağrısı
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 3000)
        );
        
        const sessionPromise = supabase.auth.getSession();
        
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        if (!isMounted) return;
        
        const session = result?.data?.session;
        setDebugInfo(session ? "Oturum bulundu, yönlendiriliyor..." : "Oturum yok, giriş sayfasına...");
        setTarget(session?.user ? "/(tabs)" : "/auth");
      } catch (error) {
        if (!isMounted) return;
        const errorMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
        setDebugInfo(`Hata: ${errorMsg} - Giriş sayfasına yönlendiriliyor...`);
        // Hata olsa bile auth sayfasına yönlendir
        setTarget("/auth");
      } finally {
        // Splash screen'i gizle
        SplashScreen.hideAsync().catch(() => {});
      }
    };

    // 2 saniye sonra hala target yoksa zorla auth'a gönder
    const fallbackTimer = setTimeout(() => {
      if (isMounted && !target) {
        setDebugInfo("Fallback: Giriş sayfasına yönlendiriliyor...");
        setTarget("/auth");
        SplashScreen.hideAsync().catch(() => {});
      }
    }, 2000);

    // Küçük bir gecikme ile başlat (React render'ın tamamlanması için)
    setTimeout(() => {
      checkAuth();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (target) {
    return <Redirect href={target as any} />;
  }

  // Buraya düşersek: route daha belirlenmedi, ekranda debug göster
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#16a34a",
        paddingHorizontal: 16,
      }}
    >
      <ActivityIndicator size="large" color="#ffffff" />
      <Text style={{ marginTop: 12, color: "#ffffff", fontWeight: "600", fontSize: 18 }}>
        Pitche-Bak
      </Text>
      <Text style={{ marginTop: 8, color: "#ffffff", textAlign: "center", fontSize: 12 }}>
        {debugInfo}
      </Text>
    </View>
  );
}
