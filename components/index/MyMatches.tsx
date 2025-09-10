import { useState, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, Dimensions, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "./types";
import { useLanguage } from "@/contexts/LanguageContext";
import '@/global.css';

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
  return formattedText.length > 23 ? formattedText.slice(0, 23) + "..." : formattedText;
};

export default function MyMatches({ matches, refreshing, onRefresh, onSelectMatch, onCreateMatch }: MyMatchesProps) {
  const { t } = useLanguage();
  // Animasyon için opacity state'i
  const [fadeAnim] = useState(new Animated.Value(1));

  // Soluk gitgel animasyonu
  useEffect(() => {
    const fadeInOut = () => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => fadeInOut()); // Sonsuz döngü
    };

    fadeInOut();
  }, [fadeAnim]);

  // Maçın şu anda oynanıp oynanmadığını kontrol eden fonksiyon
  const isMatchCurrentlyPlaying = (match: Match) => {
    const now = new Date();
    const turkeyOffset = 3; // UTC+3 için offset
    const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const turkeyNow = new Date(utcNow.getTime() + (turkeyOffset * 3600000));
    
    const today = turkeyNow.toLocaleDateString('en-CA'); // YYYY-MM-DD formatında
    const currentHours = turkeyNow.getHours();
    const currentMinutes = turkeyNow.getMinutes();
    
    // Debug bilgisi
    console.log(`[isMatchCurrentlyPlaying] Maç: ${match.date} ${match.time}, Bugün: ${today}, Şu an: ${currentHours}:${currentMinutes}`);
    
    // Eğer maç bugünkü değilse false
    if (match.date !== today) {
      console.log(`[isMatchCurrentlyPlaying] Maç bugünkü değil: ${match.date} !== ${today}`);
      return false;
    }
    
    const [matchHours, matchMinutes] = match.time.split(":").map(Number);
    const matchEndHour = matchHours + 1;
    
    // Maç şu anda oynanıyor mu veya henüz bitmemiş mi kontrol et
    const matchStartTime = matchHours * 60 + matchMinutes;
    const matchEndTime = matchEndHour * 60 + matchMinutes;
    const currentTime = currentHours * 60 + currentMinutes;
    
    const isPlaying = currentTime >= matchStartTime && currentTime < matchEndTime;
    console.log(`[isMatchCurrentlyPlaying] Maç: ${matchHours}:${matchMinutes}-${matchEndHour}:${matchMinutes}, Şu an: ${currentTime}, Başlangıç: ${matchStartTime}, Bitiş: ${matchEndTime}, Oynanıyor: ${isPlaying}`);
    
    // Maç başladı ve henüz bitmedi
    return isPlaying;
  };

  const renderMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity onPress={() => onSelectMatch(item)}>
      <View className="bg-white rounded-lg mx-4 my-1 p-1 shadow-lg">
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
          <View className="w-4/6 flex justify-center -mt-2 -ml-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg text-green-700 font-semibold">
                {formatTitle(item.title)}
              </Text>
              {isMatchCurrentlyPlaying(item) && (
                <Animated.Text 
                  className="text-white p-1 px-2 bg-green-600 font-bold text-sm rounded-md"
                  style={{ opacity: fadeAnim }}
                >
                  {t('home.matchPlaying')} ⚽
                </Animated.Text>
              )}
            </View>

            <View className="text-gray-700 text-md flex-row items-center">
              <Ionicons name="calendar-outline" size={18} color="black" />
              <Text className="pl-2 font-semibold"> {item.formattedDate} →</Text>
              <Text className="pl-2 font-bold text-green-700"> {item.startFormatted}-{item.endFormatted} </Text>
            </View>

            <View className="text-gray-700 text-md flex-row items-center pt-1">
              <Ionicons name="location" size={18} color="black" />
              <Text className="pl-2 font-semibold"> {
                Array.isArray(item.pitches) 
                  ? (Array.isArray(item.pitches[0]?.districts) 
                      ? item.pitches[0]?.districts[0]?.name 
                      : item.pitches[0]?.districts?.name)
                  : (Array.isArray(item.pitches?.districts) 
                      ? item.pitches?.districts[0]?.name 
                      : item.pitches?.districts?.name)
                ?? 'Bilinmiyor'
              } →</Text>
              <Text className="pl-2 font-bold text-green-700"> {Array.isArray(item.pitches) ? item.pitches[0]?.name : item.pitches?.name ?? 'Bilinmiyor'} </Text>
            </View>
          </View>

          {/* Sağda Chevron İkonu */}
          <View className="mr-1">
            <Ionicons name="chevron-forward-outline" size={20} color="green" />
          </View>

        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="">
      <View className="flex-row p-2 bg-green-700">
        <Ionicons name="alarm-outline" size={16} color="white" className="pl-2" />
        <Text className="font-bold text-white "> {t('home.waitingMatches')} </Text>
      </View>

      {matches.length === 0 && !refreshing ? (
        <View className='flex justify-center items-center py-4'>
          <Text className="text-center font-bold">{t('home.noMatchesCreated')}</Text>
          <TouchableOpacity
            className="text-center bg-green-600 text-white font-semibold rounded-md my-3 mb-4 items-center"
            onPress={onCreateMatch}
          >
            <Text className="text-white font-semibold text-center px-4 py-2 mx-2">{t('home.createMatchNow')}</Text>
          </TouchableOpacity>
        </View>
      ) : matches.length === 0 && refreshing ? (
        <View className='flex justify-center items-center py-4'>
          <Text className="text-center font-bold text-gray-600">{t('home.matchesLoading')}</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMatch}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          style={{ paddingTop: 3, paddingBottom: 5}}
          contentContainerStyle={{ paddingBottom: matches.length > 2 ? 35 : 0 }} // 3+ maç varsa daha fazla padding
          nestedScrollEnabled={true}
          scrollEnabled={matches.length > 2} // 3 veya daha fazla maç varsa scroll aktif
          showsVerticalScrollIndicator={matches.length > 2} // 3+ maç varsa scroll bar göster
          removeClippedSubviews={true} // Performans için
          maxToRenderPerBatch={5} // Performans için
          windowSize={5} // Performans için
        />
      )}
    </View>
  );
}