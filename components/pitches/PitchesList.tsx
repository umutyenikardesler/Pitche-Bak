import { FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter } from "expo-router"; // Router'ı getir
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/services/supabase';

import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolateColor, Easing } from 'react-native-reanimated';
import { FontAwesome } from '@expo/vector-icons'; // Top ikonu için

import { useEffect } from 'react';

export default function PitchesList({ pitches, selectedPitch, setSelectedPitch, handleCloseDetail, refreshing, onRefresh }) {

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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
      elevation: 10,
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

  const swipeGesture = Gesture.Pan().onUpdate((event) => {
    if (event.translationX > 100) {
      runOnJS(handleCloseDetail)();
    }
  });

  const featuresArray = selectedPitch?.features || [];

  if (selectedPitch) {
    return (
      <>
        <GestureDetector gesture={swipeGesture}>
          <View className="flex-1"> {/* Ana container'a flex-1 ekledik */}
            <ScrollView className="bg-white rounded-lg my-3 mx-4 p-4 shadow-md" contentContainerStyle={{ flexGrow: 1 }}>
              <View className="flex flex-col flex-1 justify-between items-center">
                <Text className="text-xl font-bold text-green-700 text-center mb-2">HALI SAHA ÖZETİ</Text>

                {selectedPitch.latitude && selectedPitch.longitude && Platform.OS !== "web" && (
                  <View className="w-full h-48 rounded-lg overflow-hidden my-2">
                    <MapView
                      style={{ width: "100%", height: "100%" }}
                      initialRegion={{
                        latitude: selectedPitch.latitude,
                        longitude: selectedPitch.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                    >
                      <Marker coordinate={{ latitude: selectedPitch.latitude, longitude: selectedPitch.longitude }} title={selectedPitch.name} />
                    </MapView>
                  </View>
                )}

                <View>
                  <Text className="text-xl text-green-700 font-semibold text-center mt-4">{selectedPitch.name}</Text>
                </View>

                <View>
                  <Text className="text-lg font-semibold text-green-700 text-center mt-4">Açık Adres</Text>
                  <View className="flex-row justify-center items-center">
                    <Ionicons name="location-outline" size={20} color="green" />
                    <Text className="pl-2 text-gray-700 font-semibold">{selectedPitch.address}</Text>
                  </View>
                </View>

                <View>
                  <Text className="text-lg font-semibold text-green-700 text-center mt-4">Saha Ücreti</Text>
                  <View className="flex-row justify-center items-center">
                    <Ionicons name="wallet-outline" size={18} color="green" />
                    <Text className="pl-2 text-gray-700 font-semibold">{selectedPitch.price} ₺</Text>
                  </View>
                </View>

                <View>
                  <Text className="text-lg font-semibold text-green-700 text-center mt-3 mb-2">Sahanın Özellikleri</Text>
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

                {/* Geri dön butonunu en alta sabitledik */}
                <View className="mt-auto mb-2"> {/* mt-auto ile en alta itiyoruz */}
                  <TouchableOpacity
                    className="w-1/2 self-center bg-green-700 px-4 py-2 rounded"
                    onPress={handleCloseDetail}
                  >
                    <Text className="text-white font-bold text-center p-1">Geri dön</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </ScrollView>
          </View>
        </GestureDetector>

        {/* Maç Oluştur Butonu */}
        {/* <TouchableOpacity
          onPress={() => handleSelectPitch(selectedPitch.id)}
          className="absolute right-6 top-1/2 transform -translate-y-1/2 bg-green-600 px-4 py-3 rounded-full shadow-lg"
        >
          <Text className="text-white font-bold text-center leading-tight">
            Maç{"\n"}Yap
          </Text>
        </TouchableOpacity> */}

        <Animated.View
          style={[
            animatedStyle,
            {
              position: 'absolute',
              right: 24,
              top: '47.5%',
              transform: [{ translateY: 0 }],
              borderRadius: 9999,
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
