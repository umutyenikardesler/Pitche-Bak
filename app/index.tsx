import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { supabase } from '@/services/supabase';
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const user = await AsyncStorage.getItem("user"); // Kullanıcı oturumu kontrol et
      if (user) {
        router.replace("/(tabs)/index"); // Kullanıcı varsa ana sayfaya yönlendir
      } else {
        router.replace("/auth"); // Kullanıcı yoksa kayıt ekranına yönlendir
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return null; // Eğer yönlendirme oluyorsa, bu ekran hiç gösterilmeyecek
}
