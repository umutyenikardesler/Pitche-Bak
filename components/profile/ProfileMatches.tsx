import { useState, useEffect } from "react";
import { FlatList, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";

export default function ProfileMatches({ userData }) {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (userData && userData.id) {
      fetchUserMatches();
    }
  }, [userData]);

  const fetchUserMatches = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("match")
      .select("*, pitches (name, districts (name))")
      .eq("create_user", userData.id)
      .order("date", { ascending: false });

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
    setLoading(false);
  };

  return (
    <View className="flex mb-2">
      {/* Maç Listesi ve İçeriği */}
      <View className="flex-row mt-2 px-3 justify-center mb-2">
        <Ionicons name="accessibility" size={16} color="green" className="pl-2" />
        <Text className="font-bold text-green-700"> MAÇLARIM </Text>
      </View>

      {/* Maç Listesi */}
      <View className="flex mb-2">
        {loading ? (
          <Text className="text-center mb-4 text-gray-500">Yükleniyor...</Text>
        ) : matches.length > 0 ? (
          <FlatList
            className="mb-2"
            data={matches}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View className="bg-gray-100 rounded-lg p-3 mx-4 mt-2 mb-1 shadow-sm">
                <Text className="text-green-700 font-bold mb-2">{item.title}</Text>
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
            style={{ maxHeight: 290, marginBottom: 0 }}
            nestedScrollEnabled={true}
          />
        ) : (
          <Text className="text-center mb-4 text-gray-500">Henüz maç oluşturmadınız!</Text>
        )}
      </View>
    </View>
  );
}
