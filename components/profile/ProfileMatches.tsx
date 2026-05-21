import { useState, useEffect, useCallback } from "react";
import { ScrollView, Text, View, RefreshControl, Dimensions, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";

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
  userData: { id: string } | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  // Profile ekranında eski davranış (sabit yükseklik + kendi scroll'u).
  // Modal içinde nested scroll sorun çıkardığı için modal modunda iç scroll kullanılmaz.
  mode?: "profile" | "modal";
};

export default function ProfileMatches({
  userData,
  refreshing = false,
  onRefresh,
  mode = "profile",
}: Props) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);

  // Sayfa odaklandığında maçları yeniden çek
  useFocusEffect(
    useCallback(() => {
      if (userData?.id) {
        fetchUserMatches();
      }
    }, [userData?.id])
  );

  // useEffect'i de koruyalım (ilk yükleme için)
  useEffect(() => {
    if (userData?.id) {
      fetchUserMatches();
    }
  }, [userData?.id]);

  const fetchUserMatches = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("match")
        .select("*, pitches (name, districts (name))")
        .eq("create_user", userData?.id)
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
    <View
      className="flex mb-2"
      style={
        mode === "profile"
          ? { height: Dimensions.get("window").height * (Platform.OS === "ios" ? 0.380 : 0.378) }
          : undefined
      }
    >
      {/* Maç Listesi ve İçeriği */}
      <View className="flex-row justify-center items-center my-2">
        <Ionicons name="calendar-outline" size={16} color="green" className="" />
        <Text className="font-bold mx-1" style={{ color: colors.primaryDark }}> {t('profile.myMatches')} </Text>
      </View>

      {/* Maç Listesi */}
      <View className={mode === "profile" ? "flex-1 mb-2" : "mb-2"}>
        {loading ? (
          <Text className="text-center mb-4" style={{ color: colors.textMuted }}>{t('general.loading')}</Text>
        ) : matches.length > 0 ? (
          mode === "profile" ? (
            <ScrollView
              className="mb-2 h-auto"
              style={{ marginBottom: 0 }}
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={handleRefresh}
                  colors={["#16a34a"]}
                  tintColor="#16a34a"
                />
              }
            >
              {matches.map((item) => (
                <View key={item.id.toString()} className="rounded-lg p-2 mx-4 mt-1 mb-1 shadow-sm justify-center items-center" style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.primary }}>
                  <Text className="font-bold mb-1" style={{ color: colors.primaryDark }}>{item.title}</Text>
                  <View className="text-gray-700 text-md flex-row items-center">
                    <Ionicons name="calendar-outline" size={18} color={colors.icon} />
                    <Text className="pl-2 font-semibold" style={{ color: colors.text }}>
                      {item.formattedDate}
                      {"  →"}
                    </Text>
                    <Text className="pl-2 font-bold" style={{ color: colors.primary }}>{item.startFormatted}-{item.endFormatted}</Text>
                  </View>
                  <View className="pt-1" style={{ width: "100%", paddingHorizontal: 0, alignItems: "center" }}>
                    <View style={{ maxWidth: "92%", flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="location-outline" size={18} color={colors.icon} />
                      <Text
                        className="font-semibold"
                        style={{ color: colors.text, marginLeft: 5, flexShrink: 1, textAlign: "center" }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.pitches?.districts?.name ?? ""}
                        {"  → "}
                        <Text className="font-bold" style={{ color: colors.primaryDark }}>
                          {item.pitches?.name ?? ""}
                        </Text>
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            // Modal modunda: inner ScrollView YOK (nested scroll iOS'ta kilitleniyor)
            <View style={{ marginBottom: 0 }}>
              {matches.map((item) => (
                <View key={item.id.toString()} className="rounded-lg p-2 mx-4 mt-1 mb-1 shadow-sm justify-center items-center" style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.primary }}>
                  <Text className="font-bold mb-1" style={{ color: colors.primaryDark }}>{item.title}</Text>
                  <View className="text-gray-700 text-md flex-row items-center">
                    <Ionicons name="calendar-outline" size={18} color={colors.icon} />
                    <Text className="pl-2 font-semibold" style={{ color: colors.text }}>
                      {item.formattedDate}
                      {"  →"}
                    </Text>
                    <Text className="pl-2 font-bold" style={{ color: colors.primary }}>{item.startFormatted}-{item.endFormatted}</Text>
                  </View>
                  <View className="pt-1" style={{ width: "100%", paddingHorizontal: 5, alignItems: "center" }}>
                    <View style={{ maxWidth: "92%", flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="location-outline" size={18} color={colors.icon} />
                      <Text
                        className="font-semibold"
                        style={{ color: colors.text, marginLeft: 5, flexShrink: 1, textAlign: "center" }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.pitches?.districts?.name ?? ""}
                        {"  → "}
                        <Text className="font-bold" style={{ color: colors.primaryDark }}>
                          {item.pitches?.name ?? ""}
                        </Text>
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          <Text className="text-center mb-4" style={{ color: colors.textMuted }}>Henüz maç oluşturmadınız!</Text>
        )}
      </View>
    </View>
  );
}
