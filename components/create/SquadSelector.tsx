import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import '@/global.css';

interface SquadSelectorProps {
  isSquadIncomplete: boolean;
  setIsSquadIncomplete: (incomplete: boolean) => void;
  missingPositions: any;
  setMissingPositions: (positions: any) => void;
  matchFormat: string;
  setMatchFormat: (format: string) => void;
}

const SWITCH_WIDTH = 51;
const SWITCH_HEIGHT = 31;
const THUMB_SIZE = 25;
const THUMB_PADDING = 3;

const SquadSwitch = ({
  value,
  onValueChange,
  primaryColor,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  primaryColor: string;
}) => {
  const thumbOffset = SWITCH_WIDTH - THUMB_SIZE - THUMB_PADDING * 2;

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[
        styles.switchTrack,
        { backgroundColor: value ? primaryColor : '#bbf7d0' },
      ]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View
        style={[
          styles.switchThumb,
          {
            borderColor: primaryColor,
            transform: [{ translateX: value ? thumbOffset : 0 }],
          },
        ]}
      />
    </Pressable>
  );
};

export const SquadSelector: React.FC<SquadSelectorProps> = ({
  isSquadIncomplete,
  setIsSquadIncomplete,
  missingPositions,
  setMissingPositions,
  matchFormat,
  setMatchFormat,
}) => {
  const { t } = useLanguage();
  const { colors } = useAppTheme();

  // Maç formatına göre maksimum sayıları belirle
  const getMaxCountForPosition = (position: string, format: string) => {
    switch (format) {
      case '5-5': // 10 kişi
        switch (position) {
          case 'kaleci': return 2;
          case 'defans': return 3;
          case 'ortaSaha': return 3;
          case 'forvet': return 2;
          default: return 1;
        }
      case '6-6': // 12 kişi
        switch (position) {
          case 'kaleci': return 2;
          case 'defans': return 4;
          case 'ortaSaha': return 4;
          case 'forvet': return 2;
          default: return 1;
        }
      case '7-7': // 14 kişi
        switch (position) {
          case 'kaleci': return 2;
          case 'defans': return 4;
          case 'ortaSaha': return 4;
          case 'forvet': return 4;
          default: return 1;
        }
      default:
        switch (position) {
          case 'kaleci': return 2;
          case 'defans': return 3;
          case 'ortaSaha': return 3;
          case 'forvet': return 2;
          default: return 1;
        }
    }
  };

  // Pozisyon seçildiğinde default olarak 1'i seç
  const handlePositionSelection = (position: string) => {
    setMissingPositions((prev: any) => ({
      ...prev,
      [position]: { 
        ...prev[position], 
        selected: !prev[position].selected,
        count: !prev[position].selected ? 1 : prev[position].count // Seçildiğinde 1'e set et
      },
    }));
  };

  const handleCountChange = (position: string, value: number) => {
    setMissingPositions((prev: any) => ({
      ...prev,
      [position]: { ...prev[position], count: value },
    }));
  };

  const renderCountButtons = (position: string) => {
    const selectedCount = missingPositions[position]?.count;
    const maxCount = getMaxCountForPosition(position, matchFormat);

    return (
      <View style={styles.countRow}>
        {Array.from({ length: maxCount }, (_, i) => i + 1).map((item) => {
          const isSelected = selectedCount === item;
          return (
            <TouchableOpacity
              key={`${position}-${item}`}
              style={[
                styles.countButton,
                {
                  backgroundColor: isSelected ? colors.primary : '#d1d5db',
                  borderColor: isSelected ? colors.primary : '#9ca3af',
                },
              ]}
              activeOpacity={0.8}
              onPress={() => handleCountChange(position, item)}
            >
              <Text style={{ color: isSelected ? '#ffffff' : '#111827', fontWeight: '600' }}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View className="mb-2">
      {/* Maç Formatı Seçimi */}
      <View className="mb-4">
        <Text className="text-green-700 font-semibold mb-3">Maç Kaç Kişi ile Yapılsın? </Text>
        <View className="flex-row justify-between">
          {['5-5', '6-6', '7-7'].map((format) => (
            <TouchableOpacity
              key={format}
              className={`flex-1 mx-1 p-3 rounded-lg border ${
                matchFormat === format
                  ? 'bg-green-600 border-green-600'
                  : 'bg-gray-200 border-gray-400'
              }`}
              activeOpacity={1}
              onPress={() => setMatchFormat(format)}
            >
              <Text className={`text-center font-semibold ${
                matchFormat === format ? 'text-white' : 'text-black'
              }`}>
                {format}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Kadro Eksik mi Switch */}
      <Text className="text-green-700 font-semibold mb-2">{t('create.squadIncompleteQuestion')}</Text>
      <SquadSwitch
        value={isSquadIncomplete}
        onValueChange={setIsSquadIncomplete}
        primaryColor={colors.primary}
      />

      {isSquadIncomplete && (
        <View>
          <Text className="text-green-700 font-semibold mb-2 mt-2">{t('create.selectMissingPositionsTitle')}</Text>

          <View className="flex flex-col">
            {/* İlk Satır: Kaleci & Defans */}
            <View className="flex flex-row justify-between">
              {['kaleci', 'defans'].map((position) => (
                <View key={position} style={styles.buttonWrapper}>
                  <TouchableOpacity
                    className="flex p-3 rounded bg-green-600"
                    activeOpacity={1}
                    onPress={() => handlePositionSelection(position)}
                  >
                    <Text className="text-white">
                      {position === 'kaleci' ? t('create.goalkeeper') :
                       position === 'defans' ? t('create.defender') :
                       position === 'ortaSaha' ? t('create.midfielder') :
                       position === 'forvet' ? t('create.forward') :
                       position.charAt(0).toUpperCase() + position.slice(1)}
                    </Text>
                  </TouchableOpacity>

                  {missingPositions[position] && missingPositions[position].selected && (
                    <View className="mt-2">
                      <Text className="text-gray-600 mb-2">{t('create.howManyMissingQuestion').replace('{position}', position === 'ortaSaha' ? 'Orta Saha' : position.charAt(0).toUpperCase() + position.slice(1))}</Text>
                      {renderCountButtons(position)}
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
                    activeOpacity={1}
                    onPress={() => handlePositionSelection(position)}
                  >
                    <Text className="text-white">
                      {position === 'kaleci' ? t('create.goalkeeper') :
                       position === 'defans' ? t('create.defender') :
                       position === 'ortaSaha' ? t('create.midfielder') :
                       position === 'forvet' ? t('create.forward') :
                       position.charAt(0).toUpperCase() + position.slice(1)}
                    </Text>
                  </TouchableOpacity>

                  {missingPositions[position] && missingPositions[position].selected && (
                    <View className="mt-2">
                      <Text className="text-gray-600 mb-2">
                        {t('create.howManyMissingQuestion').replace('{position}', position === 'ortaSaha' ? 'Orta Saha' : position)}
                      </Text>
                      {renderCountButtons(position)}
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
  switchTrack: {
    width: SWITCH_WIDTH,
    height: SWITCH_HEIGHT,
    borderRadius: SWITCH_HEIGHT / 2,
    padding: THUMB_PADDING,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  switchThumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#ffffff',
    borderWidth: 2,
  },
  buttonWrapper: {
    width: '48%',
    marginBottom: 10,
  },
  countRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  countButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});