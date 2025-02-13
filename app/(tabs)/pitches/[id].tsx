import { useEffect, useState } from "react";
import { Text, View, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router"; // URL parametresini almak için
import { supabase } from '@/services/supabase';

export default function PitchDetail() {
  const { id } = useLocalSearchParams(); // URL'den gelen saha ID'sini al
  const [pitch, setPitch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPitchDetails = async () => {
      const { data, error } = await supabase
        .from("pitches")
        .select("id, name, address, features, score")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Detay çekme hatası:", error);
      } else {
        setPitch(data);
      }
      setLoading(false);
    };

    if (id) fetchPitchDetails();
  }, [id]);

  if (loading) {
    return <ActivityIndicator size="large" color="green" className="flex-1 justify-center items-center" />;
  }

  if (!pitch) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-lg font-bold">Saha bulunamadı!</Text>
      </View>
    );
  }

  return (
    <View className="bg-slate-100 flex-1 p-4">
      <Text className="text-xl font-bold mb-2">{pitch.name}</Text>
      <Text className="text-base text-gray-600">Adres: {pitch.address}</Text>
      <Text className="text-base text-gray-600">Özellikler: {pitch.features}</Text>
      <Text className="text-base text-gray-600">Skor: {pitch.score}</Text>
    </View>
  );
}
