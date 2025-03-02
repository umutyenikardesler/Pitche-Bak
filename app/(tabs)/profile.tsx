import React, { useState } from 'react';
import { Text, View, Image, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/services/supabase';
import '@/global.css';

export default function Profile() {
  const [modalVisible, setModalVisible] = useState(false);
  const [profileImage, setProfileImage] = useState(require('@/assets/images/ball.png'));

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

  return (
    <View className="flex-1 bg-white rounded-lg m-3 p-1 shadow-lg">
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
        <View className='w-3/4 flex-col mb-2'>

          <View className='w-full '>
            <Text className='pl-6 py-2 font-semibold text-xl text-green-700'>Umut Yenikardeşler</Text>
          </View>

          <View className='w-full '>
            <Text className='px-5 mb-2 text-wrap font-semibold'>✌️ Futbol benim için bir zevk. Sağ ✌️</Text>
          </View>

          <View className='flex-row justify-between items-center mx-4 mt-2'>
            <View className='mx-2'>
              <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-2 items-center'>Düzenle</Text>
            </View>
            <View className='mx-2'>
              <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-3 items-center'>Takip Et</Text>
            </View>
            <View className='mx-2'>
              <Text className='text-center bg-green-600 text-white font-semibold p-1 rounded-md px-2 items-center'>Mesaj At</Text>
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
            {/* Modal içeriği */}
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
    </View>
  );
}