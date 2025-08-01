import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "./types";
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
  const renderMatch = ({ item }: { item: Match }) => (
    <TouchableOpacity onPress={() => onSelectMatch(item)}>
      <View className="bg-white rounded-lg mx-4 mt-1 p-1 shadow-lg">
        <View className="flex-row items-center justify-between">
          {/* Profil Resmi */}
          <View className="w-1/5 flex justify-center p-1 py-1.5">
            <Image
              source={item.users?.profile_image
                ? { uri: item.users.profile_image }
                : require('@/assets/images/ball.png')}
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
              <Text className="pl-2 font-semibold"> {item.pitches?.districts?.name ?? 'Bilinmiyor'} →</Text>
              <Text className="pl-2 font-bold text-green-700"> {item.pitches?.name ?? 'Bilinmiyor'} </Text>
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
        <Text className="font-bold text-white "> SENİ BEKLEYEN MAÇLAR </Text>
      </View>

      {matches.length === 0 ? (
        <View className='flex justify-center items-center'>
          <Text className="text-center font-bold mt-3">Oluşturduğun Maç Yok!</Text>
          <TouchableOpacity
            className="text-center bg-green-600 text-white font-semibold rounded-md my-3 items-center"
            onPress={onCreateMatch}
          >
            <Text className="w-1/2 text-white font-semibold text-center px-4 py-2 mx-2">Hemen Maç Oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMatch}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          style={{ paddingTop: 3, paddingBottom: 5}}
          contentContainerStyle={{ paddingBottom: 0 }}
          nestedScrollEnabled={true}
          scrollEnabled={matches.length > 1} // 2 veya daha fazla maç varsa scroll aktif olur
        />
      )}
    </View>
  );
}