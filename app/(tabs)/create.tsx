import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Modal, TouchableOpacity, FlatList, Dimensions, Platform, Switch } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker'; // Tarih seçici (Expo ile uyumlu)
import { supabase } from '@/services/supabase';
import '@/global.css';

export default function CreateMatch() {
  const [matchTitle, setMatchTitle] = useState('');
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [pitches, setPitches] = useState([]);
  const [selectedPitch, setSelectedPitch] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState('1');
  const [price, setPrice] = useState(''); // Fiyat için state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showNeighborhoodModal, setShowNeighborhoodModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);

  // Kadro eksik mi state'i
  const [isSquadIncomplete, setIsSquadIncomplete] = useState(false);
  const [missingPositions, setMissingPositions] = useState({
    kaleci: { selected: false, count: 1 },
    defans: { selected: false, count: 1 },
    ortaSaha: { selected: false, count: 1 },
    forvet: { selected: false, count: 1 }
  });

  // Eksik oyuncu sayısını değiştirme fonksiyonu
  const handlePositionSelection = (position) => {
    setMissingPositions((prev) => ({
      ...prev,
      [position]: { ...prev[position], selected: !prev[position].selected }
    }));
  };

  const handleCountChange = (position, value) => {
    setMissingPositions((prev) => ({
      ...prev,
      [position]: { ...prev[position], count: value }
    }));
  };


  // Ekran yüksekliğini al
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (selectedDistrict) {
      fetchNeighborhoods(selectedDistrict);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedNeighborhood) {
      fetchPitches(selectedNeighborhood);
    }
  }, [selectedNeighborhood]);

  const fetchDistricts = async () => {
    const { data, error } = await supabase.from('districts').select('*');
    if (data) {
      setDistricts(data);
    }
  };

  const fetchNeighborhoods = async (districtId) => {
    const { data, error } = await supabase.from('neighborhoods').select('*').eq('district_id', districtId);
    if (data) {
      setNeighborhoods(data);
    }
  };

  const fetchPitches = async (neighborhoodId) => {
    const { data, error } = await supabase.from('pitches').select('*').eq('neighborhood_id', neighborhoodId);
    if (data) {
      setPitches(data);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios'); // iOS'ta picker otomatik kapanmaz
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  // Tarihi Gün/Ay/Yıl formatında göster
  const formatDate = (date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1; // Aylar 0'dan başlar
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Maç oluştur butonuna basıldığında çalışacak fonksiyon
  const handleCreateMatch = async () => {
    const formattedTime = `${time.padStart(2, '0')}:00:00`; // Saat değerini "HH:mm:ss" formatına getir

      // Eksik mevkileri 'K:1' formatında oluştur
      const missingGroups = isSquadIncomplete
      ? Object.keys(missingPositions)
          .filter(position => missingPositions[position].selected)
          .map(position => {
            const shortCode = position === 'kaleci' ? 'K' 
                          : position === 'defans' ? 'D' 
                          : position === 'orta_saha' ? 'O' 
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
          missing_groups: missingGroups, // Eksik grupları kaydet
        },
      ]);

    if (error) {
      console.error('Maç oluşturulurken hata oluştu:', error);
    } else {
      console.log('Maç başarıyla oluşturuldu:', data);

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
        orta_saha: { selected: false, count: 1 },
        forvet: { selected: false, count: 1 },
      });
    }
    };
  // İlçe seçimi için modal
  const renderDistrictModal = () => (
    <Modal visible={showDistrictModal} transparent={true} animationType="slide">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-80 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.8 }}>
          <FlatList
            data={districts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="p-3 border-b border-gray-200"
                onPress={() => {
                  setSelectedDistrict(item.id);
                  setShowDistrictModal(false);
                }}
              >
                <Text>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            className="mt-4 bg-green-600 rounded p-3"
            onPress={() => setShowDistrictModal(false)}
          >
            <Text className="text-white text-center">Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Mahalle seçimi için modal
  const renderNeighborhoodModal = () => (
    <Modal visible={showNeighborhoodModal} transparent={true} animationType="slide">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-80 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.8 }}>
          <FlatList
            data={neighborhoods}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="p-3 border-b border-gray-200"
                onPress={() => {
                  setSelectedNeighborhood(item.id);
                  setShowNeighborhoodModal(false);
                }}
              >
                <Text>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            className="mt-4 bg-green-600 rounded p-3"
            onPress={() => setShowNeighborhoodModal(false)}
          >
            <Text className="text-white text-center">Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Halı saha seçimi için modal
  const renderPitchModal = () => (
    <Modal visible={showPitchModal} transparent={true} animationType="slide">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-80 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.8 }}>
          <FlatList
            data={pitches}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="p-3 border-b border-gray-200"
                onPress={() => {
                  setSelectedPitch(item.id);
                  setShowPitchModal(false);
                }}
              >
                <Text>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            className="mt-4 bg-green-600 rounded p-3"
            onPress={() => setShowPitchModal(false)}
          >
            <Text className="text-white text-center">Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Saat seçimi için modal
  const renderTimeModal = () => (
    <Modal visible={showTimeModal} transparent={true} animationType="slide">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-80 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.8 }}>
          <FlatList
            data={Array.from({ length: 24 }, (_, i) => ({ label: `${i + 1}:00`, value: (i + 1).toString() }))}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="p-3 border-b border-gray-200"
                onPress={() => {
                  setTime(item.value);
                  setShowTimeModal(false);
                }}
              >
                <Text>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity
            className="mt-4 bg-green-600 rounded p-3"
            onPress={() => setShowTimeModal(false)}
          >
            <Text className="text-white text-center">Kapat</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView className="p-4">
      {/* Maç Başlığı */}
      <View className="mb-4">
        <Text className="text-green-700 font-semibold mb-2">Maç Başlığı</Text>
        <TextInput
          className="w-full border border-gray-500 p-2 rounded"
          placeholder="Maç Başlığı"
          value={matchTitle}
          onChangeText={setMatchTitle}
        />
      </View>

      {/* Saha Seçimi */}
      <View className="mb-4">
        <Text className="text-green-700 font-semibold mb-2">Saha Seç</Text>

        {/* İlçe Seçimi */}
        <TouchableOpacity
          className="border border-gray-500 rounded mb-2 p-3"
          onPress={() => setShowDistrictModal(true)}
        >
          <Text>{selectedDistrict ? districts.find(d => d.id === selectedDistrict)?.name : 'İlçe Seçiniz'}</Text>
        </TouchableOpacity>

        {/* Mahalle Seçimi */}
        <TouchableOpacity
          className="border border-gray-500 rounded mb-2 p-3"
          onPress={() => setShowNeighborhoodModal(true)}
        >
          <Text>{selectedNeighborhood ? neighborhoods.find(n => n.id === selectedNeighborhood)?.name : 'Mahalle Seçiniz'}</Text>
        </TouchableOpacity>

        {/* Halı Saha Seçimi */}
        <TouchableOpacity
          className="border border-gray-500 rounded mb-2 p-3"
          onPress={() => setShowPitchModal(true)}
        >
          <Text>{selectedPitch ? pitches.find(p => p.id === selectedPitch)?.name : 'Halı Saha Seçiniz'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tarih ve Saat Seçimi */}
      <View className="mb-4">
        <Text className="text-green-700 font-semibold mb-2">Tarih ve Saat</Text>
        <View className="flex flex-row justify-between">
        {/* Tarih Seçimi */}
          <TouchableOpacity
            className={Platform.OS === 'android' ? "bg-green-600 rounded p-3 flex-1 mr-2" : "flex-1 mr-2"}
            onPress={() => setShowDatePicker(true)}
          >
            {Platform.OS === 'android' && (
              <Text className="text-white text-center">{formatDate(date)}</Text>
            )}
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={handleDateChange}
              locale="tr-TR"
            />
          )}

          {/* Saat Seçimi */}
          <TouchableOpacity
            className="bg-green-600 rounded p-3 flex-1 ml-2"
            onPress={() => setShowTimeModal(true)}
          >
            <Text className="text-white text-center">{time}:00</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Fiyat */}
      <View className="mb-4">
        <Text className="text-green-700 font-semibold mb-2">Fiyat</Text>
        <TextInput
          className="w-full border border-gray-500 p-2 rounded"
          placeholder="Fiyat"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric" // Sayısal klavye
        />
      </View>

      {/* Kadro Eksik mi? */}
      <View className="mb-4">
        <Text className="text-green-700 font-semibold mb-2">Kadro Eksik mi?</Text>
        <Switch
          value={isSquadIncomplete}
          onValueChange={setIsSquadIncomplete}
        />
      </View>

      {isSquadIncomplete && (
  <View className="mb-4">
    <Text className="text-green-700 font-semibold mb-2">Eksik Mevkileri Seçin</Text>
    <View className="flex flex-row flex-wrap">
      {Object.keys(missingPositions).map((position, index) => (
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
                  className={`px-4 py-2 mx-1 rounded ${
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

      {/* Formu Gönder Butonu */}
      <TouchableOpacity
        className="bg-green-600 rounded p-3"
        onPress={handleCreateMatch}
      >
        <Text className="text-white text-center">Maç Oluştur</Text>
      </TouchableOpacity>

      {/* Modallar */}
      {renderDistrictModal()}
      {renderNeighborhoodModal()}
      {renderPitchModal()}
      {renderTimeModal()}
    </ScrollView>
  );
}