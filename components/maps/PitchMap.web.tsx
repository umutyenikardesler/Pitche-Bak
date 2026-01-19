import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  latitude: number;
  longitude: number;
  title?: string;
  height?: number;
};

export default function PitchMap({ latitude, longitude, title, height = 192 }: Props) {
  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  return (
    <View
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#e5e7eb',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
      }}
    >
      <TouchableOpacity
        onPress={openInGoogleMaps}
        activeOpacity={0.9}
        style={{
          backgroundColor: 'white',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <Ionicons name="map-outline" size={20} color="#16a34a" />
        <Text style={{ marginLeft: 8, fontWeight: '700', color: '#111' }}>
          {title ? `${title} • Google Maps’te Aç` : 'Google Maps’te Aç'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

