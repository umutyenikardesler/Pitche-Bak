import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { MatchDetailsForm } from '@/components/create/MatchDetailsForm';
import { LocationSelector } from '@/components/create/LocationSelector';
import { SquadSelector } from '@/components/create/SquadSelector';
import { supabase } from '@/services/supabase';
import '@/global.css';
import { useNavigation, useRoute } from '@react-navigation/native';
import AsyncStorage from "@react-native-async-storage/async-storage"; // Kullanıcı ID'sini almak için eklendi
import { useLocalSearchParams } from "expo-router";

interface MissingPosition {
  selected: boolean;
  count: number;
}

interface MissingPositions {
  kaleci: MissingPosition;
  defans: MissingPosition;
  ortaSaha: MissingPosition;
  forvet: MissingPosition;
}

export default function CreateMatch() {
  const [matchTitle, setMatchTitle] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  // const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [selectedPitch, setSelectedPitch] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState('1');
  const [price, setPrice] = useState('');
  const [isSquadIncomplete, setIsSquadIncomplete] = useState(false);
  const [missingPositions, setMissingPositions] = useState<MissingPositions>({
    kaleci: { selected: false, count: 1 },
    defans: { selected: false, count: 1 },
    ortaSaha: { selected: false, count: 1 },
    forvet: { selected: false, count: 1 }
  });

  const [userId, setUserId] = useState(null);

  
const navigation = useNavigation();

// const [matchTitle, setMatchTitle] = useState('');
// const [selectedDistrict, setSelectedDistrict] = useState('');
// const [selectedPitch, setSelectedPitch] = useState('');
//const [price, setPrice] = useState('');

const { pitchId, district, name, price: incomingPrice } = useLocalSearchParams();

  
useEffect(() => {
  const fetchUserId = async () => {
    const storedUserId = await AsyncStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    }
  };

  fetchUserId();

  if (pitchId) setSelectedPitch(pitchId.toString());
  if (district) setSelectedDistrict(district.toString());
  if (incomingPrice) setPrice(String(incomingPrice));
  if (name) setMatchTitle(`⚽ ${name} Maçı`);
}, []);

  //const navigation = useNavigation(); // Navigation hook'u tanımlandı

  const handleCreateMatch = async () => {

    if (!userId) {
      Alert.alert("Hata", "Kullanıcı bilgisi bulunamadı, lütfen tekrar giriş yapın.");
      return;
    }

    const formattedTime = `${time.padStart(2, '0')}:00:00`;
    const missingGroups = isSquadIncomplete
      ? Object.keys(missingPositions)
        .filter(position => missingPositions[position].selected)
        .map(position => {
          const shortCode = position === 'kaleci' ? 'K'
            : position === 'defans' ? 'D'
              : position === 'ortaSaha' ? 'O'
                : 'F';
          return `${shortCode}:${missingPositions[position].count}`;
        })
      : [];

    const { data, error } = await supabase
      .from('match')
      .insert([
        {
          title: matchTitle,
          location: selectedPitch,
          time: formattedTime,
          date: date.toISOString().split('T')[0],
          prices: price,
          missing_groups: missingGroups,
          create_user: userId, // Kullanıcının ID'si burada ekleniyor
        },
      ]);

    if (error) {
      console.error('Maç oluşturulurken hata oluştu:', error);
      if (Platform.OS === 'web') {
        alert("Hata: Maç oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
      } else {
        Alert.alert("Hata", "Maç oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
      }
    } else {
      console.log('Maç başarıyla oluşturuldu:', data);

      if (route.params && route.params.onMatchCreated) {
        route.params.onMatchCreated(); // Profil sayfasındaki güncelleme fonksiyonunu çağır
      }

      if (Platform.OS === 'web') {
        alert("Tebrikler 🎉\nMaçınız başarılı bir şekilde oluşturulmuştur.");
        window.location.href = '/'; // Web için yönlendirme
      } else {
        Alert.alert(
          "Tebrikler 🎉",
          "Maçınız başarılı bir şekilde oluşturulmuştur.",
          [
            {
              text: "Tamam",
              onPress: () => {
                setMatchTitle('');
                setSelectedDistrict('');
                setSelectedPitch('');
                setDate(new Date());
                setTime('1');
                setPrice('');
                setIsSquadIncomplete(false);
                setMissingPositions({
                  kaleci: { selected: false, count: 1 },
                  defans: { selected: false, count: 1 },
                  ortaSaha: { selected: false, count: 1 },
                  forvet: { selected: false, count: 1 },
                });

                navigation.navigate("index", { refreshProfile: true }); // Profil sayfasını güncellemek için parametre gönder
              }
            }
          ]
        );
      }
    }
  };

  return (
    <ScrollView className="bg-white rounded-lg my-3 mx-4 p-4 shadow-md">
      <View className="mb-4">
        <Text className="text-green-700 font-semibold mb-2">Maç Başlığı</Text>
        <TextInput
          className="w-full border border-gray-500 p-2 rounded"
          placeholder="Maç Başlığı Giriniz"
          value={matchTitle}
          onChangeText={setMatchTitle}
        />
      </View>

      <LocationSelector
        selectedDistrict={selectedDistrict}
        setSelectedDistrict={setSelectedDistrict}
        // selectedNeighborhood={selectedNeighborhood}
        // setSelectedNeighborhood={setSelectedNeighborhood}
        selectedPitch={selectedPitch}
        setSelectedPitch={setSelectedPitch}
        price={price}
        setPrice={setPrice}
      />

      <MatchDetailsForm
        date={date}
        setDate={setDate}
        time={time}
        setTime={setTime}
      />

      <SquadSelector
        isSquadIncomplete={isSquadIncomplete}
        setIsSquadIncomplete={setIsSquadIncomplete}
        missingPositions={missingPositions}
        setMissingPositions={setMissingPositions}
      />

      <View className="mb-4">
        <TouchableOpacity
          className="bg-green-600 rounded p-3 mb-4"
          onPress={handleCreateMatch}
        >
          <Text className="text-white text-center">Maç Oluştur</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}