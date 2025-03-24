import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Switch, StyleSheet, Platform } from 'react-native';
import { supabase } from '@/services/supabase';
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
      [position]: { ...prev[position], selected: !prev[position].selected },
    }));
  };

  const handleCountChange = (position: string, value: number) => {
    setMissingPositions((prev: any) => ({
      ...prev,
      [position]: { ...prev[position], count: value },
    }));
  };

  const ItemSeparator = () => (
    <View style={styles.separator} />
  );

  return (
    <View className="mb-4">
      <Text className="text-green-700 font-semibold mb-2">Kadro Eksik mi?</Text>
      <Switch
        value={isSquadIncomplete}
        onValueChange={setIsSquadIncomplete}
        trackColor={{ false: "#d1d5db", true: "#5ea500" }} // Açık ve kapalı rengi belirler
        thumbColor={Platform.OS === "android" ? "#ffffff" : undefined} // Android için beyaz başlatma noktası
        ios_backgroundColor="#d1d5db" // iOS için kapalıyken arka plan rengi
        style={{ transform: [{ scaleX: -1 }] }} // **Switch'i terse çevirerek** iOS ve Android'de sol başlangıç
      />

      {isSquadIncomplete && (
        <View>
          <Text className="text-green-700 font-semibold mb-2 mt-2">Eksik Mevkileri Seçin</Text>
        
          <View className="flex flex-col">
            {/* İlk Satır: Kaleci & Defans */}
            <View className="flex flex-row justify-between">
              {['kaleci', 'defans'].map((position) => (
                <View key={position} style={styles.buttonWrapper}>
                  <TouchableOpacity
                    className="flex p-3 rounded bg-green-600"
                    onPress={() => handlePositionSelection(position)}
                  >
                    <Text className="text-white">{position.charAt(0).toUpperCase() + position.slice(1)}</Text>
                  </TouchableOpacity>

                  {missingPositions[position] && missingPositions[position].selected && (
                    <View className="mt-2">
                      <Text className="text-gray-600 mb-2">Kaç {position} eksik?</Text>
                      <FlatList
                        horizontal
                        data={Array.from({ length: position === 'kaleci' ? 2 : 3 }, (_, i) => i + 1)}
                        keyExtractor={(item) => item.toString()}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            className={`p-2 px-3 rounded-lg border ${
                              missingPositions[position].count === item
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'bg-gray-300 border-gray-400'
                            }`}
                            onPress={() => handleCountChange(position, item)}
                          >
                            <Text className={missingPositions[position].count === item ? 'text-white' : 'text-black'}>
                              {item}
                            </Text>
                          </TouchableOpacity>
                        )}
                        ItemSeparatorComponent={() => <View style={{ width: 5 }} />}
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* İkinci Satır: Orta Saha & Forvet */}
            <View className="flex flex-row justify-between">
              {['ortaSaha', 'forvet'].map((position) => (
                <View key={position} style={styles.buttonWrapper}>
                  <TouchableOpacity
                    className="flex p-3 rounded bg-green-600"
                    onPress={() => handlePositionSelection(position)}
                  >
                    <Text className="text-white">{position.charAt(0).toUpperCase() + position.slice(1)}</Text>
                  </TouchableOpacity>

                  {missingPositions[position] && missingPositions[position].selected && (
                    <View className="mt-2">
                      <Text className="text-gray-600 mb-2">Kaç {position} eksik?</Text>
                      <FlatList
                        horizontal
                        data={Array.from({ length: 3 }, (_, i) => i + 1)}
                        keyExtractor={(item) => item.toString()}
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            className={`p-2 px-3 rounded-lg border ${
                              missingPositions[position].count === item
                                ? 'bg-green-600 border-green-600 text-white'
                                : 'bg-gray-300 border-gray-400'
                            }`}
                            onPress={() => handleCountChange(position, item)}
                          >
                            <Text className={missingPositions[position].count === item ? 'text-white' : 'text-black'}>
                              {item}
                            </Text>
                          </TouchableOpacity>
                        )}
                        ItemSeparatorComponent={() => <View style={{ width: 5 }} />}
                      />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>

        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  separator: {
    width: 5, // Ayırıcı genişliği (isteğinize göre ayarlayın)
    height: '100%', // Ayırıcının yüksekliği (isteğe göre ayarlayın)
    backgroundColor: 'transparent', // veya ayırıcı rengi (örn. '#000000')
  },
  flatList: {
    marginHorizontal: 10, // FlatList'in yatay boşluğu (isteğe bağlı)
  },
  buttonWrapper: {
    width: '48%', // %50 yerine %48 verdik, kenarlarda kayma olmaması için
    marginBottom:10,
  },
});