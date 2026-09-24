import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import PitchForm, { type PitchFormValues } from '@/components/pitches/PitchForm';
import { createPitchSuggestion } from '@/services/pitches';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Önceden seçili ilçe (ör. "bu ilçede saha yok" uyarısından gelindiyse). */
  initialDistrictId?: number | null;
};

/**
 * Kullanıcının eksik sahayı bildirmesi. Öneri doğrudan listeye girmiyor,
 * admin onayına düşüyor: saha listesi maçların ve mesafe sıralamasının dayandığı
 * ana veri, denetimsiz büyümemeli.
 */
/** Klavye ile içerik arasında bırakılan pay. */
const KEYBOARD_GAP = 10;

export default function SuggestPitchModal({ visible, onClose, initialDistrictId }: Props) {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modalın gövdesi klavye kadar kısaltılıyor: içerik bütünüyle klavyenin
  // üstünde kalıyor, gönder butonu dahil.
  const keyboardHeight = useKeyboardHeight();

  // Klavye açılınca listeyi sona kaydır: gönder butonu görünür olsun.
  useEffect(() => {
    if (!keyboardHeight) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [keyboardHeight]);

  // Tam ekran modal durum çubuğunun altına da uzanıyor: başlık, Dynamic Island
  // ve çentiğin arkasında kalmasın diye güvenli alan kadar aşağı itiliyor.
  const safeTop = Platform.OS === 'web' ? 0 : insets.top;

  const submit = async (values: PitchFormValues) => {
    setSubmitting(true);
    try {
      const { error } = await createPitchSuggestion({
        name: values.name,
        district_id: values.districtId as number,
        address: values.address,
        phone: values.phone,
        price: values.price ? Number(values.price) : null,
        features: values.features,
        latitude: values.latitude,
        longitude: values.longitude,
      });

      if (error) {
        Alert.alert(t('suggestPitch.failedTitle'), error.message);
        return;
      }

      onClose();
      Alert.alert(t('suggestPitch.thanksTitle'), t('suggestPitch.thanksBody'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // presentationStyle="overFullScreen": varsayılan "fullScreen" iOS'ta modal
    // için AYRI bir native pencere açıyor. O pencere kapanırken kök
    // SafeAreaProvider'ın hesabı bozuluyor ve TÜM UYGULAMADA header/içerik
    // kalıcı olarak yukarı kayıyor (react-native-safe-area-context'te bilinen
    // bir iOS arızası). "overFullScreen" sunan ekranı hiyerarşiden çıkarmadığı
    // için bu arızaya yol açmıyor; arka planı zaten opak olduğu için görünüm
    // aynı kalıyor.
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {/* Stiller satır içi: className ile dinamik style birlikte verildiğinde
          NativeWind birleşimi geriden uyguluyor ve klavye payı hiç işlemiyordu
          (özellik çiplerinde de aynı sorun yaşandı). */}
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          // Klavyenin tam üstüne yapışmasın: odaklanılan alanın alt çerçevesi
          // klavyeyle aynı hizaya geliyordu.
          paddingBottom: keyboardHeight ? keyboardHeight + KEYBOARD_GAP : 0,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingBottom: 12,
            backgroundColor: colors.primary,
            paddingTop: safeTop + 12,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>
            {t('suggestPitch.title')}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color="white" />
          </TouchableOpacity>
        </View>

        {/* Gövde zaten klavye kadar kısaldığı için ScrollView'in kendi klavye
            payı kullanılmıyor; ikisi birlikte olunca içerik iki kez kayıyor.
            Sürükleyince klavye kapanıyor. */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        >
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
            {t('suggestPitch.intro')}
          </Text>

          <PitchForm
            variant="suggestion"
            submitting={submitting}
            submitLabel={t('suggestPitch.submit')}
            initial={initialDistrictId ? { districtId: initialDistrictId } : undefined}
            onSubmit={submit}
          />

        </ScrollView>
      </View>
    </Modal>
  );
}
