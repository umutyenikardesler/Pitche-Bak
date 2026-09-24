import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

// PitchMap ile aynı seçim: iOS'ta Apple Maps (anahtar istemez), Android'de Google.
const mapProvider = Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE;

type Props = {
  latitude: number;
  longitude: number;
  height?: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
};

/**
 * Saha konumu seçici: haritaya dokunarak ya da iğneyi sürükleyerek konum belirlenir.
 *
 * Salt okunur `PitchMap`ten ayrı duruyor; o bileşen saha detayında kullanılıyor ve
 * oraya düzenleme davranışı eklemek detay ekranında kaza riski demek.
 */
export default function PitchLocationPicker({ latitude, longitude, height = 220, onChange }: Props) {
  const mapRef = useRef<MapView | null>(null);

  // Konum dışarıdan değişince (ör. "konumumu kullan") harita oraya gitsin.
  useEffect(() => {
    const region: Region = { latitude, longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 };
    mapRef.current?.animateToRegion(region, 350);
  }, [latitude, longitude]);

  return (
    <View style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }} collapsable={false}>
      <MapView
        ref={(ref: MapView | null) => {
          mapRef.current = ref;
        }}
        provider={mapProvider}
        style={{ width: '100%', height: '100%' }}
        initialRegion={{ latitude, longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 }}
        onPress={(e: any) => onChange(e.nativeEvent.coordinate)}
        showsUserLocation
        showsMyLocationButton={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          draggable
          onDragEnd={(e: any) => onChange(e.nativeEvent.coordinate)}
          pinColor="green"
        />
      </MapView>
    </View>
  );
}
