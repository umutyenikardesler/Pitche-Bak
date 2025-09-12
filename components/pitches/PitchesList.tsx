import { FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View, Platform, Linking, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, UrlTile, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter } from "expo-router"; // Router'ı getir
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { useLanguage } from "@/contexts/LanguageContext";

import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolateColor, Easing } from 'react-native-reanimated';
import { FontAwesome } from '@expo/vector-icons'; // Top ikonu için

import { useEffect, useRef, useState } from 'react';

export default function PitchesList({ pitches, selectedPitch, setSelectedPitch, handleCloseDetail, refreshing, onRefresh }: any) {
  const { t } = useLanguage();

  const router = useRouter();

  // animasyon değeri
  const scale = useSharedValue(1);
  const bgColor = useSharedValue(0); // 0 → yeşil, 1 → açık yeşil

  const mapRef = useRef<MapView | null>(null);
  const [currentRegion, setCurrentRegion] = useState<Region | null>(null);

  const [mapChooserVisible, setMapChooserVisible] = useState(false);
  const [availableMaps, setAvailableMaps] = useState<{ google: boolean; waze: boolean }>({ google: false, waze: false });

  const animateZoom = (factor: number) => {
    if (!selectedPitch) return;
    const baseRegion: Region = currentRegion || {
      latitude: selectedPitch.latitude,
      longitude: selectedPitch.longitude,
      latitudeDelta: Platform.OS === 'android' ? 0.001 : 0.002,
      longitudeDelta: Platform.OS === 'android' ? 0.001 : 0.002,
    };

    const nextRegion: Region = {
      latitude: baseRegion.latitude,
      longitude: baseRegion.longitude,
      latitudeDelta: Math.max(0.0001, Math.min(0.1, baseRegion.latitudeDelta * factor)),
      longitudeDelta: Math.max(0.0001, Math.min(0.1, baseRegion.longitudeDelta * factor)),
    };

    mapRef.current?.animateToRegion(nextRegion, 250);
  };

  const handleZoomIn = () => animateZoom(0.7);
  const handleZoomOut = () => animateZoom(1.4);

  const showMapChooser = async () => {
    try {
      const [hasGoogle, hasWaze] = await Promise.all([
        Linking.canOpenURL(Platform.OS === 'ios' ? 'comgooglemaps://' : 'geo:0,0?q='),
        Linking.canOpenURL('waze://'),
      ]);
      setAvailableMaps({ google: !!hasGoogle, waze: !!hasWaze });
    } catch (e) {
      setAvailableMaps({ google: false, waze: false });
    }
    setMapChooserVisible(true);
  };

  const openInAppleMaps = () => {
    if (!selectedPitch) return;
    const lat = selectedPitch.latitude;
    const lng = selectedPitch.longitude;
    const label = encodeURIComponent(selectedPitch.name || 'Konum');
    const url = `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
    Linking.openURL(url);
    setMapChooserVisible(false);
  };

  const openInGoogleMaps = () => {
    if (!selectedPitch) return;
    const lat = selectedPitch.latitude;
    const lng = selectedPitch.longitude;
    const label = encodeURIComponent(selectedPitch.name || 'Konum');
    let url = '';
    if (Platform.OS === 'ios') {
      url = `comgooglemaps://?q=${lat},${lng}(${label})`;
    } else {
      url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    }
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
    setMapChooserVisible(false);
  };

  const openInWaze = () => {
    if (!selectedPitch) return;
    const lat = selectedPitch.latitude;
    const lng = selectedPitch.longitude;
    const url = `waze://?ll=${lat},${lng}&navigate=yes`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
    });
    setMapChooserVisible(false);
  };

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.15, {
        duration: 800,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    bgColor.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      bgColor.value,
      [0, 1],
      ['#16a34a', '#4ade80'] // green-600 → green-400 gibi
    );

    return {
      transform: [{ scale: scale.value }],
      backgroundColor,
    };
  });


  const handleSelectPitch = async (pitchId: string) => {
    const { data, error } = await supabase
      .from("pitches")
      .select("id, district_id, name, price, district:districts(name)")
      .eq("id", pitchId)
      .single();

    if (error) {
      console.error("❌ Saha verisi alınamadı:", error);
      return;
    }

    const districtName = (data as any)?.district?.name ?? '';

    router.push({
      pathname: "/create",
      params: {
        pitchId: data.id,
        district: data.district_id,
        districtName,
        name: data.name,
        price: data.price,
        shouldSetFields: "true"
      },
    });
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-40, 40])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      if (event.translationX > 100) {
        runOnJS(handleCloseDetail)();
      }
    });

  const featuresArray = selectedPitch?.features || [];

  if (selectedPitch) {
    return (
      <>
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ 
              flexGrow: 1,
              paddingBottom: Platform.OS === 'android' ? 50 : 0
            }}
            showsVerticalScrollIndicator={true}
            bounces={true}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            scrollEventThrottle={16}
            decelerationRate="normal"
            alwaysBounceVertical={true}
            overScrollMode="auto"
          >
          <GestureDetector gesture={swipeGesture}>
            <View className="bg-white rounded-lg mx-4 mt-2 p-4 shadow-md mb-4" style={{ minHeight: '97%' }}>
                <View className="flex flex-col items-center flex-1 justify-between">
                  <View className="w-full flex-1">
                    <Text className="text-xl font-bold text-green-700 text-center mb-2">{t('pitches.pitchSummary')}</Text>

                    {selectedPitch.latitude && selectedPitch.longitude && Platform.OS !== "web" && (
                      <View className="w-full h-48 rounded-lg overflow-hidden my-2">
                        <MapView
                          ref={(ref) => { mapRef.current = ref; }}
                          provider={PROVIDER_GOOGLE}
                          style={{ width: "100%", height: "100%" }}
                        initialRegion={{
                          latitude: selectedPitch.latitude,
                          longitude: selectedPitch.longitude,
                          latitudeDelta: Platform.OS === 'android' ? 0.001 : 0.002,
                          longitudeDelta: Platform.OS === 'android' ? 0.001 : 0.002,
                        }}
                          mapType="standard"
                          showsUserLocation={false}
                          showsScale={false}
                          showsBuildings={true}
                          showsTraffic={false}
                          showsIndoors={true}
                          loadingEnabled={false}
                          cacheEnabled={false}
                          moveOnMarkerPress={false}
                          scrollEnabled={false}
                          zoomEnabled={true}
                          pitchEnabled={false}
                          rotateEnabled={false}
                          toolbarEnabled={true}
                          zoomControlEnabled={false}
                          showsMyLocationButton={false}
                          showsCompass={false}
                          minZoomLevel={14}
                          maxZoomLevel={20}
                          onRegionChangeComplete={(region) => setCurrentRegion(region)}
                        >
                          <Marker 
                            coordinate={{ latitude: selectedPitch.latitude, longitude: selectedPitch.longitude }} 
                            title={selectedPitch.name}
                            pinColor="red"
                          />
                        </MapView>
                        {/* Custom zoom controls - top-left */}
                        <View style={{ position: 'absolute', left: 8, top: 8 }}>
                          <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 8, overflow: 'hidden' }}>
                            <TouchableOpacity onPress={handleZoomIn} style={{ paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}>
                              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>+</Text>
                            </TouchableOpacity>
                            <View style={{ height: 1, backgroundColor: '#e5e7eb' }} />
                            <TouchableOpacity onPress={handleZoomOut} style={{ paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' }}>
                              <Text style={{ fontSize: 18, fontWeight: '700', color: '#111' }}>−</Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Open in maps chooser - bottom-right */}
                        <View style={{ position: 'absolute', right: 8, bottom: 8 }}>
                          <TouchableOpacity
                            onPress={showMapChooser}
                            style={{ backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9999 }}
                          >
                            <Text style={{ fontWeight: '700', color: '#111' }}>Haritalar uygulamasında Aç</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Maps chooser modal */}
                        <Modal
                          visible={mapChooserVisible}
                          transparent
                          animationType="fade"
                          onRequestClose={() => setMapChooserVisible(false)}
                        >
                          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, width: 280 }}>
                              <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 10, textAlign: 'center' }}>Haritalarda aç</Text>
                              {Platform.OS === 'ios' ? (
                                <TouchableOpacity onPress={openInAppleMaps} style={{ paddingVertical: 10 }}>
                                  <Text style={{ textAlign: 'center', fontWeight: '600' }}>Apple Haritalar</Text>
                                </TouchableOpacity>
                              ) : null}
                              <TouchableOpacity onPress={openInGoogleMaps} style={{ paddingVertical: 10 }}>
                                <Text style={{ textAlign: 'center', fontWeight: '600' }}>Google Maps</Text>
                              </TouchableOpacity>
                              {availableMaps.waze ? (
                                <TouchableOpacity onPress={openInWaze} style={{ paddingVertical: 10 }}>
                                  <Text style={{ textAlign: 'center', fontWeight: '600' }}>Waze</Text>
                                </TouchableOpacity>
                              ) : null}
                              <TouchableOpacity onPress={() => setMapChooserVisible(false)} style={{ marginTop: 8, paddingVertical: 8 }}>
                                <Text style={{ textAlign: 'center', color: '#666' }}>İptal</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </Modal>
                      </View>
                    )}

                    <View>
                      <Text className="h-7 text-xl text-green-700 font-semibold text-center mt-4">{selectedPitch.name}</Text>
                    </View>

                    <View>
                      <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-4">{t('pitches.openAddress')}</Text>
                      <View className="flex-row justify-center items-center pt-1">
                        <Ionicons name="location-outline" size={20} color="green" />
                        <Text className="pl-2 text-gray-700 font-semibold">{selectedPitch.address}</Text>
                      </View>
                    </View>

                    <View>
                      <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-4">{t('pitches.pitchPrice')}</Text>
                      <View className="flex-row justify-center items-center pt-1">
                        <Ionicons name="wallet-outline" size={18} color="green" />
                        <Text className="pl-2 text-gray-700 font-semibold">{selectedPitch.price} ₺</Text>
                      </View>
                    </View>

                    <View>
                      <Text className="text-lg font-semibold text-green-700 text-center mt-3 mb-2">{t('pitches.pitchFeatures')}</Text>
                      <View className="flex-row flex-wrap justify-center">
                        {featuresArray.map((feature: string, index: number) => (
                          <View key={index} className={`${featuresArray.length === 1 ? 'w-auto' : 'w-1/2'}  mb-1`} >
                            <View className="flex-row p-2 bg-green-700 rounded mr-1 items-center justify-center">
                              <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                              <Text className="text-white pl-1">{feature}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Geri Dön butonu - HALI SAHA ÖZETİ içinde */}
                  <View className="mt-6 mb-1 w-full">
                    <TouchableOpacity className="w-full items-center bg-green-700 px-2 py-2 rounded-lg" onPress={handleCloseDetail}>
                      <Text className="text-white font-bold text-lg">{t('general.back')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </GestureDetector>
        </ScrollView>

        <Animated.View
          pointerEvents="box-none"
          style={[
            animatedStyle,
            {
              position: 'absolute',
              right: 24,
              top: '47.5%',
              transform: [{ translateY: 0 }],
              borderRadius: 9999,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.6,
              shadowRadius: 6,
              elevation: 10,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => handleSelectPitch(selectedPitch.id)}
            className="flex-row"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderRadius: 9999,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FontAwesome name="soccer-ball-o" size={24} color="#fff" />
            {/* <Text
              style={{
                color: 'white',
                fontWeight: 'bold',
                textAlign: 'center',
                marginTop: 0,
                lineHeight: 20,
                marginLeft: 0,
              }}
            >
              Maç{"\n"}Yap
            </Text> */}
          </TouchableOpacity>
        </Animated.View>

      </>
    );
  }

  return (
    <FlatList
      data={pitches}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => setSelectedPitch(item)}>
          <View className="bg-white rounded-lg mx-4 mt-3 p-3 shadow-md">
            <View className="flex-row justify-between">
              <Text className="w-4/6 text-base font-semibold">{item.name}</Text>
              <Text className="w-1/6 text-right text-sm text-gray-500">{item.distance?.toFixed(2)} km</Text>
              <Ionicons className="w-3 text-right" name="chevron-forward-outline" size={16} color="green" />
            </View>
          </View>
        </TouchableOpacity>
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 10 }}
      nestedScrollEnabled
    />
  );
}
