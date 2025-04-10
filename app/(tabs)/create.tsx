import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';

import { MatchDetailsForm } from '@/components/create/MatchDetailsForm';
import { LocationSelector } from '@/components/create/LocationSelector';
import { SquadSelector } from '@/components/create/SquadSelector';

import { supabase } from '@/services/supabase';
import '@/global.css';

import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from "@react-native-async-storage/async-storage"; // Kullanıcı ID'sini almak için eklendi
import { useLocalSearchParams, useRouter } from "expo-router";

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
  const [localDistrictName, setLocalDistrictName] = useState(''); // İsmini değiştirdik
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
  const router = useRouter();
  const navigation = useNavigation();

  // const [matchTitle, setMatchTitle] = useState('');
  // const [selectedDistrict, setSelectedDistrict] = useState('');
  // const [selectedPitch, setSelectedPitch] = useState('');
  // const [price, setPrice] = useState('');

  const { pitchId, district, districtName: paramDistrictName, price: incomingPrice, shouldSetFields } = useLocalSearchParams();

  useEffect(() => {
    const fetchUserId = async () => {
      const storedUserId = await AsyncStorage.getItem("userId");
      if (storedUserId) {
        setUserId(storedUserId);
      }
    };

    fetchUserId();

    if (shouldSetFields === "true") {
      // Yalnızca soccer iconuna basıldığında formu doldur
      if (pitchId) setSelectedPitch(pitchId.toString());
      if (district) setSelectedDistrict(district.toString());
      if (paramDistrictName) setLocalDistrictName(paramDistrictName.toString());
      if (incomingPrice) setPrice(incomingPrice.toString());

      // Router'ın parametrelerini temizle (bir sonraki açılışta tekrar doldurmaması için)
      router.setParams({ shouldSetFields: "false" });
    }
  }, [pitchId, district, paramDistrictName, incomingPrice, shouldSetFields]);

  const handleCreateMatch = async () => {

    if (!userId) {
      Alert.alert("Hata", "Kullanıcı bilgisi bulunamadı, lütfen tekrar giriş yapın.");
      return;
    }

    try {
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

      // if (error) {
      //   console.error('Maç oluşturulurken hata oluştu:', error);
      //   if (Platform.OS === 'web') {
      //     alert("Hata: Maç oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
      //   } else {
      //     Alert.alert("Hata", "Maç oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.");
      //   }
      // } else {
      //   console.log('Maç başarıyla oluşturuldu:', data);

      //   if (route.params && route.params.onMatchCreated) {
      //     route.params.onMatchCreated(); // Profil sayfasındaki güncelleme fonksiyonunu çağır
      //   }

      //   if (Platform.OS === 'web') {
      //     alert("Tebrikler 🎉\nMaçınız başarılı bir şekilde oluşturulmuştur.");
      //     window.location.href = '/'; // Web için yönlendirme
      //   } else {
      //     Alert.alert(
      //       "Tebrikler 🎉",
      //       "Maçınız başarılı bir şekilde oluşturulmuştur.",
      //       [
      //         {
      //           text: "Tamam",
      //           onPress: () => {
      //             setMatchTitle('');
      //             setSelectedDistrict('');
      //             setSelectedPitch('');
      //             setDate(new Date());
      //             setTime('1');
      //             setPrice('');
      //             setIsSquadIncomplete(false);
      //             setMissingPositions({
      //               kaleci: { selected: false, count: 1 },
      //               defans: { selected: false, count: 1 },
      //               ortaSaha: { selected: false, count: 1 },
      //               forvet: { selected: false, count: 1 },
      //             });

      //             navigation.navigate("index", { refreshProfile: true }); // Profil sayfasını güncellemek için parametre gönder
      //           }
      //         }
      //       ]
      //     );
      //   }
      // }
      if (error) throw error;

      console.log('Maç başarıyla oluşturuldu:', data);

      // Başarılı mesajını göster
      Alert.alert(
        "Tebrikler 🎉",
        "Maçınız başarılı bir şekilde oluşturulmuştur.",
        [
          {
            text: "Tamam",
            onPress: () => {
              // Formu temizle
              setMatchTitle('');
              setSelectedDistrict('');
              setSelectedPitch('');
              setLocalDistrictName('');
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
              // Ana sayfaya yönlendir
              if (Platform.OS === 'web') {
                window.location.href = '/';
              } else {
                navigation.navigate("(tabs)", { screen: "index" });
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Maç oluşturulurken hata oluştu:', error);
      Alert.alert(
        "Hata",
        "Maç oluşturulurken bir hata oluştu. Lütfen tekrar deneyin."
      );
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Sayfadan çıkılırken temizleme işlemi
        setMatchTitle('');
        setSelectedDistrict('');
        setSelectedPitch('');
        setLocalDistrictName(''); // Yeni ismi kullan
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
      };
    }, [])
  );

  const capitalizeWords = (text: string) => {
    return text
      .toLocaleLowerCase('tr-TR')
      .split(' ')
      .map(word =>
        word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1)
      )
      .join(' ');
  };

  return (
    <ScrollView className="bg-white rounded-lg my-3 mx-4 p-4 shadow-md">
      <View className="mb-4">
        <Text className="text-green-700 font-semibold mb-2">Maç Başlığı</Text>
        <TextInput
          className="w-full border border-gray-500 p-2 rounded"
          placeholder="Maç Başlığı Giriniz"
          value={matchTitle}
          onChangeText={(text) => setMatchTitle(capitalizeWords(text))}
          autoCapitalize="words" // Bu satırı da ekleyebilirsiniz (klavye özelliği)
        />
      </View>

      <LocationSelector
        selectedDistrict={selectedDistrict}
        setSelectedDistrict={setSelectedDistrict}
        selectedPitch={selectedPitch}
        setSelectedPitch={setSelectedPitch}
        price={price}
        setPrice={setPrice}
        districtName={localDistrictName} // Yeni ismi kullan
        setDistrictName={setLocalDistrictName} // Yeni ismi kullan
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