import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "./types";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";

interface MatchDetailsProps {
  match: Match;
  onClose: () => void;
}

export default function MatchDetails({ match, onClose }: MatchDetailsProps) {
  const router = useRouter();
  const featuresArray = match.pitches?.features
    ? Array.isArray(match.pitches.features)
      ? match.pitches.features
      : []
    : [];

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 bg-white p-4 rounded-lg m-3 shadow-lg">
        <View className="flex-row mb-2 justify-center">
          <Ionicons name="accessibility-outline" size={16} color="green" className="pt-1" />
          <Text className="text-xl font-bold text-green-700 "> MAÇ ÖZETİ </Text>
        </View>

        <Text className="text-lg text-green-700 font-semibold text-center">{match.title}</Text>

        <View className="flex-row ">
          <View className="w-1/2 text-gray-700 text-md flex-row justify-center items-center">
            <Ionicons name="calendar-outline" size={18} color="black" />
            <Text className="pl-2 font-semibold">{match.formattedDate}</Text>
          </View>
          <View className=" w-1/2 text-gray-700 text-md flex-row justify-center items-center pt-1">
            <Ionicons name="time-outline" size={18} color="black" />
            <Text className="pl-2 font-semibold">{match.startFormatted} - {match.endFormatted}</Text>
          </View>
        </View>

        <View className="flex-row ">
          <View className="w-3/5 text-gray-700 text-md flex-row justify-center items-center pt-1">
            <Ionicons name="location" size={18} color="black" />
            <Text className="pl-2 font-semibold">{match.pitches?.name ?? 'Bilinmiyor'}</Text>
          </View>
          <View className="w-2/5 text-gray-700 text-md flex-row justify-center items-center pt-1">
            <Ionicons name="wallet-outline" size={18} color="black" />
            <Text className="pl-2 font-semibold text-green-600">{match.prices} ₺</Text>
          </View>
        </View>

        <View>
          <Text className="text-lg font-semibold text-green-700 text-center my-2">Eksik Kadrolar</Text>
        </View>

        <View className="flex-row max-w-full items-center justify-center mb-2">
          {match.missing_groups?.length > 0 && match.missing_groups.map((group, index) => {
            const [position, count] = group.split(':');
            return (
              <View key={index} className="flex-row items-center ml-2 border-solid border-2 border-gray-500 rounded-full p-1">
                <View className={`rounded-full p-1 ${position === 'K' ? 'bg-red-500'
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

        {match.users && (
          <View className="flex-row max-w-full items-center justify-center mt-2 mb-1">
            <Text className="font-semibold">Maçı oluşturan: </Text>
            <TouchableOpacity onPress={() => router.push(`/profile?userId=${match.create_user}`)}>
              <Text className="text-green-600 font-semibold">{match.users?.name} {match.users?.surname}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="h-[1px] bg-gray-600 my-3" />

        <View className="flex-row mb-2 justify-center">
          <Ionicons name="accessibility-outline" size={16} color="green" className="pt-1" />
          <Text className="h-7 text-xl font-bold text-green-700 "> HALI SAHA ÖZETİ </Text>
        </View>

        {match.pitches?.latitude && match.pitches?.longitude && (
          <View className="w-full h-48 rounded-lg overflow-hidden my-2">
            <MapView
              style={{ width: "100%", height: "100%" }}
              initialRegion={{
                latitude: match.pitches.latitude,
                longitude: match.pitches.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={{
                  latitude: match.pitches.latitude,
                  longitude: match.pitches.longitude,
                }}
                title={match.pitches.name}
              />
            </MapView>
          </View>
        )}

        <View className="">
          <Text className="h-7 text-xl font-semibold text-green-700 text-center my-2">{match.pitches?.name}</Text>
        </View>

        <View className="">
          <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">Açık Adres</Text>
        </View>
        <View className=" text-gray-700 text-md flex-row justify-center items-center pt-1">
          <Ionicons name="location" size={18} color="black" />
          <Text className="pl-2 font-semibold text-gray-700">{match.pitches?.address}</Text>
        </View>

        <View className="">
          <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-3 my-2">Saha Ücreti</Text>
        </View>
        <View className=" text-gray-700 text-md flex-row justify-center items-center pt-1">
          <Ionicons name="wallet-outline" size={18} color="green" />
          <Text className="pl-2 font-semibold text-gray-700">{match.pitches?.price} ₺</Text>
        </View>

        <View>
          <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-4">Sahanın Özellikleri</Text>
        </View>
        <View className="flex-row flex-wrap justify-center items-center mt-3">
          {featuresArray.map((feature, index) => (
            <View key={index} className="w-1/2 mb-1">
              <View className="flex-row p-2 bg-green-700 rounded mr-1 items-center justify-center">
                <Ionicons name="checkmark-circle-outline" size={16} color="white" className="" />
                <Text className="text-white pl-1">{feature}</Text>
              </View>
            </View>
          ))}
        </View>

        <View className="flex-1 flex-col-reverse justifyy-end items-center">
          <TouchableOpacity className="w-1/2 items-center mt-4 bg-green-700 px-4 py-2 rounded " onPress={onClose}>
            <Text className="text-white font-bold">Geri dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}