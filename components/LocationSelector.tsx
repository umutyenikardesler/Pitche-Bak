import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, Dimensions } from 'react-native';
import { supabase } from '@/services/supabase';
import '@/global.css';

interface LocationSelectorProps {
  selectedDistrict: string;
  setSelectedDistrict: (district: string) => void;
  selectedNeighborhood: string;
  setSelectedNeighborhood: (neighborhood: string) => void;
  selectedPitch: string;
  setSelectedPitch: (pitch: string) => void;
  price: string;
  setPrice: (price: string) => void;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedDistrict,
  setSelectedDistrict,
  selectedNeighborhood,
  setSelectedNeighborhood,
  selectedPitch,
  setSelectedPitch,
  price,
  setPrice,
}) => {
  const [districts, setDistricts] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showNeighborhoodModal, setShowNeighborhoodModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);

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

  const fetchNeighborhoods = async (districtId: string) => {
    const { data, error } = await supabase.from('neighborhoods').select('*').eq('district_id', districtId);
    if (data) {
      setNeighborhoods(data);
    }
  };

  const fetchPitches = async (neighborhoodId: string) => {
    const { data, error } = await supabase.from('pitches').select('*').eq('neighborhood_id', neighborhoodId);
    if (data) {
      setPitches(data);
    }
  };

  const screenHeight = Dimensions.get('window').height;

  // İlçe seçimi için modal
  const renderDistrictModal = () => (
    <Modal visible={showDistrictModal} transparent={true} animationType="slide">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-80 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.75 }}>
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

  const renderNeighborhoodModal = () => (
    <Modal visible={showNeighborhoodModal} transparent={true} animationType="slide">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-80 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.75 }}>
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

  const renderPitchModal = () => (
    <Modal visible={showPitchModal} transparent={true} animationType="slide">
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-80 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.75 }}>
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

  return (
    <View className="mb-4">
      <Text className="text-green-700 font-semibold mb-2">Saha Seç</Text>
      <TouchableOpacity
        className="border border-gray-500 rounded mb-2 p-3"
        onPress={() => setShowDistrictModal(true)}
      >
        <Text>{selectedDistrict ? districts.find(d => d.id === selectedDistrict)?.name : 'İlçe Seçiniz'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-gray-500 rounded mb-2 p-3"
        onPress={() => setShowNeighborhoodModal(true)}
      >
        <Text>{selectedNeighborhood ? neighborhoods.find(n => n.id === selectedNeighborhood)?.name : 'Mahalle Seçiniz'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="border border-gray-500 rounded mb-2 p-3"
        onPress={() => setShowPitchModal(true)}
      >
        <Text>{selectedPitch ? pitches.find(p => p.id === selectedPitch)?.name : 'Halı Saha Seçiniz'}</Text>
      </TouchableOpacity>

      {/* Modallar */}
      {renderDistrictModal()}
      {renderNeighborhoodModal()}
      {renderPitchModal()}

      <Text className="text-green-700 font-semibold mb-2">Fiyat</Text>
      <TextInput
        className="w-full border border-gray-500 p-2 rounded"
        placeholder="Fiyat"
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
      />
    </View>
  );
};