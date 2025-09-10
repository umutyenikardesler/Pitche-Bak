import { FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, UrlTile, PROVIDER_GOOGLE } from "react-native-maps";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter } from "expo-router"; // Router'ı getir
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { useLanguage } from "@/contexts/LanguageContext";

import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolateColor, Easing } from 'react-native-reanimated';
import { FontAwesome } from '@expo/vector-icons'; // Top ikonu için

import { useEffect } from 'react';

export default function PitchesList({ pitches, selectedPitch, setSelectedPitch, handleCloseDetail, refreshing, onRefresh }) {
  const { t } = useLanguage();

  const router = useRouter();

  // animasyon değeri
  const scale = useSharedValue(1);
  const bgColor = useSharedValue(0); // 0 → yeşil, 1 → açık yeşil

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

    router.push({
      pathname: "/create",
      params: {
        pitchId: data.id,
        district: data.district_id,
        districtName: data.district.name,
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
              paddingBottom: Platform.OS === 'android' ? 100 : 0
            }}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={false}
            bounces={true}
            scrollEnabled={true}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={false}
            scrollEventThrottle={16}
            decelerationRate="normal"
            alwaysBounceVertical={false}
            overScrollMode="auto"
          >
          <GestureDetector gesture={swipeGesture}>
            <View className="bg-white rounded-lg my-3 mx-4 p-4 shadow-md">
                <View className="flex flex-col items-center">
                  <Text className="text-xl font-bold text-green-700 text-center mb-2">{t('pitches.pitchSummary')}</Text>

                  {selectedPitch.latitude && selectedPitch.longitude && Platform.OS !== "web" && (
                    <View className="w-full h-48 rounded-lg overflow-hidden my-2">
                      <MapView
                        {...(Platform.OS === 'android' ? { provider: PROVIDER_GOOGLE, liteMode: true } : {})}
                        style={{ width: "100%", height: "100%" }}
                        initialRegion={{
                          latitude: selectedPitch.latitude,
                          longitude: selectedPitch.longitude,
                          latitudeDelta: Platform.OS === 'android' ? 0.004 : 0.01,
                          longitudeDelta: Platform.OS === 'android' ? 0.004 : 0.01,
                        }}
                        mapType="standard"
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        showsCompass={false}
                        showsScale={false}
                        showsBuildings={true}
                        showsTraffic={false}
                        showsIndoors={true}
                        loadingEnabled={false}
                        cacheEnabled={Platform.OS === 'android'}
                        moveOnMarkerPress={false}
                        scrollEnabled={false}
                        zoomEnabled={false}
                        pitchEnabled={false}
                        rotateEnabled={false}
                        toolbarEnabled={false}
                      >
                        <Marker 
                          coordinate={{ latitude: selectedPitch.latitude, longitude: selectedPitch.longitude }} 
                          title={selectedPitch.name}
                          pinColor="red"
                        />
                      </MapView>
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
                      {featuresArray.map((feature, index) => (
                        <View key={index} className={`${featuresArray.length === 1 ? 'w-auto' : 'w-1/2'}  mb-1`} >
                          <View className="flex-row p-2 bg-green-700 rounded mr-1 items-center justify-center">
                            <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                            <Text className="text-white pl-1">{feature}</Text>
                          </View>
                        </View>
                      ))}
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
