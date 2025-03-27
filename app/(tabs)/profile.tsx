import { useEffect, useState, useCallback } from 'react';
import {
  Text, View, ScrollView, RefreshControl, Alert, TouchableOpacity, Modal,
  TextInput, Image, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from '@/services/supabase';
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStatus from "@/components/profile/ProfileStatus";
import ProfileCondition from "@/components/profile/ProfileCondition";
import ProfileMatches from "@/components/profile/ProfileMatches";

export default function Profile() {
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [matches, setMatches] = useState([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [profileImage, setProfileImage] = useState({ uri: null });

  useEffect(() => {
    fetchUserData();
  }, [searchParams.userId]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchUserMatches();
    }, [])
  );

  const fetchLatestProfileImage = async (userId) => {
    console.log("fetchLatestProfileImage çağrıldı, userId:", userId); // Log eklendi
  
    if (!userId) {
      console.error("userId yok, fetchLatestProfileImage'den çıkılıyor."); // Log eklendi
      return null;
    }
  
    const { data, error } = await supabase.storage
      .from("pictures")
      .list(`${userId}/`, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });
  
    if (error) {
      console.error("Profil resmi alınamadı:", error); // Log eklendi
      return null;
    }
  
    if (!data || data.length === 0) {
      console.log("Profil resmi bulunamadı."); // Log eklendi
      return null;
    }
  
    const profileImages = data.filter((file) => file.name.startsWith("profile_"));
  
    if (profileImages.length === 0) {
      console.log("profile_ ile başlayan resim bulunamadı."); // Log eklendi
      return null;
    }
  
    const latestImage = profileImages[0];
    const filePath = `${userId}/${latestImage.name}`;
    const { data: publicURLData, error: publicUrlError } = supabase.storage.from("pictures").getPublicUrl(filePath);
  
    if (publicUrlError) {
      console.error("Public URL alınamadı:", publicUrlError); // Log eklendi
      return null;
    }
  
    console.log("En son profil resmi URL'si:", publicURLData.publicUrl); // Log eklendi
    return publicURLData.publicUrl;
  };

  // Kullanıcı verisini çek
  const fetchUserData = async () => {
    console.log("fetchUserData çağrıldı"); // Log eklendi
  
    let userIdToFetch = searchParams.userId || (await supabase.auth.getUser()).data?.user?.id;
    if (!userIdToFetch) {
      console.error("Kullanıcı ID alınamadı!"); // Log eklendi
      return;
    }
  
    const { data: userInfo, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userIdToFetch)
      .single();
  
    if (error) {
      console.error("Kullanıcı bilgileri alınamadı:", error); // Log eklendi
      return;
    }
  
    const latestProfileImage = await fetchLatestProfileImage(userIdToFetch);
    if (latestProfileImage) {
      userInfo.profile_image = latestProfileImage;
    }
  
    console.log("Kullanıcı verisi:", userInfo); // Log eklendi
    setUserData(userInfo);
    fetchUserMatches(userIdToFetch);
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

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const fileName = `profile_${Date.now()}.jpg`;
      const filePath = `${userData.id}/${fileName}`;

      const { error } = await supabase.storage.from("pictures").upload(filePath, { uri, type: "image/jpeg", name: fileName });

      if (error) {
        Alert.alert("Hata", "Resim yüklenirken bir hata oluştu.");
        return;
      }

      const { data: publicURLData } = supabase.storage.from("pictures").getPublicUrl(filePath);
      setProfileImage({ uri: publicURLData.publicUrl });
  
      await supabase.from("users").update({ profile_image: publicURLData.publicUrl }).eq("id", userData.id);
      fetchUserData();
      Alert.alert("Başarılı", "Resminiz başarıyla yüklendi!"); // Başarılı uyarı eklendi
  
    }
  };

  const handleSave = async () => {
    const { error } = await supabase.from("users").update(userData).eq("id", userData.id);
    if (!error) {
      setEditModalVisible(false);
      fetchUserData();
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
      Alert.alert("Çıkış Yapılamadı", "Bir hata oluştu.");
    } else {
      router.replace("auth/");
    }
  };

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchUserData} />}>
      <View className='flex-1'>
        <View className='flex-1 bg-white rounded-lg m-3 p-1 shadow-lg'>
            <ProfileInfo
              userData={userData}
              fetchUserData={fetchUserData}
              setModalVisible={setModalVisible}
              setEditModalVisible={setEditModalVisible}
              pickImage={pickImage}
            />
            <ProfileStatus matchCount={matches.length} />
            <ProfileCondition matchCount={matches.length} />
            <ProfileMatches userData={userData} matches={matches} refreshing={refreshing} onRefresh={fetchUserData} />
          <View className="flex-1 pb-4">
            <TouchableOpacity onPress={handleLogout} className="bg-green-600 mx-4 rounded-lg">
              <Text className="text-white font-semibold text-center p-2">Çıkış Yap</Text>
            </TouchableOpacity>
          </View>

        </View>
        {/* 🔹 PROFİL FOTOĞRAFI MODALI */}
        <Modal visible={modalVisible} transparent={true} onRequestClose={() => setModalVisible(false)}>
          <TouchableOpacity
            className='flex-1 justify-center items-center bg-white/95'
            activeOpacity={1}
            onPressOut={() => setModalVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} >
              <Image
                source={userData?.profile_image ? { uri: userData.profile_image } : require("@/assets/images/ball.png")}
                style={{ width: 280, height: 280, resizeMode: 'contain' }}
                className='rounded-full'
              />
              <TouchableOpacity onPress={pickImage} className="static">
                <View className='absolute -bottom-5 right-[7%] m-3 shadow-slate-600'>
                  <View className='p-2 bg-white rounded-full '>
                    <Ionicons name="color-wand" size={22} color="white" className='bg-green-700 rounded-full p-3' />
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* 🔹 BİLGİ DÜZENLEME MODALI */}
        <Modal visible={editModalVisible} transparent={true} animationType="fade">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 justify-center items-center bg-black/50">
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="w-full">
                <ScrollView
                  contentContainerStyle={{ justifyContent: "center", alignItems: "center", padding: 10 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View className="bg-white p-6 rounded-lg w-3/4">
                    <Text className="text-xl font-bold text-center text-green-700 mb-4">Kişisel Bilgilerini Tamamla</Text>

                    <TextInput placeholder="Adınız" value={userData?.name || ""} onChangeText={(text) => setUserData({ ...userData, name: text })} className="border border-gray-300 rounded p-2 mb-2" />
                    <TextInput placeholder="Soyadınız" value={userData?.surname || ""} onChangeText={(text) => setUserData({ ...userData, surname: text })} className="border border-gray-300 rounded p-2 mb-2" />
                    <TextInput placeholder="Yaş" value={userData?.age?.toString() || ""} onChangeText={(text) => setUserData({ ...userData, age: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
                    <TextInput placeholder="Boy (cm)" value={userData?.height?.toString() || ""} onChangeText={(text) => setUserData({ ...userData, height: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
                    <TextInput placeholder="Kilo (kg)" value={userData?.weight?.toString() || ""} onChangeText={(text) => setUserData({ ...userData, weight: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
                    <TextInput placeholder="Biyografi" value={userData?.description || ""} onChangeText={(text) => setUserData({ ...userData, description: text })} className="border border-gray-300 rounded p-2 mb-2" multiline />

                    <View className="flex-row justify-between mt-3">
                      <Text className='text-white bg-red-500 p-2 rounded-lg' onPress={() => setEditModalVisible(false)}> İptal Et </Text>
                      <Text className='text-white bg-green-600 p-2 rounded-lg' onPress={handleSave}> Kaydet </Text>
                    </View>
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </ScrollView>
  );
}