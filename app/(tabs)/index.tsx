import { Text, View, Image, FlatList, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import { supabase } from '@/services/supabase';
import { useEffect, useState } from 'react';
import '@/global.css';

export default function Index() {
  const progress = 85;
  const screenWidth = Dimensions.get("window").width;
  const fontSize = screenWidth > 430 ? 12 : screenWidth > 320 ? 11.5 : 10;
  const [matches, setMatches] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from('match')
      .select(`
        id, title, time, date, prices, missing_groups, 
        pitches (name)
      `);

    if (error) {
      console.error('Veri çekme hatası:', error);
    } else {
      setMatches(data);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  const renderMatch = ({ item }) => {
    const formattedDate = new Date(item.date).toLocaleDateString('tr-TR');
    const startTime = item.time.split(':');
    const startHour = parseInt(startTime[0], 10);
    const startMinute = parseInt(startTime[1], 10);

    const endTime = new Date();
    endTime.setHours(startHour);
    endTime.setMinutes(startMinute + 60);

    const startFormatted = `${startHour < 10 ? '0' : ''}${startHour}:${startMinute < 10 ? '0' : ''}${startMinute}`;
    const endFormatted = `${endTime.getHours() < 10 ? '0' : ''}${endTime.getHours()}:${endTime.getMinutes() < 10 ? '0' : ''}${endTime.getMinutes()}`;

    const missingGroups = item.missing_groups ? item.missing_groups : [];

    return (
      <View className="bg-white rounded-lg mx-4 mt-1.5 mb-1 p-3 shadow-md">
        <View className="flex-row">
          <View className="w-1/4 justify-center py-2 px-1">
            <Image
              source={require('@/assets/images/ball.png')}
              className="rounded-full mx-auto"
              style={{
                width: 80,
                height: 80,
                resizeMode: 'contain',
              }}
            />
          </View>

          <View className="w-1/2 p-2">
            <Text className="text-lg font-bold pb-1">{item.title}</Text>
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="location" size={16} color="black" />
              <Text className="pl-1 text-black text-base">{item.pitches?.name ?? 'Bilinmiyor'}</Text>
            </View>

            <View className="text-black text-base flex-row items-center">
              <Ionicons name="time-outline" size={16} color="black" />
              <Text className="pl-1 text-black text-base">{startFormatted} - {endFormatted}</Text>
            </View>

            <View className="text-black text-base flex-row items-center">
              <Ionicons name="calendar-outline" size={16} color="black" />
              <Text className="pl-1 text-black text-base">{formattedDate}</Text>
            </View>
          </View>

          <View className="w-1/4 py-2 px-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-green-500">{item.prices} ₺</Text>
              <Ionicons name="chevron-forward-outline" size={16} color="green" />
            </View>
          </View>
        </View>

        <View className="h-[1px] bg-gray-600 my-3" />

       {/* Eksik grupları göster */}
        <View className="flex-row flex-wrap max-w-full items-center justify-start">
          {missingGroups.length > 0 && missingGroups.map((group, index) => {
            const [position, count] = group.split(':'); // 'K:1' -> ['K', '1']
            return (
              <View key={index} className="flex-row items-center ml-2 border-solid border-2 border-gray-500 rounded-full p-1">
                <View className={`rounded-full p-1 ${
                  position === 'K' ? 'bg-red-500' 
                  : position === 'D' ? 'bg-blue-500' 
                  : position === 'O' ? 'bg-green-500' 
                  : 'bg-yellow-500'}`}>
                  <Text className="text-white font-bold text-md px-1">{position}</Text>
                </View>
                <Text className="ml-2 font-semibold pr-1">x {count}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      data={matches}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderMatch}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchMatches} />
      }
      ListHeaderComponent={() => (
        <>
          {/* KONDİSYONUN Başlığı ve İçeriği */}
          <View className="flex-row mt-3 px-3">
            <Ionicons name="accessibility" size={16} color="black" className="pl-2" />
            <Text className="font-bold "> KONDİSYONUN </Text>
          </View>

          <View className="bg-white rounded-lg mx-4 my-3 p-3 shadow-md">
            {/* Progress Bar ve Yüzde */}
            <View className="w-full mb-3 flex-row items-center">
              {/* Progress Bar */}
              <View className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <View className="bg-blue-500 h-full" style={{ width: `${progress}%` }} />
              </View>
              {/* Yüzde */}
              <Text className="pl-2 font-semibold text-base text-blue-500">{progress}%</Text>
            </View>

            {/* İkon ve Metin */}
            <View className="flex-row items-center">
              <Ionicons name="information-circle-outline" size={16} color="black" />
              <Text className="text-xs text-slate-600 pl-2" style={{ fontSize }}>
                Kondisyonun yaptığın maç sayısına göre değişiklik gösterebilir.
              </Text>
            </View>
          </View>

          {/* SENİ BEKLEYEN MAÇLAR Başlığı */}
          <View className="flex-row mt-1 mb-2 px-3">
            <Ionicons name="alarm-outline" size={16} color="black" className="pl-2" />
            <Text className="font-bold "> SENİ BEKLEYEN MAÇLAR </Text>
          </View>
        </>
      )}
    />
  );
}
