// Maç bilgileri componenti (tarih, saat, konum, fiyat)
import React, { useEffect, useMemo, useState } from 'react';
import { DeviceEventEmitter, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Match } from '@/components/index/types';

interface MatchInfoProps {
  match: Match;
}

export default function MatchInfo({ match }: MatchInfoProps) {
  const pitchName = Array.isArray(match.pitches) ? match.pitches[0]?.name : match.pitches?.name;
  const pitchPrice = Array.isArray(match.pitches) ? (match.pitches[0] as any)?.price : (match.pitches as any)?.price;
  const [priceOverride, setPriceOverride] = useState<number | null>(null);

  useEffect(() => {
    // match değişince override'ı sıfırla
    setPriceOverride(null);
  }, [match.id]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('pitchPriceUpdated', (payload: any) => {
      if (!payload) return;
      if (payload.matchId !== match.id) return;
      const p = payload.price;
      const num = typeof p === 'number' ? p : parseInt(String(p || '').replace(/\D/g, ''), 10);
      if (!Number.isFinite(num)) return;
      setPriceOverride(num);
    });
    return () => sub.remove();
  }, [match.id]);

  const effectivePriceText = useMemo(() => {
    const v = priceOverride != null ? priceOverride : (pitchPrice != null && pitchPrice !== '' ? pitchPrice : match.prices);
    if (v == null || v === '') return '—';
    const s = String(v).trim();
    return s.length ? s : '—';
  }, [priceOverride, pitchPrice, match.prices]);

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
          <Text className="pl-2 font-semibold text-green-700">{effectivePriceText} ₺</Text>
        </View>
      </View>
    </>
  );
}
