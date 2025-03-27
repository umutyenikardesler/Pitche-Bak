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
    <View className="flex-row justify-between items-center px-4 py-2 bg-white">
      {/* Sayfa Başlığı (Sol Taraf) */}
      <Text className="text-lg font-bold flex-1">{title}</Text>

      {/* Orta Kısım: Logo */}
      <Image
        source={require("@/assets/images/logo.jpeg")} // Logonu buraya ekleyebilirsin
        style={{ width: 180, height: 60, resizeMode: 'contain' }}
      />

      {/* Bildirim İkonu (Sağ Taraf) */}
      {showNotificationIcon && (
        <TouchableOpacity className="ml-auto" onPress={handleNotificationsPress}>
          <Ionicons name="heart-outline" size={24} color="green" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default CustomHeader;
