import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { supabase } from '@/services/supabase';
import * as SplashScreen from 'expo-splash-screen';

// Splash screen'i açık tut
SplashScreen.preventAutoHideAsync();

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("Auth kontrolü başlatılıyor...");
        
        // Supabase session kontrolü yap
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session hatası:", error);
        }
        
        console.log("Session kontrolü tamamlandı, session:", session ? "var" : "yok");
        
        // Splash screen'i önce kapat
        try {
          await SplashScreen.hideAsync();
          console.log("Splash screen kapatıldı");
        } catch (e) {
          console.error("Splash screen kapatma hatası:", e);
        }
        
        // Kısa bir gecikme ile yönlendirme yap (router'ın hazır olması için)
        setTimeout(() => {
          if (session && session.user) {
            console.log("Kullanıcı oturum açmış, ana sayfaya yönlendiriliyor...");
            router.replace("/(tabs)/index" as any);
          } else {
            console.log("Kullanıcı oturum açmamış, auth sayfasına yönlendiriliyor...");
            router.replace("/auth" as any);
          }
          setLoading(false);
        }, 100);
      } catch (error) {
        console.error("Auth kontrolü hatası:", error);
        // Hata durumunda splash screen'i kapat ve auth sayfasına yönlendir
        try {
          await SplashScreen.hideAsync();
        } catch (e) {
          console.error("Splash screen kapatma hatası:", e);
        }
        setTimeout(() => {
          router.replace("/auth" as any);
          setLoading(false);
        }, 100);
      }
    };

    // Kısa bir gecikme ile auth kontrolü yap (splash screen görünsün)
    const timer = setTimeout(() => {
      checkAuth();
    }, 500);

    return () => clearTimeout(timer);
  }, [router]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return null; // Eğer yönlendirme oluyorsa, bu ekran hiç gösterilmeyecek
}
