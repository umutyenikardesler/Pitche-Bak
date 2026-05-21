import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, Pressable } from "react-native";
import { useRef } from "react";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "./types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import '@/global.css';
import MatchShareModal from "@/components/share/MatchShareModal";

interface OtherMatchesProps {
  matches: Match[];
  refreshing: boolean;
  onRefresh: () => void;
  onSelectMatch: (match: Match) => void;
  onCreateMatch: () => void;
  isGuest?: boolean;
}

const formatTitle = (text: string) => {
  if (!text) return "";
  const formattedText = text.charAt(0).toUpperCase() + text.slice(1);
  return formattedText.length > 23 ? formattedText.slice(0, 23) + "..." : formattedText;
};

export default function OtherMatches({ matches, refreshing, onRefresh, onSelectMatch, onCreateMatch, isGuest }: OtherMatchesProps) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const INITIAL_VISIBLE = 7;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [sortMode, setSortMode] = useState<"distance" | "datetime">("datetime");
  const [headerHeight, setHeaderHeight] = useState(48);
  const [shareMatch, setShareMatch] = useState<Match | null>(null);

  // Maç listesi değiştiğinde görünür sayıyı resetle
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [matches.length]);

  const sortedMatches = (() => {
    const arr = [...matches];
    if (sortMode === "datetime") {
      arr.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return a.time.localeCompare(b.time);
      });
      return arr;
    }

    // distance: Yakından -> Uzağa (distance yoksa sona)
    arr.sort((a, b) => {
      const da = a.distance ?? Number.MAX_SAFE_INTEGER;
      const db = b.distance ?? Number.MAX_SAFE_INTEGER;
      if (Math.abs(da - db) > 0.0001) return da - db;
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return a.time.localeCompare(b.time);
    });
    return arr;
  })();

  const renderMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity onPress={() => onSelectMatch(item)}>
     <View className="rounded-lg mx-4 mt-1 p-1 shadow-lg" style={{ backgroundColor: colors.surface }}>
        <View className="flex-row items-center justify-between">
          {/* Profil Resmi */}
          <View className="w-1/5 flex justify-center p-1 py-1.5">
            <Image
              source={Array.isArray(item.users) ? (item.users[0]?.profile_image
                ? { uri: item.users[0].profile_image }
                : require('@/assets/images/ball.png')) : (item.users?.profile_image
                ? { uri: item.users.profile_image }
                : require('@/assets/images/ball.png'))}
              className="rounded-full mx-auto"
              style={{ width: 60, height: 60, resizeMode: 'contain' }}
            />
          </View>
          {/* Maç Bilgileri */}
          <View className="w-4/6 flex justify-center -mt-2 ml-2">
            <View className="flex-row items-center" style={{ width: "100%", marginTop: 5 }}>
              <Text
                className="text-lg font-semibold"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ flex: 1, minWidth: 0, paddingRight: 8, color: colors.primaryDark }}
              >
                {formatTitle(item.title)}
              </Text>
            </View>

            <View className="text-md flex-row items-center">
              <Ionicons name="calendar-outline" size={18} color={colors.icon} />
              <Text className="pl-2 font-semibold" style={{ color: colors.text }}> {item.formattedDate} →</Text>
              <Text className="pl-2 font-bold" style={{ color: colors.primaryDark }}> {item.startFormatted}-{item.endFormatted} </Text>
            </View>

            <View className="text-md flex-row items-start pt-1" style={{ width: "100%" }}>
              <Ionicons name="location" size={18} color={colors.icon} />
              <View style={{ flex: 1, minWidth: 0, paddingRight: 8, paddingLeft: 10 }}>
                <Text className="font-semibold" style={{ flexWrap: "wrap", color: colors.text }}>
                  {
                    Array.isArray(item.pitches)
                      ? (Array.isArray(item.pitches[0]?.districts)
                          ? item.pitches[0]?.districts[0]?.name
                          : item.pitches[0]?.districts?.name)
                      : (Array.isArray(item.pitches?.districts)
                          ? item.pitches?.districts[0]?.name
                          : item.pitches?.districts?.name)
                    ?? 'Bilinmiyor'
                  }{" "}
                  →
                  <Text className="font-bold" style={{ color: colors.primaryDark }}>
                    {" "}
                    {Array.isArray(item.pitches) ? item.pitches[0]?.name : item.pitches?.name ?? 'Bilinmiyor'}
                  </Text>
                </Text>
              </View>
            </View>
          </View>
          {/* Sağ ok alanı: dikeyde 3 bölüm (paylaş / ok / boş) */}
          <View
            style={{
              width: 32,
              minWidth: 32,
              marginRight: 0,
              paddingVertical: 3,
              alignSelf: "stretch",
              alignItems: "stretch",
            }}
          >
            {/* Üst: Paylaş */}
            <View style={{ flex: 1, justifyContent: "flex-start", alignItems: "flex-end" }}>
              <TouchableOpacity
                onPress={() => setShareMatch(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 4, marginRight: 2 }}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Orta: Ok */}
            <View style={{ flex: 1, justifyContent: "center", alignItems: "flex-end", marginRight: 5 }}>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.primary} />
            </View>

            {/* Alt: boş */}
            <View style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const DROPDOWN_WIDTH = 220;
  const GAP = 5;

  return (
    <View className="flex-1">
      <View
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        className="flex-row items-center justify-between p-2 pr-4 bg-green-700"
      >
        <View className="flex-row items-center" style={{ flex: 1, flexShrink: 1, marginRight: 10 }}>
          <Ionicons name="alarm-outline" size={16} color="white" className="pl-2" />
          <Text
            className="font-bold text-white"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ flexShrink: 1 }}
          >
            {" "}{t('home.incompleteSquadMatches')}{" "}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setSortMenuOpen((p) => !p)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t("home.sort.open")}
            style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 10,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.85)",
            flexShrink: 0,
          }}
        >
          <Ionicons name="options-outline" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "900", marginLeft: 6, fontSize: 12 }}>
            {sortMode === "distance" ? t("home.sort.distanceShort") : t("home.sort.datetimeShort")}
          </Text>
        </TouchableOpacity>
      </View>

      {sortMenuOpen && (
        <>
          <Pressable
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.35)", zIndex: 10 }}
            onPress={() => setSortMenuOpen(false)}
          />
          <View
            style={{
              position: "absolute",
              top: headerHeight + GAP,
              right: 16,
              width: DROPDOWN_WIDTH,
              backgroundColor: "white",
              borderRadius: 14,
              paddingVertical: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
              elevation: 12,
              zIndex: 11,
            }}
          >
            <Text style={{ paddingHorizontal: 14, paddingVertical: 8, fontWeight: "900", color: "#111827" }}>
              {t("home.sort.title")}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setSortMode("distance");
                setSortMenuOpen(false);
              }}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: sortMode === "distance" ? "rgba(22,163,74,0.12)" : "transparent",
              }}
            >
              <Ionicons name="navigate-outline" size={18} color={sortMode === "distance" ? "#16a34a" : "#111827"} />
              <Text style={{ marginLeft: 10, fontWeight: "800", color: "#111827" }}>
                {t("home.sort.distance")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setSortMode("datetime");
                setSortMenuOpen(false);
              }}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: sortMode === "datetime" ? "rgba(22,163,74,0.12)" : "transparent",
              }}
            >
              <Ionicons name="calendar-outline" size={18} color={sortMode === "datetime" ? "#16a34a" : "#111827"} />
              <Text style={{ marginLeft: 10, fontWeight: "800", color: "#111827" }}>
                {t("home.sort.datetime")}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {matches.length === 0 && !refreshing ? (
        <View className='flex justify-center items-center py-4'>
          <Text className="text-center font-bold my-1" style={{ color: colors.text }}>{t('home.noIncompleteSquadMatches')}</Text>
          <TouchableOpacity
            className="bg-green-600 rounded-md my-3 items-center self-center"
            style={{
              alignSelf: 'center',
              paddingHorizontal: 18,
              paddingVertical: 14,
              maxWidth: '92%',
            }}
            onPress={onCreateMatch}
          >
            <Text
              className="text-white font-semibold text-center"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
            >
              {t('home.createMatchNow')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : matches.length === 0 && refreshing ? (
        <View className='flex justify-center items-center py-4'>
          <Text className="text-center font-bold" style={{ color: colors.textMuted }}>{t('home.matchesLoading')}</Text>
        </View>
      ) : (
        <FlatList
          data={sortedMatches.slice(0, visibleCount)}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMatch}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          style={{ paddingTop: 3, paddingBottom: 5 }}
          contentContainerStyle={{ paddingBottom: matches.length > 2 ? 7 : 0 }}
          scrollEnabled={true} // OtherMatches her zaman scroll edilebilir olmalı
          showsVerticalScrollIndicator={true}
          extraData={{ matches, visibleCount }}
          removeClippedSubviews={true} // Performans için
          maxToRenderPerBatch={5} // Performans için
          windowSize={5} // Performans için
          ListFooterComponent={
            matches.length > visibleCount ? (
              <View className="items-center my-3">
                <TouchableOpacity
                  onPress={() => setVisibleCount((prev: number) => prev + INITIAL_VISIBLE)}
                  className="px-4 py-2 rounded-md"
                  style={{ backgroundColor: '#e5e7eb' }}
                >
                  <Text className="text-green-700 font-semibold">
                    {t('home.showMore')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}

      <MatchShareModal visible={!!shareMatch} match={shareMatch} onClose={() => setShareMatch(null)} />
    </View>
  );
}