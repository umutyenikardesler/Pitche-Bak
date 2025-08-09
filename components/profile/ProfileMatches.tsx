import { useState, useEffect, useCallback } from "react";
import { FlatList, Text, View, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";
import { useFocusEffect } from "@react-navigation/native";

type Match = {
  id: number;
  title: string;
  date: string;
  time: string;
  pitches?: {
    name?: string;
    districts?: { name?: string };
  };
  formattedDate?: string;
  startFormatted?: string;
  endFormatted?: string;
};

type Props = {
  userData: { id: string };
  refreshing?: boolean;
  onRefresh?: () => void;
};

export default function ProfileMatches({ userData, refreshing = false, onRefresh }: Props) {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);

  // Sayfa odaklandığında maçları yeniden çek
  useFocusEffect(
    useCallback(() => {
      if (userData && userData.id) {
        fetchUserMatches();
      }
    }, [userData?.id])
  );

  // useEffect'i de koruyalım (ilk yükleme için)
  useEffect(() => {
    if (userData && userData.id) {
      fetchUserMatches();
    }
  }, [userData?.id]);

  const fetchUserMatches = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("match")
        .select("*, pitches (name, districts (name))")
        .eq("create_user", userData.id)
        .order("date", { ascending: false })
        .order("time", { ascending: false });

      if (error) {
        console.error("Maçları çekerken hata oluştu:", error);
        setMatches([]);
      } else {
        const formattedData = data.map((item) => ({
          ...item,
          formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
          startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
          endFormatted: `${parseInt(item.time.split(":")[0], 10) + 1}:${item.time.split(":")[1]}`,
        }));

        setMatches(formattedData);
      }
    } catch (error) {
      console.error("Maçları çekerken beklenmeyen hata:", error);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh için handleRefresh fonksiyonu
  const handleRefresh = async () => {
    if (onRefresh) {
      onRefresh();
    } else {
      await fetchUserMatches();
    }
  };

  return (
    <View className="flex mb-2">
      {/* Maç Listesi ve İçeriği */}
      <View className="flex-row justify-center items-center my-1 mb-2.5">
        <Ionicons name="accessibility" size={16} color="green" className="pl-2" />
        <Text className="font-bold text-green-700"> MAÇLARIM </Text>
      </View>

      {/* Maç Listesi */}
      <View className="flex-1 mb-2">
        {loading ? (
          <Text className="text-center mb-4 text-gray-500">Yükleniyor...</Text>
        ) : matches.length > 0 ? (
          <FlatList
            className="mb-2 h-full"
            data={matches}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View className="bg-gray-100 rounded-lg p-2 mx-4 mt-1 mb-1 shadow-sm flex-1 justify-center items-center">
                <Text className="text-green-700 font-bold mb-1">{item.title}</Text>
                <View className="text-gray-700 text-md flex-row items-center">
                  <Ionicons name="calendar-outline" size={18} color="black" />
                  <Text className="pl-2 font-semibold">{item.formattedDate} →</Text>
                  <Text className="pl-2 font-bold text-green-600">{item.startFormatted}-{item.endFormatted}</Text>
                </View>
                <View className="text-gray-700 text-md flex-row items-center pt-1">
                  <Ionicons name="location" size={18} color="black" />
                  <Text className="pl-2 font-semibold">{item.pitches?.districts?.name ?? ""} →</Text>
                  <Text className="pl-2 font-bold text-green-700">{item.pitches?.name ?? ""}</Text>
                </View>
              </View>
            )}
            style={{ maxHeight: 325, marginBottom: 0 }}
            nestedScrollEnabled={true}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh}
                colors={["#16a34a"]} // Android için yeşil renk
                tintColor="#16a34a" // iOS için yeşil renk
              />
            }
          />
        ) : (
          <Text className="text-center mb-4 text-gray-500">Henüz maç oluşturmadınız!</Text>
        )}
      </View>
    </View>
  );
}
