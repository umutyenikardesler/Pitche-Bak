import { FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker } from "react-native-maps";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter } from "expo-router"; // Router'ı getir
import { useNavigation } from '@react-navigation/native';

export default function PitchesList({ pitches, selectedPitch, setSelectedPitch, handleCloseDetail, refreshing, onRefresh }) 
{

  const router = useRouter();

  const handleSelectPitch = async (pitchId: string) => {
  const { data, error } = await supabase
    .from("pitches")
    .select("id, district_id, name, price")
    .eq("id", pitchId)
    .single();

  if (error) {
    console.error("Saha verisi alınamadı:", error);
    return;
  }

  router.push({
    pathname: "/create", // sadece /create yaz, (tabs) route'a dahil değil
    params: {
      pitchId: data.id,
      district: data.district_id,
      name: data.name,
      price: data.price,
    },
  });
};

  const swipeGesture = Gesture.Pan().onUpdate((event) => {
    if (event.translationX > 100) {
      runOnJS(handleCloseDetail)();
    }
  });

  const featuresArray = selectedPitch?.features || [];

  if (selectedPitch) 
    {
        return (
            <>
                <GestureDetector gesture={swipeGesture}>
                    <ScrollView className="flex-1">
                    <View className="bg-white p-4 rounded-lg mx-4 mt-2 shadow-lg">
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

                        <Text className="text-xl text-green-700 font-semibold text-center mt-4">{selectedPitch.name}</Text>

                        <Text className="text-lg font-semibold text-green-700 text-center mt-4">Açık Adres</Text>
                        <View className="flex-row justify-center items-center">
                        <Ionicons name="location-outline" size={20} color="green" />
                        <Text className="pl-2 text-gray-700 font-semibold">{selectedPitch.address}</Text>
                        </View>

                        <Text className="text-lg font-semibold text-green-700 text-center mt-4">Saha Ücreti</Text>
                        <View className="flex-row justify-center items-center">
                        <Ionicons name="wallet-outline" size={18} color="green" />
                        <Text className="pl-2 text-gray-700 font-semibold">{selectedPitch.price} ₺</Text>
                        </View>

                        <Text className="text-lg font-semibold text-green-700 text-center mt-4">Sahanın Özellikleri</Text>
                        <View className="flex-row flex-wrap justify-center">
                        {featuresArray.map((feature, index) => (
                            <View key={index} className="w-1/2 mb-1">
                            <View className="flex-row p-2 bg-green-700 rounded mr-1 items-center justify-center">
                                <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                                <Text className="text-white pl-1">{feature}</Text>
                            </View>
                            </View>
                        ))}
                        </View>

                        <TouchableOpacity className="w-1/2 self-center mt-6 bg-green-700 px-4 py-2 rounded" onPress={handleCloseDetail}>
                        <Text className="text-white font-bold text-center">Geri dön</Text>
                        </TouchableOpacity>
                    </View>
                    </ScrollView>
                </GestureDetector>

                {/* Maç Oluştur Butonu */}
                <TouchableOpacity
                onPress={() => handleSelectPitch(selectedPitch.id)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-green-600 px-4 py-3 rounded-full shadow-lg"
                >
                <Text className="text-white font-bold text-center leading-tight">
                    Maç{"\n"}Oluştur
                </Text>
                </TouchableOpacity>
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
