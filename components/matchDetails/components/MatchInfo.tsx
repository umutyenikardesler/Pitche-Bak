// Maç bilgileri componenti (tarih, saat, konum, fiyat)
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Match } from '@/components/index/types';

interface MatchInfoProps {
  match: Match;
}

export default function MatchInfo({ match }: MatchInfoProps) {
  const pitchName = Array.isArray(match.pitches) ? match.pitches[0]?.name : match.pitches?.name;

  return (
    <>
      <View className="flex-row">
        <View className="w-1/2 text-gray-700 text-md flex-row justify-center items-center">
          <Ionicons name="calendar-outline" size={18} color="black" />
          <Text className="pl-2 font-semibold">{match.formattedDate}</Text>
        </View>
        <View className="w-1/2 text-gray-700 text-md flex-row justify-center items-center pt-1">
          <Ionicons name="time-outline" size={18} color="black" />
          <Text className="pl-2 font-semibold">{match.startFormatted} - {match.endFormatted}</Text>
        </View>
      </View>

      <View className="flex-row">
        <View className="w-3/5 text-gray-700 text-md flex-row justify-center items-center pt-1">
          <Ionicons name="location" size={18} color="black" />
          <Text className="pl-2 font-semibold">{pitchName ?? 'Bilinmiyor'}</Text>
        </View>
        <View className="w-2/5 text-gray-700 text-md flex-row justify-center items-center pt-1">
          <Ionicons name="wallet-outline" size={18} color="black" />
          <Text className="pl-2 font-semibold text-green-700">{match.prices} ₺</Text>
        </View>
      </View>
    </>
  );
}
