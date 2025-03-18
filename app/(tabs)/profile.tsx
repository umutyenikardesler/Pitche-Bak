import { useEffect, useState, useCallback } from 'react';
import { Text, View, Image, Dimensions, FlatList, TextInput, TouchableOpacity, Modal, Alert, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from '@/services/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from "expo-file-system"; // 📂 Dosya işlemleri için
// import { FileObject } from "@supabase/supabase-js";
import '@/global.css';

export default function Profile() {
  const progress = 85;
  const screenWidth = Dimensions.get("window").width;
  const fontSize = screenWidth > 430 ? 12 : screenWidth > 320 ? 10.5 : 9;

  const [matches, setMatches] = useState([]); // Kullanıcının maçları
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Refresh işlemi için state

  const [modalVisible, setModalVisible] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const [userData, setUserData] = useState({
    id: "",
    name: "",
    surname: "",
    age: "",
    height: "",
    weight: "",
    description: "",
  });

  const searchParams = useLocalSearchParams();

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (userData) {
      fetchUserMatches();
    }
  }, [userData]);

  useEffect(() => {
    if (searchParams.firstLogin === "true" && userData) {
      const hasMissingFields = !userData.name || !userData.surname || !userData.age ||
        !userData.height || !userData.weight || !userData.description;

      if (hasMissingFields) {
        setEditModalVisible(true);
      }
    }
  }, [searchParams, userData]);

  const fetchUserData = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        console.error("Kullanıcı doğrulama hatası:", error);
        return;
      }
  
      const { data: userInfo, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();
  
      if (userError) {
        console.error("Kullanıcı bilgileri çekilirken hata oluştu:", userError.message);
        return;
      }
  
      if (userInfo) {
        setUserData({
          id: userInfo.id,
          name: userInfo.name || "",
          surname: userInfo.surname || "",
          age: userInfo.age || "",
          height: userInfo.height || "",
          weight: userInfo.weight || "",
          description: userInfo.description || "",
        });
  
        // 📌 Eğer profil resmi yoksa varsayılan resmi göster
        setProfileImage(userInfo.profile_image ? { uri: userInfo.profile_image } : require("@/assets/images/ball.png"));
      }
    } catch (err) {
      console.error("fetchUserData hata oluştu:", err);
    }
  };

  const fetchUserMatches = async () => {
    if (!userData || !userData.id) {
      console.error("Geçersiz kullanıcı ID’si:", userData);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("match")
      .select("*, pitches (name, districts (name))")
      .eq("create_user", userData.id) // Kullanıcının oluşturduğu maçları al
      .order("date", { ascending: false }); // En yeni maçlar üste gelsin

    if (error) {
      console.error('Maçları çekerken hata oluştu:', error);
      setMatches([]); // Hata alındığında matches state'ini boş array yap
    } else {
      const formattedData = data?.map((item) => ({
        ...item,
        formattedDate: new Date(item.date).toLocaleDateString('tr-TR'),
        startFormatted: `${item.time.split(':')[0]}:${item.time.split(':')[1]}`,
        endFormatted: `${parseInt(item.time.split(':')[0], 10) + 1}:${item.time.split(':')[1]}`
      })) || [];

      setMatches(formattedData);
    }
    setLoading(false);
  };

  // const pickImage = async () => {
  //   let result = await ImagePicker.launchImageLibraryAsync({
  //     mediaTypes: ['images', 'videos'],
  //     allowsEditing: true,
  //     aspect: [1, 1],
  //     quality: 1,
  //   });

  //   if (!result.canceled) {
  //     setProfileImage({ uri: result.assets[0].uri });
  //   }
  // };

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
  
      if (!result.canceled) {
        const uri = result.assets[0].uri;
        const fileExt = uri.split(".").pop().toLowerCase(); // Dosya uzantısını al
        const fileName = `profile_${userData.id}.${fileExt}`; // Kullanıcı ID'sine özel isim
  
        const filePath = `${userData.id}/${fileName}`; // Kullanıcı ID'sine özel klasör
  
        // 📌 Supabase Storage'a resim yükle
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("pictures")
          .upload(filePath, {
            uri,
            type: fileExt === "heic" ? "image/heic" : fileExt === "png" ? "image/png" : "image/jpeg",
            name: fileName,
          });
  
        if (uploadError) {
          Alert.alert("Hata", `Resim yüklenirken bir hata oluştu: ${uploadError.message}`);
          console.error("Resim yükleme hatası:", uploadError);
          return;
        }
  
        // 📌 Yüklenen resmin URL'sini al
        const { data: publicURLData, error: publicURLError } = await supabase
          .storage
          .from("pictures")
          .getPublicUrl(filePath);
  
        if (publicURLError || !publicURLData) {
          Alert.alert("Hata", `Resim URL'si alınırken bir hata oluştu: ${publicURLError?.message || "Bilinmeyen hata"}`);
          console.error("Resim URL hatası:", publicURLError);
          return;
        }
  
        // 📌 Kullanıcının profil tablosunu güncelle
        const { error: updateError } = await supabase
          .from("users")
          .update({ profile_image: publicURLData.publicUrl })
          .eq("id", userData.id);
  
        if (updateError) {
          Alert.alert("Hata", `Profil resmi güncellenirken bir hata oluştu: ${updateError.message}`);
          console.error("Profil resmi güncelleme hatası:", updateError);
          return;
        }
  
        // 📌 Güncellenmiş resmi state'e kaydet
        setProfileImage({ uri: publicURLData.publicUrl });
  
        Alert.alert("Başarılı", "Profil resmi başarıyla güncellendi.");
      }
    } catch (err) {
      Alert.alert("Hata", `Bir hata oluştu: ${err.message}`);
      console.error("pickImage hata oluştu:", err);
    }
  };
  
  const handleSave = async () => {
    const { error } = await supabase
      .from("users")
      .update({
        name: userData.name,
        surname: userData.surname,
        age: userData.age,
        height: userData.height,
        weight: userData.weight,
        description: userData.description,
      })
      .eq("id", userData.id);

    if (error) {
      Alert.alert("Uyarı", "❗ Lütfen eksik alanları doldurun ❗");
    } else {
      setEditModalVisible(false);
      Alert.alert("Tebrikler", "Bilgileriniz başarıyla güncellendi.");
    }
  };

  const handleEditModalOpen = async () => {
    await fetchUserData(); // Modal açılmadan önce verileri güncelle
    setEditModalVisible(true);
  };

  const [prevMatchCount, setPrevMatchCount] = useState(0);
  const router = useRouter(); // route değişkeni eklendi

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        await fetchUserData(); // Kullanıcı verisini al

        //     // Yeni maç sayısını al (ID'leri çekerek hızlı sorgu)
        //     const { data: matchData, error } = await supabase
        //       .from("match")
        //       .select("id") // Sadece ID çekiyoruz, performans için
        //       .eq("create_user", userData.id);

        //     if (error) {
        //       console.error("Maçları kontrol ederken hata oluştu:", error.message);
        //       return;
        //     }

        //     if (matchData) {
        //       const newMatchCount = matchData.length;

        //       if (newMatchCount !== prevMatchCount) { // Eğer değişiklik varsa
        //         setPrevMatchCount(newMatchCount); // Yeni maç sayısını sakla
        //         await fetchUserMatches(); // Maçları güncelle
        //       }
        //     }
        //   };

        //   fetchData();
        // }, [prevMatchCount, userData.id]) // Sadece değişiklik olduğunda çalışsın

        await fetchUserMatches(); // Maçları güncelle
      };

      fetchData();
    }, []) // Sadece sayfa odaklandığında çalışsın

  );

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Çıkış Yapılamadı", "Bir hata oluştu, lütfen tekrar deneyin.");
      console.error("Çıkış Hatası:", error.message);
    } else {
      router.replace("auth/"); // Çıkış yapınca giriş ekranına yönlendir.
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUserData(); // Kullanıcı verilerini güncelle
    await fetchUserMatches(); // Maçları güncelle
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-1 bg-white rounded-lg m-3 p-1 shadow-lg justify-between ">
        {/* Profil Bilgileri ve İstatistikler */}
        <View>
          {/* Profil Bilgileri */}
          <View className="flex-row">
            <View className='w-1/4'>
              <TouchableOpacity onPress={() => setModalVisible(true)}>
                <View className="justify-center px-4 py-3">
                  <Image
                     source={profileImage?.uri ? { uri: profileImage.uri } : require("@/assets/images/ball.png")}
                     className="rounded-full mx-auto"
                     style={{ width: 90, height: 90, resizeMode: 'contain' }}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={pickImage} className="static">
                <View className='absolute -bottom-1 -right-3 m-1'>
                  <Ionicons name="add-circle" size={28} color="green" className='bg-white rounded-full p-1' />
                </View>
              </TouchableOpacity>

            </View>
            <View className='w-3/4 flex-col mb-2 px-2'>

              <View className='w-full '>
                <Text className='pl-4 py-2 font-semibold text-xl text-green-700'> {userData.name} {userData.surname} </Text>
              </View>

              <View className='px-5 mb-2 flex-row justify-between'>
                <Text className='text-wrap font-semibold'>Yaş:</Text>
                <Text className='text-green-600 font-semibold'> {userData.age}, </Text>
                <Text className='font-semibold'>Boy:</Text>
                <Text className='text-green-600 font-semibold'> {userData.height} cm, </Text>
                <Text className=' font-semibold'>Ağırlık:</Text>
                <Text className='text-green-600 font-semibold'> {userData.weight} kg</Text>
              </View>
              <View>
                <Text className='px-5 mb-2 text-wrap font-semibold'>{userData.description}</Text>
              </View>

              <View className='flex-row justify-between items-center mx-4 mt-2'>
                <View className='mx-1 w-1/2'>
                  <TouchableOpacity className="text-center bg-green-600 text-white font-semibold rounded-md px-1 items-center"
                    onPress={handleEditModalOpen}>
                    <Text className="text-white font-semibold text-center p-1">Düzenle</Text>
                  </TouchableOpacity>
                </View>
                <View className='mx-1 w-1/2'>
                  <TouchableOpacity className="text-center bg-green-600 text-white font-semibold rounded-md px-1 items-center"
                  >
                    <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-1 items-center'>Takip Et</Text>
                  </TouchableOpacity>
                </View>
                {/* <View className='mx-1'>
                <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-3 items-center'>Mesaj At</Text>
              </View> */}
              </View>

            </View>
          </View>

          {/* Maç - Takipçi - Takip İstatistikleri */}
          <View className='flex-row justify-between mx-4 mt-1'>
            <View className='flex-row p-2 '>
              <View className='flex justify-around items-center border-2 border-solid border-green-600 rounded-lg py-2 px-6'>
                <Text className='font-bold text-xl'> {matches.length} </Text>
                <Text className='font-bold text-green-700'>Maç</Text>
              </View>
            </View>
            <View className='flex-row p-2'>
              <View className='flex justify-around items-center border-2 border-solid border-green-600 rounded-lg py-2 px-6'>
                <Text className='font-bold text-xl'> 250 </Text>
                <Text className='font-bold text-green-700'>Takipçi</Text>
              </View>
            </View>
            <View className='flex-row p-2'>
              <View className='flex justify-around items-center border-2 border-solid border-green-600 rounded-lg py-2 px-6'>
                <Text className='font-bold text-xl'> 120 </Text>
                <Text className='font-bold text-green-700'>Takip</Text>
              </View>
            </View>
          </View>

          {/* KONDİSYONUN Başlığı ve İçeriği */}
          <View className="flex-row mt-2 px-3 justify-center">
            <Ionicons name="accessibility" size={16} color="green" className="pl-2" />
            <Text className="font-bold text-green-700"> KONDİSYONUN </Text>
          </View>

          <View className="bg-white rounded-lg mx-4 my-3 p-3 shadow-md">
            {/* Progress Bar ve Yüzde */}
            <View className="w-full mb-3 flex-row items-center">
              {/* Progress Bar */}
              <View className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <View className="bg-green-600 h-full" style={{ width: `${progress}%` }} />
              </View>
              {/* Yüzde */}
              <Text className="pl-2 font-semibold text-base text-green-500">{progress}%</Text>
            </View>

            {/* İkon ve Metin */}
            <View className="flex-row items-center -mt-2">
              <Ionicons name="information-circle-outline" size={16} color="black" />
              <Text className="text-xs text-slate-600 pl-2 " style={{ fontSize }}>
                Kondisyonun yaptığın maç sayısına göre değişiklik gösterebilir.
              </Text>
            </View>
          </View>

          {/* Maç Listesi ve İçeriği */}
          <View className="flex-row mt-2 px-3 justify-center mb-2">
            <Ionicons name="accessibility" size={16} color="green" className="pl-2" />
            <Text className="font-bold text-green-700"> MAÇLARIM </Text>
          </View>

          {/* Maç Listesi */}
          <View className='flex mb-2'>
            {loading ? (
              <Text className="text-center mb-4 text-gray-500">Yükleniyor...</Text>
            ) : matches.length > 0 ? (
              <FlatList
                className='mb-2'
                data={matches}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View className="bg-gray-100 rounded-lg p-3 mx-4 mt-2 mb-1 shadow-sm">
                    <Text className="text-green-700 font-bold mb-2">{item.title}</Text>
                    <View className="text-gray-700 text-md flex-row items-center">
                      <Ionicons name="calendar-outline" size={18} color="black" />
                      <Text className="pl-2 font-semibold"> {item.formattedDate}  →</Text>
                      <Text className="pl-2 font-bold text-green-600"> {item.startFormatted}-{item.endFormatted} </Text>
                    </View>
                    <View className="text-gray-700 text-md flex-row items-center pt-1">
                      <Ionicons name="location" size={18} color="black" />
                      <Text className="pl-2 font-semibold"> {item.pitches?.districts?.name ?? 'Bilinmiyor'}  →</Text>
                      <Text className="pl-2 font-bold text-green-700"> {item.pitches?.name ?? 'Bilinmiyor'} </Text>
                    </View>
                  </View>
                )}
                style={{ maxHeight: 290, marginBottom: 0 }} // 3 maçlık yüksekliği sınırla, scroll aktif olur
                nestedScrollEnabled={true} // FlatList'in içinde kaydırma yapabilmesini sağla
                refreshing={refreshing} // FlatList'e refresh state'ini ekle
                onRefresh={handleRefresh} // Kullanıcı aşağı çektiğinde çalışacak fonksiyon
              />
            ) : (
              <Text className="text-center mb-4 text-gray-500">Henüz maç oluşturmadınız.</Text>
            )}
          </View>
        </View>

        {/* Çıkış Butonu En Altta */}
        <View className="flex-1 justify-end bottom-0 pb-4">
          <TouchableOpacity onPress={handleLogout} className="bg-green-600 mx-4 rounded-lg">
            <Text className="text-white font-semibold text-center p-2">Çıkış Yap</Text>
          </TouchableOpacity>
        </View>

        {/* Profil Fotoğrafı Modalı */}
        <Modal
          visible={modalVisible}
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableOpacity
            className='flex-1 justify-center items-center bg-white/95'
            activeOpacity={1}
            onPressOut={() => setModalVisible(false)}
          >
            <TouchableOpacity activeOpacity={1} >
              <Image
                 source={profileImage?.uri ? { uri: profileImage.uri } : require("@/assets/images/ball.png")}
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

        {/* Bilgi Düzenleme Modalı */}
        <Modal visible={editModalVisible} transparent={true} animationType="fade">
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="flex-1 justify-center items-center bg-black/50">
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="w-full"
              >
                <ScrollView
                  contentContainerStyle={{ justifyContent: "center", alignItems: "center", padding: 10 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View className="bg-white p-6 rounded-lg w-3/4">
                    <Text className="text-xl font-bold text-center text-green-700 mb-4">Kişisel Bilgilerini Tamamla</Text>

                    <TextInput placeholder="Adınız" value={userData.name} onChangeText={(text) => setUserData({ ...userData, name: text })} className="border border-gray-300 rounded p-2 mb-2" />
                    <TextInput placeholder="Soyadınız" value={userData.surname} onChangeText={(text) => setUserData({ ...userData, surname: text })} className="border border-gray-300 rounded p-2 mb-2" />
                    <TextInput placeholder="Yaş" value={userData.age?.toString()} onChangeText={(text) => setUserData({ ...userData, age: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
                    <TextInput placeholder="Boy (cm)" value={userData.height?.toString()} onChangeText={(text) => setUserData({ ...userData, height: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
                    <TextInput placeholder="Kilo (kg)" value={userData.weight?.toString()} onChangeText={(text) => setUserData({ ...userData, weight: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
                    <TextInput placeholder="Biyografi" value={userData.description} onChangeText={(text) => setUserData({ ...userData, description: text })} className="border border-gray-300 rounded p-2 mb-2" multiline />

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
      </View >
    </View>
  );
}