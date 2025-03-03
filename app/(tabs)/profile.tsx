import React, { useEffect, useState } from 'react';
import { Text, View, Image, Button, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from "expo-router";
import { supabase } from '@/services/supabase';
import '@/global.css';

export default function Profile() {
  const [modalVisible, setModalVisible] = useState(false);
  const [profileImage, setProfileImage] = useState(require('@/assets/images/ball.png'));
  const [editModalVisible, setEditModalVisible] = useState(false);
  const searchParams = useLocalSearchParams();

  const [userData, setUserData] = useState({
    id: "",
    name: "",
    surname: "",
    age: "",
    height: "",
    weight: "",
    description: "",
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  // useEffect(() => {
  //   if (searchParams.edit === "true") {
  //     setEditModalVisible(true);
  //   }
  // }, [searchParams]);

  const fetchUserData = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return;

    const { data: userInfo, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

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
      // Eğer firstLogin parametresi geldiyse ve eksik alan varsa modalı aç
      const hasMissingFields = !userInfo.name || !userInfo.surname || !userInfo.age ||
        !userInfo.height || !userInfo.weight || !userInfo.description;

      if (searchParams.firstLogin === "true" && hasMissingFields) {
        setEditModalVisible(true);
      }
    }

    if (userError) console.error("Kullanıcı bilgileri çekilirken hata oluştu:", userError.message);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImage({ uri: result.assets[0].uri });
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

  return (
    <View className="flex-1 bg-white rounded-lg m-3 p-1 shadow-lg justify-stretch">
      <View className="flex-row">
        <View className='w-1/4'>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <View className="justify-center px-4 py-3">
              <Image
                source={profileImage}
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
        <View className='w-3/4 flex-col mb-2 pl-2'>

          <View className='w-full '>
            <Text className='pl-4 py-2 font-semibold text-xl text-green-700'> {userData.name} {userData.surname} </Text>
          </View>

          <View className='w-full '>
            <Text className='px-5 mb-2 text-wrap font-semibold'>Yaş: {userData.age}, Boy: {userData.height} cm, Ağırlık: {userData.weight} kg</Text>
            <Text className='px-5 mb-2 text-wrap font-semibold'>{userData.description}</Text>
          </View>

          <View className='flex-row justify-between items-center mx-4 mt-2'>
            <View className='mx-1'>
              <Text className="text-center bg-green-600 text-white font-semibold p-1 rounded-md px-3 items-center"
                onPress={handleEditModalOpen}> Düzenle </Text>
            </View>
            <View className='mx-1'>
              <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-3 items-center'>Takip Et</Text>
            </View>
            <View className='mx-1'>
              <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-3 items-center'>Mesaj At</Text>
            </View>
          </View>

        </View>
      </View>

      <View className='my-1'>
        <View className='flex-row justify-between mx-4'>
          <View className='flex-row p-2 '>
            <View className='flex justify-around items-center border-2 border-solid border-green-600 rounded-lg py-2 px-6'>
              <Text className='font-bold text-xl'> 5 </Text>
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
      </View>


      <View className='flex-col bottom'>
        <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-3 items-center'>Çıkış Yap</Text>
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
              source={profileImage}
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
      <Modal visible={editModalVisible} transparent={true} animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white p-6 rounded-lg w-3/4">
            <Text className="text-xl font-bold text-center text-green-700 mb-4">Kişisel Bilgilerini Tamamla</Text>

            <TextInput placeholder="Adınız" value={userData.name} onChangeText={(text) => setUserData({ ...userData, name: text })} className="border border-gray-300 rounded p-2 mb-2" />
            <TextInput placeholder="Soyadınız" value={userData.surname} onChangeText={(text) => setUserData({ ...userData, surname: text })} className="border border-gray-300 rounded p-2 mb-2" />
            <TextInput placeholder="Yaş" value={userData.age?.toString()} onChangeText={(text) => setUserData({ ...userData, age: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
            <TextInput placeholder="Boy (cm)" value={userData.height?.toString()} onChangeText={(text) => setUserData({ ...userData, height: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
            <TextInput placeholder="Kilo (kg)" value={userData.weight?.toString()} onChangeText={(text) => setUserData({ ...userData, weight: text })} className="border border-gray-300 rounded p-2 mb-2" keyboardType="numeric" />
            <TextInput placeholder="Açıklama" value={userData.description} onChangeText={(text) => setUserData({ ...userData, description: text })} className="border border-gray-300 rounded p-2 mb-2" multiline />

            <View className="flex-row justify-between mt-3">
              <Text className='text-white bg-red-500 p-2 rounded-lg' onPress={() => setEditModalVisible(false)}> İptal Et </Text>
              <Text className='text-white bg-green-600 p-2 rounded-lg' onPress={handleSave}> Kaydet </Text>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}