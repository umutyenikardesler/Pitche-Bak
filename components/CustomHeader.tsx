// components/CustomHeader.tsx

import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const CustomHeader = ({ title, showNotificationIcon = true }) => {
  const navigation = useNavigation();

  const handleNotificationsPress = () => {
    navigation.navigate('notifications');
  };

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {showNotificationIcon && (
        <TouchableOpacity style={styles.notificationButton} onPress={handleNotificationsPress}>
          <Ionicons name="heart-outline" size={24} color="green" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  notificationButton: {
    marginLeft: 'auto',
  },
});

export default CustomHeader;