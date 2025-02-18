import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MatchDetailsForm } from '@/components/MatchDetailsForm';
import { LocationSelector } from '@/components/LocationSelector';
import { SquadSelector } from '@/components/SquadSelector';
import { supabase } from '@/services/supabase';
import '@/global.css';
import { useNavigation } from '@react-navigation/native'; // Navigation kütüphanesi eklendi

export default function CreateMatch() {
  const [matchTitle, setMatchTitle] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [selectedPitch, setSelectedPitch] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState('1');
  const [price, setPrice] = useState('');
  const [isSquadIncomplete, setIsSquadIncomplete] = useState(false);
  const [missingPositions, setMissingPositions] = useState({
    kaleci: { selected: false, count: 1 },
    defans: { selected: false, count: 1 },
    ortaSaha: { selected: false, count: 1 },
    forvet: { selected: false, count: 1 }
  });

  const navigation = useNavigation(); // Navigation hook'u tanımlandı

  const handleCreateMatch = async () => {
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
        },
      ]);

      if (error) {
        console.error('Maç oluşturulurken hata oluştu:', error);
        Alert.alert("Hata", "Maç oluşturulurken bir hata oluştu. Lütfen tekrar deneyin."); // Hata mesajı göster
      } else {
        console.log('Maç başarıyla oluşturuldu:', data);

      // Başarı mesajı göster
      Alert.alert(
        "Tebrikler 🎉",
        "Maçınız başarılı bir şekilde oluşturulmuştur.",
        [
          { 
            text: "Tamam", 
            onPress: () => {
              // Formu sıfırla
              setMatchTitle('');
              setSelectedDistrict('');
              setSelectedNeighborhood('');
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

              navigation.navigate('index'); // Doğrudan yönlendirme

              // setTimeout(() => { // 2 saniye sonra yönlendirme
              //   navigation.navigate('index'); 
              // }, 2000); // 2000 milisaniye = 2 saniye
            } 
          }
        ]
      );
    }
  };

  return (
    <ScrollView className="p-4">
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

      <View className="mb-8">
        <TouchableOpacity
          className="bg-green-600 rounded p-3"
          onPress={handleCreateMatch}
        >
          <Text className="text-white text-center">Maç Oluştur</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}