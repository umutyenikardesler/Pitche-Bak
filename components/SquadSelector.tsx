import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Switch } from 'react-native';
import '@/global.css';

interface SquadSelectorProps {
  isSquadIncomplete: boolean;
  setIsSquadIncomplete: (incomplete: boolean) => void;
  missingPositions: any;
  setMissingPositions: (positions: any) => void;
}

export const SquadSelector: React.FC<SquadSelectorProps> = ({
  isSquadIncomplete,
  setIsSquadIncomplete,
  missingPositions,
  setMissingPositions,
}) => {
  const handlePositionSelection = (position: string) => {
    setMissingPositions((prev: any) => ({
      ...prev,
      [position]: { ...prev[position], selected: !prev[position].selected }
    }));
  };

  const handleCountChange = (position: string, value: number) => {
    setMissingPositions((prev: any) => ({
      ...prev,
      [position]: { ...prev[position], count: value }
    }));
  };

  return (
    <View className="mb-4">
      <Text className="text-green-700 font-semibold mb-2">Kadro Eksik mi?</Text>
      <Switch
        value={isSquadIncomplete}
        onValueChange={setIsSquadIncomplete}
      />

      {isSquadIncomplete && (
        <View>
          <Text className="text-green-700 font-semibold mb-2 mt-2">Eksik Mevkileri Seçin</Text>
          <View className="flex flex-row flex-wrap">
            {Object.keys(missingPositions).map((position) => (
              <View key={position} className="w-1/2 flex-row items-center mb-2">
                <TouchableOpacity
                  className="flex flex-row items-center"
                  onPress={() => handlePositionSelection(position)}
                >
                  <View className={`w-5 h-5 border border-gray-500 rounded mr-2 ${missingPositions[position].selected ? 'bg-green-600' : ''}`} />
                  <Text className="text-gray-700">{position.charAt(0).toUpperCase() + position.slice(1)}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {Object.keys(missingPositions).map(
            (position) =>
              missingPositions[position].selected && (
                <View key={position} className="ml-2 mt-2">
                  <Text className="text-gray-600 mb-2">Kaç {position} eksik?</Text>
                  <FlatList
                    horizontal
                    data={Array.from({ length: position === 'kaleci' ? 2 : 3 }, (_, i) => i + 1)}
                    keyExtractor={(item) => item.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        className={`p-4 px-4 py-2 mx-1 rounded ${
                          missingPositions[position].count === item ? 'bg-green-600 text-white' : 'bg-gray-300'
                        }`}
                        onPress={() => handleCountChange(position, item)}
                      >
                        <Text className={missingPositions[position].count === item ? 'text-white' : 'text-black'}>
                          {item}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )
          )}
        </View>
      )}
    </View>
  );
};