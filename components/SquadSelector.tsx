import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Switch, StyleSheet } from 'react-native';
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
      />

      {isSquadIncomplete && (
        <View>
          <Text className="text-green-700 font-semibold mb-2 mt-2">Eksik Mevkileri Seçin</Text>
          <View className="flex flex-row flex-wrap">
            {Object.keys(missingPositions).map((position, index) => (
              <View key={position} className={`w-1/2 mb-2 ${index % 2 === 1 ? 'pl-2' : ''}`}> {/* Koşullu olarak pr-2 eklendi */}
                 <TouchableOpacity
                  className={`flex flex-row items-center p-2 rounded bg-green-600 text-white`} // Her zaman yeşil arka plan ve beyaz yazı
                  onPress={() => handlePositionSelection(position)}
                >
                  <Text className="text-white">{position.charAt(0).toUpperCase() + position.slice(1)}</Text>
                </TouchableOpacity>

                {missingPositions[position].selected && (
                  <View className="mt-2"> {/* Butonun hemen altına açılır */}
                    <Text className="text-gray-600 mb-2">Kaç {position} eksik?</Text>
                    <FlatList
                      horizontal
                      data={Array.from({ length: position === 'kaleci' ? 2 : 3 }, (_, i) => i + 1)}
                      keyExtractor={(item) => item.toString()}
                      renderItem={({ item }) => (
                        <View className=""> {/* View ile boşluk oluşturuldu */}
                          <TouchableOpacity
                            className={`p-3 py-2 rounded-lg border border-[#006400] border-opacity-100 ${
                              missingPositions[position].count === item ? 'bg-green-600 text-white border-green-600' : 'bg-gray-300'
                            }`}
                            onPress={() => handleCountChange(position, item)}
                          >
                            <Text className={missingPositions[position].count === item ? 'text-white' : 'text-black'}>
                              {item}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      ItemSeparatorComponent={ItemSeparator} // Ayırıcı bileşeni eklendi
                    />
                  </View>
                )}
              </View>
            ))}
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
});