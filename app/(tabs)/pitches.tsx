import { useEffect, useState } from "react";
import { Text, View, FlatList, ActivityIndicator, TouchableOpacity, TextInput, Pressable, Platform, Alert, RefreshControl, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { supabase } from "@/services/supabase";
import haversine from "haversine";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker } from "react-native-maps";

export default function Pitches() {
  const [pitches, setPitches] = useState([]);
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // ⬅️ Pull-to-refresh state
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationText, setLocationText] = useState("Konum alınıyor...");
  const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);

  useEffect(() => {
    fetchPitches();
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const storedPermissionStatus = await AsyncStorage.getItem("locationPermissionStatus");

      if (storedPermissionStatus === "granted") {
        setLocationPermissionStatus("granted");
        getLocation();
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermissionStatus(status);
        await AsyncStorage.setItem("locationPermissionStatus", status);

        if (status !== "granted") {
          Alert.alert("Konum izni gerekli", "Uygulamayı kullanmak için konum izni vermeniz gerekiyor.", [{ text: "Tamam" }]);
        }
      }
    } catch (error) {
      console.error("İzin kontrolünde hata:", error);
    }
  };

  const fetchPitches = async (userLat?: number, userLon?: number) => {
    setLoading(true);

    const { data, error } = await supabase.from("pitches").select("id, name, address, features, score, latitude, longitude");

    if (error) {
      console.error("Veri çekme hatası:", error);
      setLoading(false);
      setRefreshing(false); // ⬅️ Refresh tamamlandı
      return;
    }

    if (userLat && userLon) {
      const sortedPitches = data
        .map((pitch) => ({
          ...pitch,
          distance: haversine(
            { latitude: userLat, longitude: userLon },
            { latitude: pitch.latitude, longitude: pitch.longitude },
            { unit: "km" }
          ),
        }))
        .sort((a, b) => a.distance - b.distance);

      setPitches(sortedPitches);
    } else {
      setPitches(data);
    }

    setLoading(false);
    setRefreshing(false); // ⬅️ Refresh tamamlandı
  };

  const getLocation = async () => {
    if (locationPermissionStatus !== "granted") return;

    try {
      const userLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = userLocation.coords;

      setLocation({ latitude, longitude });

      if (Platform.OS === "ios") {
        try {
          const address = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (address.length > 0) {
            const { name, subregion, region } = address[0];
            let formattedAddress = `${name ? name + ", " : ""}${subregion ? subregion + ", " : ""}${region || ""}`.trim();
            setLocationText(formattedAddress || "Adres bulunamadı.");
          } else {
            setLocationText("Adres bulunamadı.");
          }
        } catch (error) {
          console.error("Adres çözümlenemedi:", error);
          setLocationText("Adres alınamadı.");
        }
      } else if (Platform.OS === "android") {
        try {
          const address = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (address.length > 0) {
            const { street, name, subregion, region } = address[0];
            let formattedAddress = `${street ? street + ", " : ""}${name ? name + ", " : ""}${subregion ? subregion + ", " : ""}${region || ""}`.trim();
      
            setLocationText(formattedAddress || "Adres bulunamadı.");
          } else {
            setLocationText("Adres bulunamadı.");
          }
        } catch (error) {
          console.error("Adres çözümlenemedi:", error);
          setLocationText("Adres alınamadı.");
        }
      } else {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();

          if (data.display_name) {
            setLocationText(data.display_name);
          } else {
            setLocationText("Adres bulunamadı.");
          }
        } catch (error) {
          console.error("Web'de adres alınamadı:", error);
          setLocationText("Adres alınamadı.");
        }
      }

      fetchPitches(latitude, longitude);
    } catch (error) {
      console.error("Konum alınırken hata:", error);
      setLocationText("Konum alınamadı.");
      Alert.alert("Konum Hatası", "Konum bilgisi alınamadı. Lütfen tekrar deneyin.", [{ text: "Tamam" }]);
    }
  };

  const handleSelectPitch = (pitch) => {
    setSelectedPitch(pitch);
  };

  const handleCloseDetail = () => {
    setSelectedPitch(null);
  };

  const onRefresh = async () => {
    setRefreshing(true); // ⬅️ Refresh başladı
    await fetchPitches(location?.latitude, location?.longitude);
  };

  const swipeGesture = Gesture.Pan().onUpdate((event) => {
    if (event.translationX > 100) {
      runOnJS(handleCloseDetail)();
    }
  });

  const featuresArray = selectedPitch?.features 
  ? Array.isArray(selectedPitch.features) 
    ? selectedPitch.features 
    : [] 
  : [];

  if (loading) {
    return <ActivityIndicator size="large" color="green" className="flex-1 justify-center items-center" />;
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="bg-slate-100 flex-1 ">
        <View className="p-4 bg-white">
          <Text className="text-lg font-bold mb-2 text-green-700 text-center">Konumuna Göre Halı Sahaları Listele</Text>
          <View className="flex-row items-center space-x-2">
            <TextInput
              className="border flex-1 p-2 rounded-md border-gray-300 mr-2"
              placeholder="Adresin"
              value={locationText}
              onChangeText={setLocationText}
            />
            <Pressable className="bg-green-600 px-4 py-2 rounded-md" onPress={getLocation}>
              <Text className="text-white font-bold">Konumunu Bul</Text>
            </Pressable>
          </View>
        </View>

        {/* HALI SAHA ÖZETİ */}

        {selectedPitch ? (
          <GestureDetector gesture={swipeGesture}>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <View className="flex-1 bg-white p-4 rounded-lg mx-4 mt-1.5 mb-1 shadow-lg">

              <View className="flex-row my-2 justify-center">
                <Ionicons name="accessibility-outline" size={16} color="green" className="pt-1" />
                <Text className=" h-7 text-xl font-bold text-green-700 "> HALI SAHA ÖZETİ </Text>
              </View>

              {/* 🌍 Harita Buraya Eklendi */}
              {selectedPitch?.latitude && selectedPitch?.longitude && ( 
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
                    <Marker
                      coordinate={{
                        latitude: selectedPitch.latitude,
                        longitude: selectedPitch.longitude,
                      }}
                      title={selectedPitch.name}
                    />
                  </MapView>
                </View>
              )}

              <Text className="text-xl text-green-700 font-semibold text-center mt-4">{selectedPitch.name}</Text>

              <View className="">
                <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">Açık Adres</Text>
              </View>
              <View className=" text-gray-700 text-md flex-row justify-center items-center pt-1">
                <Ionicons name="location" size={20} color="black" />
                <Text className="pl-2 font-semibold text-gray-700 text-center">{selectedPitch.address}</Text>
              </View>

              <View>
                <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-4">Sahanın Özellikleri</Text>
              </View>
              <View className="flex-row flex-wrap justify-center items-center pt-1">
                {featuresArray.map((feature, index) => (
                  <View key={index} className="w-1/2 mb-1">
                    <View className="flex-row p-2 bg-green-700 rounded mr-1 items-center justify-center">
                      <Ionicons name="checkmark-circle-outline" size={16} color="white" className="" />
                      <Text className="text-white pl-1">{feature}</Text>
                    </View>
                  </View>
                ))}
              </View>
              
              {/* <Text className="text-gray-600">{selectedPitch.score}</Text> */}

              <View className="flex-1 flex-col-reverse justifyy-end items-center">
                <TouchableOpacity className="w-1/2 items-center mt-4 bg-green-700 px-4 py-2 rounded " onPress={handleCloseDetail}>
                  <Text className="text-white font-bold">Geri dön</Text>
                </TouchableOpacity>
              </View>
              
            </View>
            </ScrollView>
          </GestureDetector>
        ) : (
          <FlatList
            data={pitches}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSelectPitch(item)}>
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
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}
