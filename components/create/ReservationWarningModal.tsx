import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';

interface ReservationWarningModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ReservationWarningModal({
  visible,
  onClose,
}: ReservationWarningModalProps) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const [reservationConfirmed, setReservationConfirmed] = useState(false);

  const handleClose = () => {
    if (reservationConfirmed) {
      setReservationConfirmed(false); // Reset for next time
      onClose();
    } else {
      Alert.alert(
        t('create.reservationWarning.alertTitle'),
        t('create.reservationWarning.alertMessage'),
        [{ text: t('general.ok') }]
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
      <View className="flex-1 justify-center items-center px-4" style={{ backgroundColor: colors.overlay }}>
        <View
          className="rounded-lg p-6 w-full max-w-md"
          style={{
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.primary,
            shadowColor: colors.primary,
            shadowOpacity: 0.8,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
            elevation: 8,
          }}
        >
          {/* Başlık */}
          <View className="mb-4">
            <Text className="text-2xl font-bold text-center mb-2" style={{ color: colors.danger }}>
              {t('create.reservationWarning.title')}
            </Text>
            <View className="h-1 rounded-full mb-3" style={{ backgroundColor: colors.danger }}></View>
          </View>

          {/* İçerik */}
          <View className="mb-4">
            <Text className="text-lg font-bold mb-2 text-center" style={{ color: colors.primaryDark }}>
              {t('create.reservationWarning.reservationTitle')}
            </Text>
            <Text className="text-base mb-4 text-center" style={{ color: colors.text }}>
              {t('create.reservationWarning.reservationTextPrefix')}{' '}
              <Text className="font-bold" style={{ color: colors.danger }}>{t('create.reservationWarning.reservationTextEmphasis')}</Text>{' '}
              {t('create.reservationWarning.reservationTextSuffix')}
            </Text>

            <Text className="text-lg font-bold mb-2 text-center" style={{ color: colors.primary }}>
              {t('create.reservationWarning.createTitle')}
            </Text>
            <Text className="text-base mb-4 text-center" style={{ color: colors.text }}>
              {t('create.reservationWarning.createText')}
            </Text>
          </View>

          {/* Checkbox */}
          <TouchableOpacity
            onPress={() => setReservationConfirmed(!reservationConfirmed)}
            className="flex-row items-center justify-center mb-4 p-3 rounded-lg"
            style={{ backgroundColor: colors.surfaceAlt }}
            activeOpacity={0.7}
          >
            <View
              className="w-6 h-6 border-2 rounded mr-3 items-center justify-center"
              style={{
                backgroundColor: reservationConfirmed ? colors.primary : 'transparent',
                borderColor: reservationConfirmed ? colors.primary : colors.inputBorder,
              }}
            >
              {reservationConfirmed && (
                <Ionicons name="checkmark" size={18} color="#fff" />
              )}
            </View>
            <Text className="flex-1 text-base font-semibold text-center" style={{ color: colors.text }}>
              {t('create.reservationWarning.checkboxText')}
            </Text>
          </TouchableOpacity>

          {/* Tamam Butonu */}
          <TouchableOpacity
            onPress={handleClose}
            className="py-3 rounded-md"
            style={{
              backgroundColor: reservationConfirmed ? colors.primary : colors.inputBorder,
              opacity: reservationConfirmed ? 1 : 0.7,
            }}
            disabled={!reservationConfirmed}
          >
            <Text className="font-bold text-center text-lg" style={{ color: colors.whiteText }}>
              {t('general.ok')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

