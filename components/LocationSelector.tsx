import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { supabase } from '@/services/supabase';
import '@/global.css';
import Modal from 'react-native-modal';

interface LocationSelectorProps {
  selectedDistrict: string;
  setSelectedDistrict: (district: string) => void;
  selectedPitch: string;
  setSelectedPitch: (pitch: string) => void;
  price: string;
  setPrice: (price: string) => void;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedDistrict,
  setSelectedDistrict,
  selectedPitch,
  setSelectedPitch,
  price,
  setPrice,
}) => {
  const [districts, setDistricts] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);

  useEffect(() => {
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (selectedDistrict) {
      fetchPitches(selectedDistrict); // fetchPitches çağrısı burada kalıyor
    } else {
      setPitches([]);
    }
  }, [selectedDistrict]);


  const fetchDistricts = async () => {
    const { data, error } = await supabase.from('districts').select('*');
    if (data) {
      setDistricts(data);
    }
  };

  const fetchPitches = async (districtId: string) => {
    const { data, error } = await supabase
      .from('pitches')
      .select('*')
      .eq('district_id', districtId);

    if (error) {
      console.error('Veri çekme hatası:', error);
    } else {
      setPitches(data);
    }
  };

  const screenHeight = Dimensions.get('window').height;

  const renderDistrictModal = () => (
    // ... (İlçe modalı aynı kalıyor)
    <Modal 
            isVisible={showDistrictModal} // isVisible prop'u kullanılıyor
            backdropOpacity={0.5} // Opaklık buradan ayarlanıyor
            onBackdropPress={() => setShowDistrictModal(false)} // Arka plana tıklayınca kapanma
            animationIn="slideInUp" // Animasyonlar eklenebilir
            animationOut="slideOutDown"
          >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-lg bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.75 }}>
          <FlatList
            data={districts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="p-3 border-b border-gray-200"
                onPress={() => {
                  setSelectedDistrict(item.id);
                  setShowDistrictModal(false);
                  setSelectedPitch(''); // İlçe değişince seçilen sahayı sıfırla
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

  // const [flatListHeight, setFlatListHeight] = useState(0);

  const renderPitchModal = () => (
    // ... (Saha modalı aynı kalıyor)
    <Modal 
            isVisible={showPitchModal} // isVisible prop'u kullanılıyor
            backdropOpacity={0.5} // Opaklık buradan ayarlanıyor
            onBackdropPress={() => setShowPitchModal(false)} // Arka plana tıklayınca kapanma
            animationIn="slideInUp" // Animasyonlar eklenebilir
            animationOut="slideOutDown"
            style={{ flex: 1 }}
          >
       <View className="flex-1 justify-center items-center bg-black/50">
        <View 
          className="w-3/5 bg-white rounded-lg p-4" 
          style={{ 
            maxHeight: screenHeight * 0.75, 
            // overflow: 'hidden' // İçeriğin taşmasını engeller (isteğe bağlı)
          }}
        >
          <FlatList
            data={pitches}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                className="p-3 border-b border-gray-200"
                onPress={() => {
                  setSelectedPitch(item.id);
                  setPrice(item.price.toString()); // Fiyatı state'e kaydet
                  setShowPitchModal(false);
                }}
              >
                <Text> {item.name} </Text>
              </TouchableOpacity>
            )}
            style={{ 
              flexGrow: 1, // FlatList'in modal içinde mümkün olduğunca fazla yer kaplamasını sağlar
              // height: 'auto' // İçeriğe göre yükseklik (bazı durumlarda sorunlara yol açabilir)
            }}
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

  return (
    <View className="mb-4">
      <Text className="text-green-700 font-semibold mb-2">Saha Seç</Text> {/* Text componenti eklendi */}
      <TouchableOpacity
        className="border border-gray-500 rounded mb-2 p-3"
        onPress={() => setShowDistrictModal(true)}
      >
        <Text> {/* Text componenti eklendi */}
          {selectedDistrict ? districts.find(d => d.id === selectedDistrict)?.name : 'İlçe Seçiniz'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-gray-500 rounded mb-2 p-3"
        onPress={() => selectedDistrict ? setShowPitchModal(true) : null}
        disabled={!selectedDistrict}
        style={{ 
          backgroundColor: !selectedDistrict ? '#eee' : 'transparent', // Arka plan rengini değiştir
          opacity: !selectedDistrict ? 0.7 : 1, // Opaklığı azalt (isteğe bağlı)
      }}
      >
        <Text> {/* Text componenti eklendi */}
          {selectedPitch ? pitches.find(p => p.id === selectedPitch)?.name : 'Halı Saha Seçiniz'}
        </Text>
      </TouchableOpacity>

      {/* Modallar */}
      {renderDistrictModal()}
      {renderPitchModal()}

      <Text className="text-green-700 font-semibold mb-2">Fiyat</Text> {/* Text componenti eklendi */}
      <TextInput
        className="w-full border border-gray-500 p-3 rounded"
        placeholder="Halı Sahanın Fiyatı"
        value={price ? `${price} ₺` : ""} // State'deki fiyatı göster
        editable={false} // TextInput'u pasif yap
        style={{ 
          color: 'green', fontWeight: '600',
          backgroundColor: selectedDistrict ? '#eee' : 'transparent', // Arka plan rengini değiştir
          opacity: !selectedDistrict ? 0.7 : 1, // Opaklığı azalt (isteğe bağlı)
         }} // Fiyatı yeşil yap
      />
    </View>
  );
};