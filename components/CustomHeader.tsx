import React from 'react';
import { View, TouchableOpacity, Text, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useNotification } from './NotificationContext';
import { useRouter } from 'expo-router';

const screenWidth = Dimensions.get('window').width;

// Add type for props
interface CustomHeaderProps {
  title: string;
  showNotificationIcon?: boolean;
}

const CustomHeader = ({ title, showNotificationIcon = true }: CustomHeaderProps) => {
  const router = useRouter();
  const { count } = useNotification();
  const handleNotificationsPress = () => {
    router.push('/notifications');
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
          <TouchableOpacity onPress={handleNotificationsPress} style={{ position: 'relative' }}>
            <Ionicons name="heart-outline" size={24} color="green" />
            {count > 0 && (
              <View style={{
                position: 'absolute',
                top: -6,
                right: -6,
                backgroundColor: 'red',
                borderRadius: 10,
                minWidth: 18,
                height: 18,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 4,
                zIndex: 1,
              }}>
                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default CustomHeader;
