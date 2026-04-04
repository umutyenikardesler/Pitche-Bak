// Pozisyon listesi componenti
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { getPositionName } from '../utils/getPositionName';

interface PositionListProps {
  missingGroups: string[];
  sentRequests: string[];
  acceptedPosition: string | null;
  shownAcceptedPositions: Set<string>;
  completedPositions: Set<string>;
  currentUserId: string | null;
  matchCreateUser: string;
  isLoading: boolean;
  onPositionPress: (position: string) => void;
}

export default function PositionList({
  missingGroups,
  sentRequests,
  acceptedPosition,
  shownAcceptedPositions,
  completedPositions,
  currentUserId,
  matchCreateUser,
  isLoading,
  onPositionPress,
}: PositionListProps) {
  const isOwner = currentUserId === matchCreateUser;
  const hasAnyRequest = sentRequests.length > 0;
  const hasAcceptedPosition = acceptedPosition || shownAcceptedPositions.size > 0;
  const orderedPositions: string[] = ['K', 'D', 'O', 'F'];
  const shortLabel = (pos: string) => {
    switch (pos) {
      case 'K':
        return 'KL';
      case 'D':
        return 'DF';
      case 'O':
        return 'OS';
      case 'F':
        return 'FV';
      default:
        return pos;
    }
  };

  return (
    <View className="flex-row max-w-full items-center justify-center flex-wrap">
      {/* Pozisyonları sabit sırada (K, D, O, F) göster */}
      {orderedPositions.map((position) => {
        const group = missingGroups?.find((g) => g.startsWith(position + ':'));
        const count = group ? group.split(':')[1] : null;
        const isMissing = !!group;
        const isCompleted = completedPositions.has(position);

        // Ne eksik ne de "Dolu" değilse bu pozisyonu hiç gösterme
        if (!isMissing && !isCompleted) return null;

        // Eksik pozisyon olarak göster (x N)
        if (isMissing && count != null) {
          // Maçı oluşturan kullanıcı için herhangi bir "seçili" / "kabul edildi" renklendirmesi göstermiyoruz.
          // Bu vurgular sadece pozisyon isteği GÖNDEREN kullanıcıya özel.
          const isSent = !isOwner && sentRequests.includes(position);
          const isAcceptedPosition =
            !isOwner &&
            (acceptedPosition === position || shownAcceptedPositions.has(position));

          return (
            <View key={`missing-${position}`} className="flex-row items-center mx-1 mb-2">
              <TouchableOpacity
                className={`flex-row items-center border-solid border-2 rounded-full p-1 ${
                  isSent
                    ? 'border-green-500 bg-green-100'
                    : isAcceptedPosition
                    ? 'border-blue-500 bg-blue-100'
                    : hasAnyRequest || hasAcceptedPosition
                    ? 'border-gray-300 bg-gray-100'
                    : 'border-gray-500'
                }`}
                onPress={() => !isOwner && onPositionPress(position)}
                disabled={isOwner || isLoading}
              >
                <View
                  className={`rounded-full py-1 px-1 ${
                    position === 'K'
                      ? 'bg-red-500'
                      : position === 'D'
                      ? 'bg-blue-700'
                      : position === 'O'
                      ? 'bg-green-700'
                      : 'bg-yellow-600'
                  }`}
                >
                  <Text className="text-white font-bold text-lg px-1.5">{shortLabel(position)}</Text>
                </View>
                <Text className="ml-1 pr-1 text-base">
                  x <Text className="font-bold">{count}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          );
        }

        // Eksik değil ama "Dolu" ise, aynı sırada Dolu chip'i göster
        if (isCompleted) {
          return (
            <View
              key={`completed-${position}`}
              className="flex-row items-center mx-0.5 mb-2"
            >
              <TouchableOpacity
                className="flex-row items-center border-solid border-2 border-green-600 bg-green-100 rounded-full p-1"
                onPress={() => !isOwner && onPositionPress(position)}
                disabled={isOwner || isLoading}
              >
                <View
                  className={`rounded-full py-1 px-1 ${
                    position === 'K'
                      ? 'bg-red-500'
                      : position === 'D'
                      ? 'bg-blue-700'
                      : position === 'O'
                      ? 'bg-green-700'
                      : 'bg-yellow-600'
                  }`}
                >
                  <Text className="text-white font-bold text-lg px-1">{shortLabel(position)}</Text>
                </View>
                <Text className="ml-0.5 font-semibold pr-0.5 text-base text-green-700">
                  Dolu
                </Text>
              </TouchableOpacity>
            </View>
          );
        }

        return null;
      })}
    </View>
  );
}

