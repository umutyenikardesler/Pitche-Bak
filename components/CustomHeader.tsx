import React from 'react';
import { View, TouchableOpacity, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const CustomHeader = ({ title, showNotificationIcon = true }) => {
  const navigation = useNavigation();

  const handleNotificationsPress = () => {
    navigation.navigate('notifications');
  };

  return (
    <View className="flex-row justify-center items-center px-4 py-2">
      {/* Sayfa Başlığı (Sol Taraf) */}
      <Text className="text-lg font-bold flex-1">{title}</Text>

      {/* Orta Kısım: Logo */}
      <View className='text-center'>
        <Image
          source={require("@/assets/images/logo.png")} // Logonu buraya ekleyebilirsin
          style={{ width: 180, height: 60, resizeMode: 'contain' }}
          className='flex justify-center items-center text-center'
        />
      </View>

      {/* Bildirim İkonu (Sağ Taraf) */}
      <View>
        {showNotificationIcon && (
          <TouchableOpacity className="ml-auto bg-white" onPress={handleNotificationsPress}>
            <Ionicons name="heart-outline" size={24} color="green" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default CustomHeader;
