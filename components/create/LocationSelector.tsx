import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Dimensions, Modal } from 'react-native';
import { supabase } from '@/services/supabase';
import { useLanguage } from '@/contexts/LanguageContext';

interface District {
  id: number;
  name: string;
}

interface Pitch {
  id: number;
  name: string;
  price: number;
  district_id: number;
}

interface LocationSelectorProps {
  selectedDistrict: string;
  setSelectedDistrict: (district: string) => void;
  selectedPitch: string;
  setSelectedPitch: (pitch: string) => void;
  price: string;
  setPrice: (price: string) => void;
  districtName: string; // Bunu ekleyin
  setDistrictName: (name: string) => void; // Bunu ekleyin
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedDistrict,
  setSelectedDistrict,
  selectedPitch,
  setSelectedPitch,
  price,
  setPrice,
  districtName, // Props olarak alın
  setDistrictName // Props olarak alın
}) => {
  const { t } = useLanguage();
  const [districts, setDistricts] = useState<District[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);

  useEffect(() => {
    fetchDistricts();
  }, []);

  useEffect(() => {
    if (selectedDistrict && districts.length > 0) {
      const selected = districts.find(d => d.id === Number(selectedDistrict));
      if (selected) {
        setDistrictName(selected.name);
      }
    } else {
      setDistrictName(''); // District seçili değilse name'i temizle
    }
  }, [selectedDistrict, districts, setDistrictName]);

  // Eğer sayfa parametrelerinden sadece pitchId geldiyse (district yoksa),
  // pitch üzerinden district_id ve price bilgilerini initialize et.
  useEffect(() => {
    let active = true;

    const initFromPitch = async () => {
      if (!selectedPitch) return;

      const { data: pitchData, error } = await supabase
        .from('pitches')
        .select('id, name, price, district_id')
        .eq('id', selectedPitch)
        .single();

      if (!active) return;
      if (error) {
        console.error('Pitch init hatası:', error);
        return;
      }
      if (!pitchData) return;

      if (pitchData.price !== null && pitchData.price !== undefined) {
        setPrice(String(pitchData.price));
      }

      if (!selectedDistrict && pitchData.district_id !== null && pitchData.district_id !== undefined) {
        setSelectedDistrict(String(pitchData.district_id));
      }
    };

    initFromPitch();
    return () => {
      active = false;
    };
  }, [selectedPitch, selectedDistrict, setPrice, setSelectedDistrict]);

  useEffect(() => {
    if (!selectedDistrict) {
      setPitches([]);
      return;
    }
    fetchPitches(selectedDistrict);
  }, [selectedDistrict]);


  const fetchDistricts = async () => {
    const { data, error } = await supabase.from('districts').select('*');
    if (data) {
      setDistricts(data as District[]);
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
      setPitches(data as Pitch[]);
    }
  };

  const screenHeight = Dimensions.get('window').height;

  const renderDistrictModal = () => {
    if (!showDistrictModal) return null;

    return (
      <Modal
        visible={showDistrictModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDistrictModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className="bg-white rounded-lg p-4"
            style={{ width: '85%', maxHeight: screenHeight * 0.75 }}
          >
            <FlatList
              data={districts as District[]}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }: { item: District }) => (
                <TouchableOpacity
                  className="p-3 border-b border-gray-200"
                  onPress={() => {
                    setSelectedDistrict(String(item.id));
                    setShowDistrictModal(false);
                    setSelectedPitch(''); // İlçe değişince seçilen sahayı sıfırla
                    setPrice('');
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
              <Text className="text-white text-center">{t('general.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // const [flatListHeight, setFlatListHeight] = useState(0);

  const renderPitchModal = () => {
    if (!showPitchModal) return null;

    return (
      <Modal
        visible={showPitchModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPitchModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View
            className="bg-white rounded-lg p-4"
            style={{ width: '85%', maxHeight: screenHeight * 0.75, overflow: 'hidden' }}
          >
            <FlatList
              data={pitches as Pitch[]}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }: { item: Pitch }) => (
                <TouchableOpacity
                  className="p-3 border-b border-gray-200"
                  onPress={() => {
                    setSelectedPitch(String(item.id));
                    setPrice(String(item.price)); // Fiyatı state'e kaydet
                    setShowPitchModal(false);
                  }}
                >
                  <Text>{item.name}</Text>
                </TouchableOpacity>
              )}
              style={{ flexGrow: 1 }}
            />
            <TouchableOpacity
              className="mt-4 bg-green-600 rounded p-3"
              onPress={() => setShowPitchModal(false)}
            >
              <Text className="text-white text-center">{t('general.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View className="mb-4">
      <Text className="text-green-700 font-semibold mb-2">{t('create.locationTitle')}</Text>
      <TouchableOpacity
        className="border border-gray-500 rounded mb-2 p-3"
        onPress={() => setShowDistrictModal(true)}
      >
        <Text>{districtName || t('create.selectDistrictPlaceholder')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-gray-500 rounded mb-2 p-3"
        onPress={() => {
          if (!selectedDistrict) return;
          setShowPitchModal(true);
        }}
        disabled={!selectedDistrict}
        style={{
          backgroundColor: !selectedDistrict ? '#eee' : 'transparent', // Arka plan rengini değiştir
          opacity: !selectedDistrict ? 0.7 : 1, // Opaklığı azalt (isteğe bağlı)
        }}
      >
        <Text>
          {selectedPitch
            ? (pitches.find(p => String(p.id) === selectedPitch)?.name ?? t('create.selectPitchPlaceholder'))
            : t('create.selectPitchPlaceholder')}
        </Text>
      </TouchableOpacity>

      {/* Modallar */}
      {renderDistrictModal()}
      {renderPitchModal()}

      <Text className="text-green-700 font-semibold mb-2">{t('create.priceTitle')}</Text>
      <TextInput
        className="w-full border border-gray-500 p-3 rounded"
        placeholder={t('create.pricePlaceholder')}
        placeholderTextColor="#9CA3AF"
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