import React from 'react';
import { View, TouchableOpacity, Text, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const screenWidth = Dimensions.get('window').width;

const CustomHeader = ({ title, showNotificationIcon = true }) => {
  const navigation = useNavigation();

  const handleNotificationsPress = () => {
    navigation.navigate('notifications');
  };

  return (
    <View className="flex-row justify-between items-center w-full -mx-0 ">
      {/* Sol: Başlık */}
      <View>
        <Text className="text-lg font-bold text-green-700">{title}</Text>
      </View>

      {/* Orta: Logo (mutlak konumda ortalanmış) */}
      <View style={{
          position: 'absolute',
          left: screenWidth / 2 - 85, // yarı genişlik - yarı logo genişliği
        }}
        >
        <Image
          source={require("@/assets/images/logo.png")}
          style={{ width: 130, height: 40, resizeMode: 'contain' }}
        />
      </View>

      {/* Sağ: Bildirim ikonu */}
      <View style={{ alignItems: 'flex-end' }}>
        {showNotificationIcon && (
          <TouchableOpacity onPress={handleNotificationsPress}>
            <Ionicons name="heart-outline" size={24} color="green" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default CustomHeader;
