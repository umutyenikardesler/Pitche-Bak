import { useEffect, useState } from "react";
import { Text, View, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router"; // Sayfa yönlendirme için
import { supabase } from '@/services/supabase';

export default function Pitches() {
  const [pitches, setPitches] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter(); // Router'ı kullan

  useEffect(() => {
    const fetchPitches = async () => {
      const { data, error } = await supabase.from("pitches").select("id, name");

      if (error) {
        console.error("Veri çekme hatası:", error);
      } else {
        setPitches(data);
      }
      setLoading(false);
    };

    fetchPitches();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color="green" className="flex-1 justify-center items-center" />;
  }

  return (
    <View className="bg-slate-100 flex-1">
      <FlatList
        data={pitches}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => router.push(`/pitches/${item.id}`)} // Tıklandığında detay sayfasına git
          >
            <View className="bg-white rounded-lg mx-4 mt-3 p-3 shadow-md">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-semibold">{item.name}</Text>
                <Ionicons name="chevron-forward-outline" size={16} color="green" />
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
