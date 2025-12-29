import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ReservationWarningModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ReservationWarningModal({
  visible,
  onClose,
}: ReservationWarningModalProps) {
  const [reservationConfirmed, setReservationConfirmed] = useState(false);

  const handleClose = () => {
    if (reservationConfirmed) {
      setReservationConfirmed(false); // Reset for next time
      onClose();
    } else {
      Alert.alert(
        "Uyarı",
        "Lütfen önce saha rezervasyonu yaptığınızı onaylayın.",
        [{ text: "Tamam" }]
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        // Android geri tuşu ile kapatmayı engelle
        if (!reservationConfirmed) {
          return;
        }
        handleClose();
      }}
    >
      <View className="flex-1 bg-black/70 justify-center items-center px-4">
        <View className="bg-white rounded-lg p-6 w-full max-w-md">
          {/* Başlık */}
          <View className="mb-4">
            <Text className="text-2xl font-bold text-center mb-2 text-red-600">
              ⚠️ ÖNEMLİ UYARI
            </Text>
            <View className="h-1 bg-red-600 rounded-full mb-3"></View>
          </View>

          {/* İçerik */}
          <View className="mb-4">
            <Text className="text-lg font-bold text-green-700 mb-2 text-center">
              📞 Saha Rezervasyonu
            </Text>
            <Text className="text-base text-gray-700 mb-4 text-center">
              Maç oluşturmadan önce <Text className="font-bold text-red-600">mutlaka</Text> sahanın telefon numarasını arayarak rezervasyon yapmanız gerekmektedir.
            </Text>

            <Text className="text-lg font-bold text-blue-700 mb-2 text-center">
              ⚽ Maç Oluşturma
            </Text>
            <Text className="text-base text-gray-700 mb-4 text-center">
              Rezervasyon yaptıktan sonra maçınızı oluşturabilir ve eksik pozisyonları belirleyebilirsiniz.
            </Text>
          </View>

          {/* Checkbox */}
          <TouchableOpacity
            onPress={() => setReservationConfirmed(!reservationConfirmed)}
            className="flex-row items-center justify-center mb-4 p-3 bg-gray-50 rounded-lg"
            activeOpacity={0.7}
          >
            <View className={`w-6 h-6 border-2 rounded mr-3 items-center justify-center ${
              reservationConfirmed ? 'bg-green-600 border-green-600' : 'border-gray-400'
            }`}>
              {reservationConfirmed && (
                <Ionicons name="checkmark" size={18} color="#fff" />
              )}
            </View>
            <Text className="flex-1 text-base font-semibold text-gray-800 text-center">
              Öncelikle Sahayı Rezerve Et ardından Maçı Oluştur
            </Text>
          </TouchableOpacity>

          {/* Tamam Butonu */}
          <TouchableOpacity
            onPress={handleClose}
            className={`py-3 rounded-md ${
              reservationConfirmed ? 'bg-green-600' : 'bg-gray-400'
            }`}
            disabled={!reservationConfirmed}
          >
            <Text className="text-white font-bold text-center text-lg">
              Tamam
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

