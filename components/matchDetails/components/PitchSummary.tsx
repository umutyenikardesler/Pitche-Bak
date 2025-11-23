// Halı saha özeti componenti
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { useLanguage } from '@/contexts/LanguageContext';
import { Match } from '@/components/index/types';

interface PitchSummaryProps {
  match: Match;
}

export default function PitchSummary({ match }: PitchSummaryProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const featuresArray: string[] = Array.isArray(match.pitches) 
    ? match.pitches[0]?.features || []
    : match.pitches?.features || [];

  const pitch = Array.isArray(match.pitches) ? match.pitches[0] : match.pitches;
  const pitchName = pitch?.name ?? 'Bilinmiyor';
  const pitchAddress = pitch?.address ?? 'Adres bilgisi yok';
  const pitchPrice = pitch?.price ?? 'Fiyat bilgisi yok';
  const pitchPhone = pitch?.phone ?? '';
  const hasPhone = !!pitchPhone;

  return (
    <>
      <TouchableOpacity 
        className="flex-row mb-3 justify-center items-center bg-green-100 border-2 border-green-300 rounded-lg py-3 px-2"
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <Ionicons name="accessibility-outline" size={20} color="green" />
        <Text className="text-xl font-bold text-green-700 ml-3"> {t('home.pitchSummary')} </Text>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={24} 
          color="green" 
          className="ml-3" 
        />
      </TouchableOpacity>

      {/* Dropdown içeriği */}
      {isExpanded && (
        <View style={{ minHeight: 200 }}>
          {pitch?.latitude && pitch?.longitude && (
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
                  title={pitchName}
                />
              </MapView>
            </View>
          )}

          <View className="">
            <Text className="h-7 text-xl font-semibold text-green-700 text-center my-2">{pitchName}</Text>
          </View>

          <View className="">
            <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">{t('home.openAddress')}</Text>
          </View>
          <View className="text-gray-700 text-md flex-row justify-center items-center pt-1">
            <Ionicons name="location" size={18} color="black" />
            <Text className="pl-2 font-semibold text-gray-700">{pitchAddress}</Text>
          </View>

          {/* Telefon ve Ücret yan yana */}
          <View className="flex-row mt-3">
            {/* Sol: Halı Saha Telefonu */}
            <View className="w-1/2 pr-1">
              <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">
                Halı Saha Telefonu
              </Text>
              {hasPhone ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${pitchPhone}`)}
                  activeOpacity={0.7}
                >
                  <View className="text-gray-700 text-md flex-row justify-center items-center pt-1">
                    <Ionicons name="call-outline" size={18} color="green" />
                    <Text className="pl-2 font-semibold text-gray-900">
                      {pitchPhone}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View className="text-gray-700 text-md flex-row justify-center items-center pt-1">
                  <Ionicons name="call-outline" size={18} color="green" />
                  <Text className="pl-2 font-semibold text-gray-700">
                    Telefon bilgisi yok
                  </Text>
                </View>
              )}
            </View>

            {/* Sağ: Saha Ücreti */}
            <View className="w-1/2 pl-1">
              <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">
                {t('home.pitchPrice')}
              </Text>
              <View className="text-gray-700 text-md flex-row justify-center items-center pt-1">
                <Ionicons name="wallet-outline" size={18} color="green" />
                <Text className="pl-2 font-semibold text-gray-700">
                  {pitchPrice} ₺
                </Text>
              </View>
            </View>
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
        </View>
      )}
    </>
  );
}

