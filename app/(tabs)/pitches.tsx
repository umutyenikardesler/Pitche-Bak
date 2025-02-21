import { useEffect, useState } from "react";
import { Text, View, FlatList, ActivityIndicator, TouchableOpacity, TextInput, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { supabase } from "@/services/supabase";
import haversine from "haversine";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

export default function Pitches() {
  const [pitches, setPitches] = useState([]);
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationText, setLocationText] = useState("Konum alınıyor...");

  useEffect(() => {
    fetchPitches();
  }, []);

  const fetchPitches = async (userLat?: number, userLon?: number) => {
    setLoading(true);

    const { data, error } = await supabase.from("pitches").select("id, name, address, features, score, latitude, longitude");

    if (error) {
      console.error("Veri çekme hatası:", error);
      setLoading(false);
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
  };

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      alert("Konum izni reddedildi!");
      return;
    }

    const userLocation = await Location.getCurrentPositionAsync({});
    const { latitude, longitude } = userLocation.coords;

    setLocation({ latitude, longitude });

    // Mobil için expo-location kullan
  if (Platform.OS !== "web") {
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
  } 
  // Web için OpenStreetMap Nominatim API kullan
  else {
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
};

  const handleSelectPitch = (pitch) => {
    setSelectedPitch(pitch);
  };

  const handleCloseDetail = () => {
    setSelectedPitch(null);
  };

  const swipeGesture = Gesture.Pan().onUpdate((event) => {
    if (event.translationX > 100) {
      runOnJS(handleCloseDetail)();
    }
  });

  if (loading) {
    return <ActivityIndicator size="large" color="green" className="flex-1 justify-center items-center" />;
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="bg-slate-100 flex-1">
        <View className="p-4 bg-white shadow-md">
          <Text className="text-lg font-bold mb-2">Konumuna Göre Halı Sahaları Listele</Text>
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

        {selectedPitch ? (
          <GestureDetector gesture={swipeGesture}>
            <View className="flex-1 bg-white p-4">
              <Text className="text-xl font-bold mb-2">{selectedPitch.name}</Text>
              <Text className="text-gray-600">{selectedPitch.address}</Text>
              <Text className="text-gray-600">{selectedPitch.features}</Text>
              <Text className="text-gray-600">{selectedPitch.score}</Text>
              <TouchableOpacity className="mt-4 bg-blue-500 px-4 py-2 rounded" onPress={handleCloseDetail}>
                <Text className="bg-green text-white font-bold">Geri dön</Text>
              </TouchableOpacity>
              {/* <Text className="text-sm text-gray-500 mt-2">{"← Sağa kaydırarak geri dönebilirsiniz."}</Text> */}
            </View>
          </GestureDetector>
        ) : (
          <FlatList
            data={pitches}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSelectPitch(item)}>
                <View className="bg-white rounded-lg mx-4 mt-3 p-3 shadow-md">
                  <View className="flex-row justify-between ">
                    <Text className="w-4/6 text-base font-semibold">{item.name}</Text>
                    <Text className="w-1/6 text-right text-sm text-gray-500">{item.distance?.toFixed(2)} km</Text>
                    <Ionicons className="w-3 text-right" name="chevron-forward-outline" size={16} color="green" />
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}