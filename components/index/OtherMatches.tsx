import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl } from "react-native";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "./types";
import { useLanguage } from "@/contexts/LanguageContext";
import '@/global.css';

interface OtherMatchesProps {
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

export default function OtherMatches({ matches, refreshing, onRefresh, onSelectMatch, onCreateMatch
}: OtherMatchesProps) {
  const { t } = useLanguage();
  const [visibleCount, setVisibleCount] = useState(5);

  // Maç listesi değiştiğinde görünür sayıyı resetle
  useEffect(() => {
    setVisibleCount(5);
  }, [matches.length]);
  const renderMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity onPress={() => onSelectMatch(item)}>
     <View className="bg-white rounded-lg mx-4 mt-1 p-1 shadow-lg">
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
            <Text className="text-lg text-green-700 font-semibold">
              {formatTitle(item.title)}
            </Text>

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
    <View className="flex-1">
      <View className="flex-row p-2 bg-green-700">
        <Ionicons name="alarm-outline" size={16} color="white" className="pl-2" />
        <Text className="font-bold text-white"> {t('home.incompleteSquadMatches')} </Text>
      </View>

      {matches.length === 0 && !refreshing ? (
        <View className='flex justify-center items-center py-4'>
          <Text className="text-center font-bold my-4">{t('home.noIncompleteSquadMatches')}</Text>
          <TouchableOpacity
            className="text-center bg-green-600 text-white font-semibold rounded-md my-3 items-center"
            onPress={onCreateMatch}
          >
            <Text className="w-1/2 text-white font-semibold text-center p-4">{t('home.createMatchNow')}</Text>
          </TouchableOpacity>
        </View>
      ) : matches.length === 0 && refreshing ? (
        <View className='flex justify-center items-center py-4'>
          <Text className="text-center font-bold text-gray-600">{t('home.matchesLoading')}</Text>
        </View>
      ) : (
        <FlatList
          data={matches.slice(0, visibleCount)}
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
                  onPress={() => setVisibleCount((prev: number) => prev + 5)}
                  className="px-4 py-2 rounded-md"
                  style={{ backgroundColor: '#e5e7eb' }}
                >
                  <Text className="text-green-700 font-semibold">
                    Daha fazla görüntüle
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}