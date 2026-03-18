import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  latitude: number;
  longitude: number;
  title?: string;
  height?: number;
};

const embedUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`;

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
        minHeight: height,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <WebView
        source={{ uri: embedUrl(latitude, longitude) }}
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#e5e7eb',
        }}
        scrollEnabled={false}
        nestedScrollEnabled={false}
      />
      {/* Haritada aç butonu */}
      <View
        style={{
          position: 'absolute',
          right: 8,
          bottom: 8,
        }}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          onPress={openInGoogleMaps}
          activeOpacity={0.9}
          style={{
            backgroundColor: 'rgba(255,255,255,0.95)',
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="open-outline" size={18} color="#16a34a" />
          <Text style={{ marginLeft: 8, fontWeight: '700', color: '#111', fontSize: 13 }}>
            {title ? `${title} • Haritada aç` : 'Google Maps\'te Aç'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
