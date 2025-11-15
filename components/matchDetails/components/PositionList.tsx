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

  return (
    <View className="flex-row max-w-full items-center justify-center flex-wrap">
      {/* Eksik Pozisyonlar */}
      {missingGroups?.length > 0 && missingGroups.map((group, index) => {
        const [position, count] = group.split(':');
        const isSent = sentRequests.includes(position);
        const isAcceptedPosition = acceptedPosition === position || shownAcceptedPositions.has(position);
        
        return (
          <View key={index} className="flex-row items-center mx-1 mb-2">
            <TouchableOpacity
              className={`flex-row items-center border-solid border-2 rounded-full p-1.5 ${
                isSent ? 'border-green-500 bg-green-100' : 
                isAcceptedPosition ? 'border-blue-500 bg-blue-100' :
                (hasAnyRequest || hasAcceptedPosition) ? 'border-gray-300 bg-gray-100' : 'border-gray-500'
              }`}
              onPress={() => !isOwner && onPositionPress(position)}
              disabled={isOwner || isLoading}
            >
              <View className={`rounded-full py-1.5 px-1.5 ${position === 'K' ? 'bg-red-500'
                : position === 'D' ? 'bg-blue-700'
                  : position === 'O' ? 'bg-green-700'
                    : 'bg-yellow-600'}`}>
                <Text className="text-white font-bold textlg px-2">{position}</Text>
              </View>
              <Text className="ml-1 font-semibold pr-1 text-lg">x {count}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      
      {/* Tamamlanan Pozisyonlar (yeşil dolgu ile) */}
      {Array.from(completedPositions).map((position, index) => {
        return (
          <View key={`completed-${position}-${index}`} className="flex-row items-center mx-1 mb-2">
            <View
              className="flex-row items-center border-solid border-2 border-green-600 bg-green-100 rounded-full p-1.5"
            >
              <View className={`rounded-full py-1.5 px-1.5 ${position === 'K' ? 'bg-red-500'
                : position === 'D' ? 'bg-blue-700'
                  : position === 'O' ? 'bg-green-700'
                    : 'bg-yellow-600'}`}>
                <Text className="text-white font-bold textlg px-2">{position}</Text>
              </View>
              <Text className="ml-1 font-semibold pr-1 text-lg text-green-700">x 0</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

