import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, Platform } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "./types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import MatchShareModal from "@/components/share/MatchShareModal";

interface MyMatchesProps {
  matches: Match[];
  refreshing: boolean;
  onRefresh: () => void;
  onSelectMatch: (match: Match) => void;
  onCreateMatch: () => void;
}

const formatTitle = (text: string) => {
  if (!text) return "";
  const formattedText = text.charAt(0).toUpperCase() + text.slice(1);
  // Başlığı burada zorla kesmeyelim; Text içinde ellipsis ile sığdıracağız.
  return formattedText;
};

export default function MyMatches({ matches, refreshing, onRefresh, onSelectMatch, onCreateMatch }: MyMatchesProps) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const [shareMatch, setShareMatch] = useState<Match | null>(null);
  
  // react-native-reanimated ile yumuşak yanıp sönme animasyonu
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.5, {
        duration: 1000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // Sonsuz döngü
      true // Reverse (geriye doğru da animasyon yap)
    );
  }, []);

  // Animated style'ı component seviyesinde tanımla
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Maçın şu anda oynanıp oynanmadığını kontrol eden fonksiyon
  const isMatchCurrentlyPlaying = (match: Match) => {
    const now = new Date();
    const turkeyOffset = 3; // UTC+3 için offset
    const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const turkeyNow = new Date(utcNow.getTime() + (turkeyOffset * 3600000));
    
    const today = turkeyNow.toLocaleDateString('en-CA'); // YYYY-MM-DD formatında
    const currentHours = turkeyNow.getHours();
    const currentMinutes = turkeyNow.getMinutes();
    
    // Eğer maç bugünkü değilse false
    if (match.date !== today) {
      return false;
    }
    
    const [matchHours, matchMinutes] = match.time.split(":").map(Number);
    const matchEndHour = matchHours + 1;
    
    // Maç şu anda oynanıyor mu veya henüz bitmemiş mi kontrol et
    const matchStartTime = matchHours * 60 + matchMinutes;
    const matchEndTime = matchEndHour * 60 + matchMinutes;
    const currentTime = currentHours * 60 + currentMinutes;
    
    // Maç başladı ve henüz bitmedi
    return currentTime >= matchStartTime && currentTime < matchEndTime;
  };

  const renderMatch = ({ item }: { item: Match }) => {
    const isPlaying = isMatchCurrentlyPlaying(item);

    return (
    <TouchableOpacity onPress={() => onSelectMatch(item)}>
      <View className="rounded-lg mx-4 my-1 p-1 shadow-lg" style={{ backgroundColor: colors.surface }}>
        <View className="flex-row items-center justify-between" style={{ position: "relative" }}>
          {/* Maç oynanıyor etiketi: başlık alanının üstüne binebilir (tam görünsün) */}
          {isPlaying ? (
            <Animated.Text
              className="text-white py-0.5 px-1.5 bg-green-600 font-bold text-sm rounded-md"
              style={[
                animatedStyle,
                {
                  position: "absolute",
                  top: 2,
                  right: 6,
                  zIndex: 50,
                  elevation: 2,
                },
              ]}
              numberOfLines={1}
            >
              {t("home.matchPlaying")} ⚽
            </Animated.Text>
          ) : null}
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
                style={{ flex: 1, minWidth: 0, paddingRight: 8, marginBottom: 0, color: colors.primaryDark }}
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

          {/* Sağda Chevron İkonu */}
          <View
            style={{
              width: 32,
              minWidth: 32,
              marginRight: 0,
              paddingVertical: 3,
              alignSelf: "stretch",
              // Çocukların (özellikle ok alanının) tam genişliği kullanması için
              alignItems: "stretch",
            }}
          >
            {/* Üst alan: Paylaş */}
            <View style={{ flex: 1, justifyContent: "flex-start", alignItems: "flex-end", marginTop: -1 }}>
              <TouchableOpacity
                onPress={() => setShareMatch(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 4, marginRight: 2, marginTop: isPlaying ? 18 : 0 }}
              >
                <Ionicons name="share-social-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {/* Orta alan: ok her zaman ortada */}
            <View style={{ flex: 1, justifyContent: "center", alignItems: "flex-end", marginRight: 5, marginTop: -5 }}>
              <Ionicons name="chevron-forward-outline" size={20} color={colors.primary} />
            </View>

            {/* Alt alan: boş */}
            <View style={{ flex: 1 }} />
          </View>

        </View>
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1">
      <View className="flex-row p-2 bg-green-700">
        <Ionicons name="alarm-outline" size={16} color="white" className="pl-2" />
        <Text className="font-bold text-white "> {t('home.waitingMatches')} </Text>
      </View>

      {matches.length === 0 && !refreshing ? (
        <View className='flex justify-center items-center py-3'>
          <Text className="text-center font-bold my-1" style={{ color: colors.text }}>{t('home.noMatchesCreated')}</Text>
          <TouchableOpacity
            className="bg-green-600 rounded-md my-2 items-center self-center"
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
          data={matches}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMatch}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          // Web'de FlatList içerik kadar uzayabiliyor; parent (Index) fixed-height verdiği için
          // burada list'i kalan alana oturtup scroll'u aktif etmek gerekir.
          style={{ flex: 1, paddingTop: 3, paddingBottom: Platform.OS === 'web' ? 0 : 5 }}
          contentContainerStyle={{
            // Web'de listenin sonunda fazladan boşluk oluşuyordu; web için daha küçük padding.
            paddingBottom: Platform.OS === 'web' ? 10 : (matches.length > 2 ? 5 : 0),
          }} // 3+ maç varsa daha fazla padding
          scrollEnabled={matches.length > 2} // 3 veya daha fazla maç varsa scroll aktif
          showsVerticalScrollIndicator={matches.length > 2} // 3+ maç varsa scroll bar göster
          // Web'de removeClippedSubviews scroll/ölçüm sorunlarına yol açabiliyor.
          removeClippedSubviews={Platform.OS !== 'web'} // Performans için
          maxToRenderPerBatch={5} // Performans için
          windowSize={5} // Performans için
        />
      )}

      <MatchShareModal visible={!!shareMatch} match={shareMatch} onClose={() => setShareMatch(null)} />
    </View>
  );
}