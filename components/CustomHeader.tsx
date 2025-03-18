import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const CustomHeader = ({ title, showNotificationIcon = true }) => {
  const navigation = useNavigation();

  const handleNotificationsPress = () => {
    navigation.navigate('notifications');
  };

  return (
    <View className="flex-row justify-between items-center px-4 py-3 bg-white">
      <Text className="text-lg font-bold">{title}</Text>
      {showNotificationIcon && (
        <TouchableOpacity className="ml-auto" onPress={handleNotificationsPress}>
          <Ionicons name="heart-outline" size={24} color="green" />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default CustomHeader;
