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
        if (isMounted) setDebugInfo("Oturum kontrol ediliyor...");
        
        const { data, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          console.log("Session error:", error.message);
          setDebugInfo("Giriş sayfasına yönlendiriliyor...");
          setTarget("/auth");
          return;
        }
        
        if (data?.session?.user) {
          setDebugInfo("Oturum bulundu...");
          setTarget("/(tabs)");
        } else {
          setDebugInfo("Giriş sayfasına yönlendiriliyor...");
          setTarget("/auth");
        }
      } catch (error) {
        if (!isMounted) return;
        console.log("Auth check error:", error);
        setDebugInfo("Giriş sayfasına yönlendiriliyor...");
        setTarget("/auth");
      } finally {
        // Splash screen'i gizle
        SplashScreen.hideAsync().catch(() => {});
      }
    };

    // 3 saniye sonra hala target yoksa zorla auth'a gönder
    const fallbackTimer = setTimeout(() => {
      if (isMounted && !target) {
        console.log("Auth check timeout - redirecting to /auth");
        setTarget("/auth");
        SplashScreen.hideAsync().catch(() => {});
      }
    }, 3000);

    checkAuth();

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (target) {
    return <Redirect href={target as any} />;
  }

  // Yükleniyor ekranı
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
