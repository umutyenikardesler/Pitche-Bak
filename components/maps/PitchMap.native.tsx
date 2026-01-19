import React, { useMemo, useRef, useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

type Props = {
  latitude: number;
  longitude: number;
  title?: string;
  height?: number;
  minZoomLevel?: number;
  maxZoomLevel?: number;
};

export default function PitchMap({
  latitude,
  longitude,
  title,
  height = 192,
  minZoomLevel = 14,
  maxZoomLevel = 20,
}: Props) {
  const mapRef = useRef<MapView | null>(null);

  const initialRegion: Region = useMemo(
    () => ({
      latitude,
      longitude,
      latitudeDelta: Platform.OS === 'android' ? 0.001 : 0.002,
      longitudeDelta: Platform.OS === 'android' ? 0.001 : 0.002,
    }),
    [latitude, longitude]
  );

  const [region, setRegion] = useState<Region>(initialRegion);

  const animateZoom = (factor: number) => {
    const next: Region = {
      latitude: region.latitude,
      longitude: region.longitude,
      latitudeDelta: Math.max(0.0001, Math.min(0.1, region.latitudeDelta * factor)),
      longitudeDelta: Math.max(0.0001, Math.min(0.1, region.longitudeDelta * factor)),
    };
    setRegion(next);
    mapRef.current?.animateToRegion(next, 250);
  };

  return (
    <View style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }}>
      <MapView
        ref={(ref) => {
          mapRef.current = ref;
        }}
        provider={PROVIDER_GOOGLE}
        style={{ width: '100%', height: '100%' }}
        initialRegion={initialRegion}
        mapType="standard"
        showsUserLocation={false}
        showsScale={false}
        showsBuildings
        showsTraffic={false}
        showsIndoors
        loadingEnabled={false}
        cacheEnabled={false}
        moveOnMarkerPress={false}
        scrollEnabled={false}
        zoomEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled
        zoomControlEnabled={false}
        showsMyLocationButton={false}
        showsCompass={false}
        minZoomLevel={minZoomLevel}
        maxZoomLevel={maxZoomLevel}
        onRegionChangeComplete={(r) => setRegion(r)}
      >
        <Marker coordinate={{ latitude, longitude }} title={title} pinColor="red" />
      </MapView>

      {/* Zoom controls - top-left */}
      <View style={{ position: 'absolute', left: 8, top: 8 }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 8, overflow: 'hidden' }}>
          <TouchableOpacity
            onPress={() => animateZoom(0.7)}
            style={{ paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>+</Text>
          </TouchableOpacity>
          <View style={{ height: 1, backgroundColor: '#e5e7eb' }} />
          <TouchableOpacity
            onPress={() => animateZoom(1.4)}
            style={{ paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>−</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

