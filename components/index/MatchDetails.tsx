import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "./types";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";
import { useLanguage } from "@/contexts/LanguageContext";
import '@/global.css';

interface MatchDetailsProps {
  match: Match;
  onClose: () => void;
  onOpenProfilePreview?: (userId: string) => void;
}

export default function MatchDetails({ match, onClose, onOpenProfilePreview }: MatchDetailsProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const featuresArray: string[] = Array.isArray(match.pitches) 
    ? match.pitches[0]?.features || []
    : match.pitches?.features || [];

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1 bg-white p-4 rounded-lg m-3 shadow-lg">
        <View className="flex-row mb-2 justify-center">
          <Ionicons name="accessibility-outline" size={16} color="green" className="pt-1" />
          <Text className="text-xl font-bold text-green-700 "> {t('home.matchSummary')} </Text>
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
            <Text className="pl-2 font-semibold">{(Array.isArray(match.pitches) ? match.pitches[0]?.name : match.pitches?.name) ?? 'Bilinmiyor'}</Text>
          </View>
          <View className="w-2/5 text-gray-700 text-md flex-row justify-center items-center pt-1">
            <Ionicons name="wallet-outline" size={18} color="black" />
            <Text className="pl-2 font-semibold text-green-700">{match.prices} ₺</Text>
          </View>
        </View>

        <View>
          <Text className="text-lg font-semibold text-green-700 text-center my-2">{t('home.missingSquads')}</Text>
        </View>

        <View className="flex-row max-w-full items-center justify-center mb-2">
          {match.missing_groups?.length > 0 && match.missing_groups.map((group, index) => {
            const [position, count] = group.split(':');
            return (
              <View key={index} className="flex-row items-center ml-2 border-solid border-2 border-gray-500 rounded-full p-1">
                <View className={`rounded-full p-1 ${position === 'K' ? 'bg-red-500'
                  : position === 'D' ? 'bg-blue-700'
                    : position === 'O' ? 'bg-green-700'
                      : 'bg-yellow-600'}`}>
                  <Text className="text-white font-bold text-md px-1">{position}</Text>
                </View>
                <Text className="ml-2 font-semibold pr-1">x {count}</Text>
              </View>
            );
          })}
        </View>

        {match.users && (
          <View className="flex-row max-w-full items-center justify-center mt-2 mb-1">
            <Text className="font-semibold">{t('home.matchCreatedBy')} </Text>
            <TouchableOpacity onPress={() => {
              if (onOpenProfilePreview) {
                onOpenProfilePreview(match.create_user);
              } else {
                router.push({ pathname: "./", params: { userId: match.create_user }});
              }
            }}>
              <Text className="text-green-600 font-semibold">{(Array.isArray(match.users) ? match.users[0]?.name : match.users?.name) ?? 'Bilinmiyor'} {(Array.isArray(match.users) ? match.users[0]?.surname : match.users?.surname) ?? ''}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="h-[1px] bg-gray-600 my-3" />

        <View className="flex-row mb-2 justify-center">
          <Ionicons name="accessibility-outline" size={16} color="green" className="pt-1" />
          <Text className="h-7 text-xl font-bold text-green-700 "> {t('home.pitchSummary')} </Text>
        </View>

        {(() => {
          const pitch = Array.isArray(match.pitches) ? match.pitches[0] : match.pitches;
          return pitch?.latitude && pitch?.longitude ? (
            <View className="w-full h-48 rounded-lg overflow-hidden my-2">
              <MapView
                style={{ width: "100%", height: "100%" }}
                initialRegion={{
                  latitude: pitch.latitude,
                  longitude: pitch.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: pitch.latitude,
                    longitude: pitch.longitude,
                  }}
                  title={pitch.name ?? 'Bilinmiyor'}
                />
              </MapView>
            </View>
          ) : null;
        })()}

        <View className="">
          <Text className="h-7 text-xl font-semibold text-green-700 text-center my-2">{(Array.isArray(match.pitches) ? match.pitches[0]?.name : match.pitches?.name) ?? 'Bilinmiyor'}</Text>
        </View>

        <View className="">
          <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">{t('home.openAddress')}</Text>
        </View>
        <View className=" text-gray-700 text-md flex-row justify-center items-center pt-1">
          <Ionicons name="location" size={18} color="black" />
          <Text className="pl-2 font-semibold text-gray-700">{(Array.isArray(match.pitches) ? match.pitches[0]?.address : match.pitches?.address) ?? 'Adres bilgisi yok'}</Text>
        </View>

        <View className="">
          <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-3 my-2">{t('home.pitchPrice')}</Text>
        </View>
        <View className=" text-gray-700 text-md flex-row justify-center items-center pt-1">
          <Ionicons name="wallet-outline" size={18} color="green" />
          <Text className="pl-2 font-semibold text-gray-700">{(Array.isArray(match.pitches) ? match.pitches[0]?.price : match.pitches?.price) ?? 'Fiyat bilgisi yok'} ₺</Text>
        </View>

        <View>
          <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-4">{t('home.pitchFeatures')}</Text>
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
            <Text className="text-white font-bold">{t('general.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}