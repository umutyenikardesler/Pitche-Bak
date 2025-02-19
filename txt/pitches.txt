import { useEffect, useState } from "react";
import { Text, View, FlatList, ActivityIndicator, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import '@/global.css';

export default function Pitches() {
  const [pitches, setPitches] = useState([]);
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchPitches = async () => {
      const { data, error } = await supabase.from("pitches").select("id, name, address, features, score");

      if (error) {
        console.error("Veri çekme hatası:", error);
      } else {
        setPitches(data);
      }
      setLoading(false);
    };

    fetchPitches();
  }, []);

  const handleSelectPitch = (pitch) => {
    setSelectedPitch(pitch);
  };

  const handleCloseDetail = () => {
    setSelectedPitch(null);
  };

  // ✅ Güncellenmiş Swipe Gesture (Pan Gesture Kullanıldı)
  const swipeGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationX > 100) {
        runOnJS(handleCloseDetail)(); // Kullanıcı sağa kaydırdığında detay kapanır
      }
    });

  if (loading) {
    return (
      <ActivityIndicator size="large" color="green" className="flex-1 justify-center items-center" />
    );
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="bg-slate-100 flex-1">
        {selectedPitch ? (
          <GestureDetector gesture={swipeGesture}>
            <View className="flex-1 bg-white p-4">
              <Text className="text-xl font-bold mb-2">{selectedPitch.name}</Text>

              <View className="text-black text-xl flex-row items-center mb-1">
                <Ionicons name="location-outline" size={16} color="black" />
                <Text className=" text-gray-600"> {selectedPitch.address} </Text>
              </View>
              <View className="text-black text-base flex-row items-center mb-1">
                <Ionicons name="shield-checkmark-outline" size={16} color="black" />
                <Text className="text-base text-gray-600"> {selectedPitch.features} </Text>
              </View>
              <View className="text-black text-base flex-row items-center mb-1">
                <Ionicons name="ribbon-outline" size={16} color="black" />
                <Text className="text-base text-gray-600"> {selectedPitch.score} </Text>
              </View>

              {/* Kullanıcıya bilgi veren Text */}
              <Text className="text-sm text-gray-500 mt-2">
                {"← Sağa kaydırarak geri dönebilirsiniz."}
              </Text>
            </View>
          </GestureDetector>
        ) : (
          <FlatList
            data={pitches}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSelectPitch(item)}>
                <View className="bg-white rounded-lg mx-4 mt-3 p-3 shadow-md">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-base font-semibold">{item.name}</Text>
                    <Ionicons name="chevron-forward-outline" size={16} color="green" />
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
