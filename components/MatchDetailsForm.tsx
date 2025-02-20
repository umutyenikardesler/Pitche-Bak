import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, FlatList, Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Modal from 'react-native-modal';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css'; // Web için gerekli
import { tr } from 'date-fns/locale'; // Türkçe locale desteği
import '@/global.css';

interface MatchDetailsFormProps {
  date: Date;
  setDate: (date: Date) => void;
  time: string;
  setTime: (time: string) => void;
}

export const MatchDetailsForm: React.FC<MatchDetailsFormProps> = ({ date, setDate, time, setTime }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleDateChange = (selectedDate: Date | null) => {
    if (selectedDate) {
      setDate(selectedDate);
    }
    setShowDatePicker(false);
  };

  const screenHeight = Dimensions.get('window').height;

  const renderTimeModal = () => (
    <Modal
      isVisible={showTimeModal}
      backdropOpacity={0.5}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      //animationType="fade"
      // onRequestClose={() => setShowTimeModal(false)}
      onBackdropPress={() => setShowTimeModal(false)}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-80 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.75 }}>
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
    <View className="mb-4">
      <Text className="text-green-700 font-semibold mb-2">Tarih ve Saat</Text>
      <View className="flex flex-row">
        {/* Tarih Seçimi */}
        {Platform.OS === 'web' ? (
          <>
            <TouchableOpacity
              className="bg-green-600 rounded p-3 flex-1"
              onPress={() => setShowDatePicker(true)}
            >
              <Text className="text-white text-center">{formatDate(date)}</Text>
            </TouchableOpacity>

            {/* Web için tarih seçici modalı */}
            {showDatePicker && (
              <Modal 
                isVisible={true} 
                backdropOpacity={0.5}
                animationIn="slideInUp"
                animationOut="slideOutDown"
                //animationType="fade"
                // onRequestClose={() => setShowTimeModal(false)}
                onBackdropPress={() => setShowTimeModal(false)}
                >
                <View className="flex-1 justify-center items-center bg-black/50">
                  <View className="bg-white p-4 rounded-lg">
                    <ReactDatePicker
                      selected={date}
                      onChange={handleDateChange}
                      inline
                      minDate={new Date()}
                      locale={tr} // TAKVİMİ TÜRKÇE YAPAR
                    />
                    <TouchableOpacity
                      className="mt-4 bg-red-500 rounded p-2"
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text className="text-white text-center">Kapat</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            )}
          </>
        ) : (
          <TouchableOpacity
            className="bg-green-600 rounded p-3 flex-1"
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <Text className="text-white text-center">{formatDate(date)}</Text>
          </TouchableOpacity>
        )}

        {/* Saat Seçimi */}
        <TouchableOpacity
          className="bg-green-600 rounded p-3 flex-1 ml-2"
          onPress={() => setShowTimeModal(true)}
        >
          <Text className="text-white text-center">{time}:00</Text>
        </TouchableOpacity>
      </View>

      {/* Takvim (Sadece Mobilde) */}
      {showDatePicker && Platform.OS !== 'web' && (
        <View className="items-center">
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, selectedDate) => handleDateChange(selectedDate ?? date)}
            locale="tr-TR"
            minimumDate={new Date()}
            style={{ width: '100%' }}
          />
        </View>
      )}

      {/* Saat Seçici Modal */}
      {renderTimeModal()}
    </View>
  );
};