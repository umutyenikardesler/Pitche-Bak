import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { supabase } from "@/services/supabase";

// Splash screen'i başlangıçta tut
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function Index() {
  const [target, setTarget] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (error) {
          console.log("Session error:", error.message);
          setTarget("/auth");
          return;
        }
        
        if (data?.session?.user) {
          setTarget("/(tabs)");
        } else {
          setTarget("/auth");
        }
      } catch (error) {
        if (!isMounted) return;
        console.log("Auth check error:", error);
        setTarget("/auth");
      } finally {
        if (isMounted) {
          setIsLoading(false);
          // Splash screen'i gizle
          SplashScreen.hideAsync().catch(() => {});
        }
      }
    };

    // Kısa bir gecikme ile auth kontrolü yap (React'in render'ını tamamlaması için)
    const timer = setTimeout(() => {
      checkAuth();
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (target) {
    return <Redirect href={target as any} />;
  }

  // Yükleniyor ekranı (sadece kısa bir süre)
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#ffffff",
      }}
    >
      <ActivityIndicator size="large" color="#16a34a" />
    </View>
  );
}
