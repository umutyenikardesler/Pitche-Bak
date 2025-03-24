import { useEffect, useState, useCallback } from 'react';
import { Text, View, ScrollView, RefreshControl, Alert, TouchableOpacity } from 'react-native';
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from '@/services/supabase';

import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStatus from "@/components/profile/ProfileStatus";
import ProfileCondition from "@/components/profile/ProfileCondition";
import ProfileMatches from "@/components/profile/ProfileMatches";

export default function Profile() {
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [matches, setMatches] = useState([]); // Maçları saklayan state

  useEffect(() => {
    fetchUserData();
  }, [searchParams.userId]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchUserMatches();
    }, [])
  );

  // Kullanıcı verisini çek
  const fetchUserData = async () => {
    let userIdToFetch = searchParams.userId || (await supabase.auth.getUser()).data?.user?.id;
    if (!userIdToFetch) {
      console.error("Kullanıcı ID alınamadı!");
      return;
    }

    const { data: userInfo, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userIdToFetch)
      .single();

    if (error) {
      console.error("Kullanıcı bilgileri alınamadı:", error);
      return;
    }

    setUserData(userInfo);
    fetchUserMatches(userIdToFetch); // Kullanıcı verisi alındığında maçları çek
  };

  // Kullanıcının maçlarını çek
  const fetchUserMatches = async (userId) => {
    if (!userId) return;
    
    const { data, error } = await supabase
      .from("match")
      .select("*, pitches (name, districts (name))")
      .eq("create_user", userId)
      .order("date", { ascending: false });

    if (error) {
      console.error("Maçları çekerken hata oluştu:", error);
      setMatches([]);
    } else {
      setMatches(data || []);
    }
  };

  // Sayfayı yenileme işlemi
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Çıkış Yapılamadı", "Bir hata oluştu, lütfen tekrar deneyin.");
      console.error("Çıkış Hatası:", error.message);
    } else {
      router.replace("auth/"); // Çıkış yapınca giriş ekranına yönlendir.
    }
  };

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}>
      <View className="bg-white rounded-lg m-3 p-1 shadow-lg">
        <ProfileInfo userData={userData} />
        <ProfileStatus matchCount={matches.length} /> {/* ✅ Doğru matchCount gönderiyoruz */}
        <ProfileCondition matchCount={matches.length} /> {/* ✅ Doğru matchCount gönderiyoruz */}
        <ProfileMatches userData={userData} matches={matches} refreshing={refreshing} onRefresh={handleRefresh} />

        {/* Çıkış Butonu En Altta */}
        <View className="flex-1 justify-end bottom-0 pb-4">
          <TouchableOpacity onPress={handleLogout} className="bg-green-600 mx-4 rounded-lg">
            <Text className="text-white font-semibold text-center p-2">Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
