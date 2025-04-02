import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "./types";

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
      <View className="bg-white rounded-lg mx-4 mt-1 mb-1 p-2 shadow-lg">
        <View className="flex-row">
          <View className="w-1/5 justify-center py-1 p-1">
            <Image
              source={item.users?.profile_image
                ? { uri: item.users.profile_image }
                : require('@/assets/images/ball.png')}
              className="rounded-full mx-auto"
              style={{ width: 60, height: 60, resizeMode: 'contain' }}
            />
          </View>

          <View className="w-4/6 px-2">
            <Text className="text-lg text-green-600 font-semibold">
              {formatTitle(item.title)}
            </Text>

            <View className="text-gray-700 text-md flex-row items-center">
              <Ionicons name="calendar-outline" size={18} color="black" />
              <Text className="pl-2 font-semibold"> {item.formattedDate} →</Text>
              <Text className="pl-2 font-bold text-green-600"> {item.startFormatted}-{item.endFormatted} </Text>
            </View>

            <View className="text-gray-700 text-md flex-row items-center pt-1">
              <Ionicons name="location" size={18} color="black" />
              <Text className="pl-2 font-semibold"> {item.pitches?.districts?.name ?? 'Bilinmiyor'} →</Text>
              <Text className="pl-2 font-bold text-green-700"> {item.pitches?.name ?? 'Bilinmiyor'} </Text>
            </View>
          </View>

          <View className="flex-1 items-end justify-center px-1">
            <Ionicons name="chevron-forward-outline" size={20} color="green" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View>
      <View className="flex-row py-3 bg-green-700 px-3">
        <Ionicons name="alarm-outline" size={16} color="white" className="pl-2" />
        <Text className="font-bold text-white"> SENİ BEKLEYEN MAÇLAR </Text>
      </View>

      {matches.length === 0 ? (
        <View className='flex justify-center items-center'>
          <Text className="text-center font-bold my-4">Oluşturduğun Maç Yok!</Text>
          <TouchableOpacity 
            className="text-center bg-green-600 text-white font-semibold rounded-md px-1 mb-2 items-center" 
            onPress={onCreateMatch}
          >
            <Text className="w-1/2 text-white font-semibold text-center p-3">Hemen Maç Oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMatch}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          style={{ paddingTop: 2, paddingBottom: 3 }}
          nestedScrollEnabled={true}
        />
      )}
    </View>
  );
}