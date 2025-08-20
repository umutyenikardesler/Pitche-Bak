import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, FlatList, Dimensions, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { tr } from 'date-fns/locale';
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
  const screenHeight = Dimensions.get('window').height;

  // Türkiye saatine göre bugünü hesapla - düzeltilmiş versiyon
  const getTurkishDate = (d = new Date()) => {
    // Yerel saat dilimini UTC'ye çevir, sonra Türkiye saatine (UTC+3) çevir
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utcTime + (3 * 3600000)); // UTC+3
  };

  // Seçilen tarihi doğru şekilde işlemek için yeni fonksiyon
  const createTurkishDate = (year: number, month: number, day: number) => {
    // Yerel saat diliminde yeni bir tarih oluştur
    const localDate = new Date(year, month, day);
    // UTC'ye çevir
    const utcTime = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);
    // Türkiye saatine çevir
    return new Date(utcTime + (3 * 3600000));
  };

  const turkishNow = getTurkishDate();
  const isToday = date.getDate() === turkishNow.getDate() && 
                 date.getMonth() === turkishNow.getMonth() && 
                 date.getFullYear() === turkishNow.getFullYear();
  const currentHour = turkishNow.getHours();

  useEffect(() => {
    if (!isToday) {
      setTime("0");
    }
  }, [date]);

  const availableHours = Array.from({ length: 24 }, (_, i) => i)
    .filter(hour => !isToday || hour > currentHour);

  useEffect(() => {
    if (isToday && Number(time) <= currentHour) {
      setTime((currentHour + 1).toString());
    }
  }, [date]);

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleDateChange = (selectedDate: Date | null) => {
    if (selectedDate) {
      // Seçilen tarihi doğru şekilde işle
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const day = selectedDate.getDate();
      
      const turkishDate = createTurkishDate(year, month, day);
      setDate(turkishDate);
    }
    setShowDatePicker(false);
  };

  const renderTimeModal = () => (
    <Modal
      visible={showTimeModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowTimeModal(false)}
    >
      <View className="flex-1 justify-center items-center">
        <View className="w-50 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.75 }}>
          <FlatList
            data={availableHours.map(hour => ({ label: `${hour}:00`, value: hour.toString() }))}
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
        {Platform.OS === 'web' ? (
          <>
            <TouchableOpacity
              className="bg-green-600 rounded p-3 flex-1"
              onPress={() => setShowDatePicker(true)}
            >
              <Text className="text-white text-center">{formatDate(date)}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <Modal
                visible={true}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View className="flex-1 justify-center items-center">
                  <View className="bg-white p-4 rounded-lg">
                  <ReactDatePicker
                      selected={date}
                      onChange={handleDateChange}
                      inline
                      minDate={getTurkishDate()}
                      locale={tr}
                      adjustDateOnChange
                    />
                    <TouchableOpacity
                      className="mt-4 bg-green-600 rounded p-2"
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

        <TouchableOpacity
          className="bg-green-600 rounded p-3 flex-1 ml-2"
          onPress={() => setShowTimeModal(true)}
        >
          <Text className="text-white text-center">{time}:00</Text>
        </TouchableOpacity>
      </View>

      {showDatePicker && Platform.OS !== 'web' && (
        <View className="items-center">
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(event, selectedDate) => {
              if (selectedDate) {
                // Seçilen tarihi doğru şekilde işle
                const year = selectedDate.getFullYear();
                const month = selectedDate.getMonth();
                const day = selectedDate.getDate();
                
                const turkishDate = createTurkishDate(year, month, day);
                setDate(turkishDate);
              }
              setShowDatePicker(false);
            }}
            locale="tr-TR"
            minimumDate={getTurkishDate()}
            style={{ width: '100%' }}
          />
        </View>
      )}

      {renderTimeModal()}
    </View>
  );
};