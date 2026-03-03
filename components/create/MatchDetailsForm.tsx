import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, FlatList, Dimensions, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { tr, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';
import '@/global.css';

interface MatchDetailsFormProps {
  date: Date;
  setDate: (date: Date) => void;
  time: string;
  setTime: (time: string) => void;
}

export const MatchDetailsForm: React.FC<MatchDetailsFormProps> = ({ date, setDate, time, setTime }) => {
  const { t, currentLanguage } = useLanguage();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const screenHeight = Dimensions.get('window').height;

  // Dinamik saat dilimine göre bugünü hesapla
  const getCurrentDate = (d = new Date()) => {
    // Yerel saat dilimini UTC'ye çevir, sonra Türkiye saatine (UTC+3) çevir
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utcTime + (3 * 3600000)); // UTC+3
  };

  // Seçilen tarihi doğru şekilde işlemek için yeni fonksiyon
  const createCurrentDate = (year: number, month: number, day: number) => {
    // Yerel saat diliminde yeni bir tarih oluştur
    const localDate = new Date(year, month, day);
    // UTC'ye çevir
    const utcTime = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);
    // Türkiye saatine çevir
    return new Date(utcTime + (3 * 3600000));
  };

  // Zamanın ilerlemesiyle (ör. 22:59 -> 23:00) min seçim kurallarının otomatik güncellenmesi için
  const [now, setNow] = useState(() => getCurrentDate());
  useEffect(() => {
    const id = setInterval(() => setNow(getCurrentDate()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  const isSameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  const dayStamp = (d: Date) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

  // Şu anki saate göre "en erken seçilebilir" slot: her zaman bir sonraki saat (00:00'a taşarsa tarih +1)
  const getNextHourSlot = (d: Date) => {
    const slot = new Date(d);
    slot.setMinutes(0, 0, 0);
    slot.setHours(slot.getHours() + 1); // her zaman bir sonraki saat
    return slot;
  };

  const nextSlot = getNextHourSlot(now);
  const minSelectableDay = createCurrentDate(nextSlot.getFullYear(), nextSlot.getMonth(), nextSlot.getDate());
  const minSelectableHour = nextSlot.getHours(); // 0-23
  const minCalendarDay = new Date(minSelectableDay.getFullYear(), minSelectableDay.getMonth(), minSelectableDay.getDate());

  const isMinDay = isSameDay(date, minSelectableDay);
  const availableHours = Array.from({ length: 24 }, (_, i) => i).filter(hour => {
    if (isMinDay) return hour >= minSelectableHour;
    return dayStamp(date) > dayStamp(minSelectableDay); // yarın ve sonrası: 0-23
  });

  // Tarih/saat tutarlılığını koru:
  // - Eğer bugün artık seçilemiyorsa (örn 23:xx), tarihi otomatik yarına al
  // - Seçilen gün min gün ise saati min saatten küçük seçtirme
  useEffect(() => {
    // Eğer önceki state'ten 24 gibi geçersiz bir değer geldiyse toparla
    const numericTime = Number(time);
    if (!Number.isNaN(numericTime) && numericTime >= 24) {
      setTime("0");
    }

    if (dayStamp(date) < dayStamp(minSelectableDay)) {
      setDate(minSelectableDay);
      setTime(minSelectableHour.toString());
      return;
    }

    if (isMinDay && Number(time) < minSelectableHour) {
      setTime(minSelectableHour.toString());
    }
  }, [date, time, dayStamp(minSelectableDay), minSelectableHour]);

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
      
      const currentDate = createCurrentDate(year, month, day);
      // Eğer artık bugünde saat seçilemiyorsa, minSelectableDay'e snap'le
      if (dayStamp(currentDate) < dayStamp(minSelectableDay)) {
        setDate(minSelectableDay);
        setTime(minSelectableHour.toString());
      } else {
        setDate(currentDate);
        // Min gün seçildiyse saat en az minSelectableHour olmalı
        if (isSameDay(currentDate, minSelectableDay) && Number(time) < minSelectableHour) {
          setTime(minSelectableHour.toString());
        }
      }
    }
    setShowDatePicker(false);
  };

  const renderTimeModal = () => (
    <Modal
      visible={showTimeModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowTimeModal(false)}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View className="w-50 bg-white rounded-lg p-4" style={{ maxHeight: screenHeight * 0.75 }}>
          <FlatList
            data={availableHours.map(hour => ({ label: `${String(hour).padStart(2, '0')}:00`, value: hour.toString() }))}
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
            <Text className="text-white text-center">{t('general.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View className="mb-4">
              <Text className="text-green-700 font-semibold mb-2">{t('create.dateTimeTitle')}</Text>
      <View className="flex flex-row">
        {Platform.OS === 'web' ? (
          <>
            <TouchableOpacity
              className="bg-green-600 rounded p-3 flex-1"
              onPress={() => setShowDatePicker(true)}
            >
              <Text className="text-white font-semibold text-center">{formatDate(date)}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <Modal
                visible={true}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
              >
                <View className="flex-1 justify-center items-center bg-black/50">
                  <View className="bg-white p-4 rounded-lg">
                              <ReactDatePicker
              selected={date}
              onChange={handleDateChange}
              inline
              minDate={minCalendarDay}
              locale={currentLanguage === 'tr' ? tr : enUS}
              adjustDateOnChange
              calendarClassName={`date-picker-calendar date-picker-calendar-${currentLanguage}`}
              data-lang={currentLanguage}
              showMonthDropdown={true}
              showYearDropdown={true}
              dropdownMode="select"
              dateFormat={currentLanguage === 'tr' ? 'dd/MM/yyyy' : 'MM/dd/yyyy'}
            />
                    <TouchableOpacity
                      className="mt-4 bg-green-600 rounded p-2"
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text className="text-white text-center">{t('general.close')}</Text>
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
            <Text className="text-white font-semibold text-center">{formatDate(date)}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          className="bg-green-600 rounded p-3 flex-1 ml-2"
          onPress={() => setShowTimeModal(true)}
        >
          <Text className="text-white font-semibold text-center">{String(time).padStart(2, '0')}:00</Text>
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
                
                const currentDate = createCurrentDate(year, month, day);
                if (dayStamp(currentDate) < dayStamp(minSelectableDay)) {
                  setDate(minSelectableDay);
                  setTime(minSelectableHour.toString());
                } else {
                  setDate(currentDate);
                  if (isSameDay(currentDate, minSelectableDay) && Number(time) < minSelectableHour) {
                    setTime(minSelectableHour.toString());
                  }
                }
              }
              setShowDatePicker(false);
            }}
                          locale={currentLanguage === 'tr' ? 'tr-TR' : 'en-US'}
                            minimumDate={minCalendarDay}
            style={{ width: '100%' }}
          />
        </View>
      )}

      {renderTimeModal()}
    </View>
  );
};