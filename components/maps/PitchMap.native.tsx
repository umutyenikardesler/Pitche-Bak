import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';

// iOS'ta Apple Maps (anahtar gerektirmez, tile'lar düzgün yüklenir)
// Android'de Google Maps
const mapProvider = Platform.OS === 'ios' ? undefined : PROVIDER_GOOGLE;

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

  // Sadece ref kullan - onRegionChangeComplete sık tetiklenir, setState döngüye sokar
  const regionRef = useRef<Region>(initialRegion);
  useEffect(() => {
    regionRef.current = initialRegion;
  }, [initialRegion]);

  const animateZoom = (factor: number) => {
    mapRef.current?.getMapBoundaries().then((bounds: { northEast: { latitude: number; longitude: number }; southWest: { latitude: number; longitude: number } } | undefined) => {
      if (!bounds) return;
      const { northEast, southWest } = bounds;
      const lat = (northEast.latitude + southWest.latitude) / 2;
      const lng = (northEast.longitude + southWest.longitude) / 2;
      const latDelta = northEast.latitude - southWest.latitude;
      const lngDelta = northEast.longitude - southWest.longitude;
      const next: Region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: Math.max(0.0001, Math.min(15, latDelta * factor)),
        longitudeDelta: Math.max(0.0001, Math.min(15, lngDelta * factor)),
      };
      regionRef.current = next;
      mapRef.current?.animateToRegion(next, 250);
    }).catch(() => {
      const current = regionRef.current;
      const next: Region = {
        latitude: current.latitude,
        longitude: current.longitude,
        latitudeDelta: Math.max(0.0001, Math.min(15, current.latitudeDelta * factor)),
        longitudeDelta: Math.max(0.0001, Math.min(15, current.longitudeDelta * factor)),
      };
      regionRef.current = next;
      mapRef.current?.animateToRegion(next, 250);
    });
  };

  return (
    <View
      style={{ width: '100%', height, minHeight: height, borderRadius: 12, overflow: 'hidden' }}
      collapsable={false}
    >
      <MapView
        ref={(ref: MapView | null) => {
          mapRef.current = ref;
        }}
        provider={mapProvider}
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
        scrollEnabled
        zoomEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled
        zoomControlEnabled={false}
        showsMyLocationButton={false}
        showsCompass={false}
        minZoomLevel={minZoomLevel}
        maxZoomLevel={maxZoomLevel}
        onRegionChangeComplete={(r: Region) => { regionRef.current = r; }}
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
            onPress={() => animateZoom(12)}
            style={{ paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>−</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

