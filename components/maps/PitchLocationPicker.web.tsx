import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
};

/**
 * Web'de harita seçici yok: saha ekleme telefondan yapılıyor. Koordinatlar
 * formdaki enlem/boylam alanlarından elle girilebiliyor.
 */
export default function PitchLocationPicker({ latitude, longitude, height = 220 }: Props) {
  return (
    <View
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        backgroundColor: '#e5e7eb',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Text style={{ color: '#4b5563', textAlign: 'center' }}>
        Harita seçici yalnızca mobil uygulamada. Koordinatları aşağıdaki alanlara yazabilirsiniz.
      </Text>
      <Text style={{ color: '#6b7280', marginTop: 6 }}>
        {latitude.toFixed(6)}, {longitude.toFixed(6)}
      </Text>
    </View>
  );
}
