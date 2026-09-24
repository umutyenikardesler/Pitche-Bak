import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchDistricts, type District } from '@/services/pitches';
import PitchLocationPicker from '@/components/maps/PitchLocationPicker';

/**
 * Sahalarda sık geçen özellikler. Saha detayında olduğu gibi gösterildikleri
 * için değerler Türkçe: mevcut kayıtlar da bu biçimde.
 */
const FEATURE_PRESETS = [
  'Kapalı Saha',
  'Duş',
  'Soyunma Odası',
  'Otopark',
  'Kafeterya',
  'Ayakkabı Kiralama',
  'Eldiven Kiralama',
  'Forma Kiralama',
  'Tribün',
  'Aydınlatma',
  'Kale Filesi',
];

/** Form değerlerini veritabanı satırına çevirir. */
export function toPitchInput(values: PitchFormValues) {
  return {
    name: values.name,
    district_id: values.districtId as number,
    address: values.address,
    phone: values.phone,
    price: values.price ? Number(values.price) : null,
    features: values.features,
    latitude: values.latitude as number,
    longitude: values.longitude as number,
  };
}

/** Türkiye cep telefonu: 11 hane. */
const PHONE_MAX_DIGITS = 11;

/** Ücret alanının yazı boyu; görünmez ölçüm kopyasıyla aynı olmak zorunda. */
const PRICE_FONT_SIZE = 16;

/** Saatlik ücret dört haneyi geçmiyor (bin-onbin TL aralığı). */
const PRICE_MAX_DIGITS = 4;

/** "05322226935" -> "0532 222 69 35". Eksik haneyle de çalışır. */
function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  // Numara alan koduyla yazılırsa (532...) baştaki sıfır kendiliğinden eklensin.
  if (digits && digits[0] !== '0') digits = '0' + digits;
  digits = digits.slice(0, PHONE_MAX_DIGITS);
  const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)];
  return parts.filter(Boolean).join(' ');
}

/** Ters coğrafi kodlamadan gelen adı ilçe listesiyle eşleştirir. */
function matchDistrict(districts: District[], candidates: (string | null | undefined)[]) {
  const norm = (v: string) => v.trim().toLocaleLowerCase('tr-TR');
  for (const candidate of candidates) {
    if (!candidate) continue;
    const hit = districts.find((d) => norm(d.name) === norm(candidate));
    if (hit) return hit;
  }
  return null;
}

export type PitchFormValues = {
  name: string;
  districtId: number | null;
  address: string;
  phone: string;
  price: string;
  features: string[];
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  /** admin: koordinat zorunlu. suggestion: konum isteğe bağlı, not alanı var. */
  variant: 'admin' | 'suggestion';
  initial?: Partial<PitchFormValues>;
  submitting?: boolean;
  submitLabel: string;
  onSubmit: (values: PitchFormValues) => void | Promise<void>;
};

const EMPTY: PitchFormValues = {
  name: '',
  districtId: null,
  address: '',
  phone: '',
  price: '',
  features: [],
  latitude: null,
  longitude: null,
};

export default function PitchForm({
  variant,
  initial,
  submitting = false,
  submitLabel,
  onSubmit,
}: Props) {
  const { colors } = useAppTheme();
  const { t } = useLanguage();

  const [values, setValues] = useState<PitchFormValues>({ ...EMPTY, ...initial });
  const [districts, setDistricts] = useState<District[]>([]);
  const [districtPickerOpen, setDistrictPickerOpen] = useState(false);
  const [districtQuery, setDistrictQuery] = useState('');
  const [locating, setLocating] = useState(false);
  // Ücret alanı yazının genişliği kadar daralıyor ki ₺ rakamın hemen sağında dursun.
  const priceInputRef = useRef<TextInput | null>(null);
  // Kutunun genişliği ANLIK yazılan rakama göre değil, EN GENİŞ olası değere
  // (4 hane) göre bir kez ölçülüyor. Anlık ölçüm her tuş vuruşunda kutuyu
  // büyütüyordu; Android'de yerleşim hesabı bir kare geriden geldiği için
  // kutu henüz eski (dar) genişlikteyken yeni karakter çiziliyor ve ilk
  // karakter kırpılıyordu. Sabit genişlik yazarken hiç büyümediği için bu
  // yarışı tamamen ortadan kaldırıyor.
  const [priceMaxWidth, setPriceMaxWidth] = useState(0);
  // Kullanıcı adresi elle yazdıysa bir daha otomatik doldurulmuyor/değiştirilmiyor.
  const addressEditedRef = useRef(false);

  const isAdmin = variant === 'admin';

  useEffect(() => {
    fetchDistricts().then(setDistricts);
  }, []);

  // Dışarıdan yeni başlangıç değeri gelince (ör. bir öneriyi düzenlemeye açmak).
  useEffect(() => {
    if (initial) setValues((prev) => ({ ...prev, ...initial }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.name, initial?.districtId, initial?.latitude, initial?.longitude]);

  const set = <K extends keyof PitchFormValues>(key: K, value: PitchFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const districtName = useMemo(
    () => districts.find((d) => d.id === values.districtId)?.name ?? '',
    [districts, values.districtId]
  );

  const filteredDistricts = useMemo(() => {
    const q = districtQuery.trim().toLocaleLowerCase('tr-TR');
    if (!q) return districts;
    return districts.filter((d) => d.name.toLocaleLowerCase('tr-TR').includes(q));
  }, [districts, districtQuery]);

  /**
   * Konum için adresi çözüp uygular. Kullanıcı adresi elle yazdıysa dokunmaz:
   * aksi halde iğneyi sürükleyince kullanıcının kendi yazdığı adres sessizce
   * ezilirdi.
   */
  const applyAddressForCoords = async (coords: { latitude: number; longitude: number }) => {
    if (addressEditedRef.current) return;
    try {
      const [place] = await Location.reverseGeocodeAsync(coords);
      const line = [place?.street, place?.streetNumber, place?.district, place?.subregion]
        .filter(Boolean)
        .join(' ');
      if (line && !addressEditedRef.current) set('address', line);
    } catch {
      // Adres bulunamadıysa sorun değil; alan elle doldurulabilir.
    }
  };

  /**
   * Haritada iğne sürüklenince/tıklanınca çağrılır. Konum (enlem/boylam) ile
   * adres metni AYRI alanlar; iğne taşınıp adres güncellenmezse ikisi
   * birbirinden kopuyor ve kaydedilen konum, gösterilen adresle uyuşmuyordu.
   */
  const handleLocationChange = (coords: { latitude: number; longitude: number }) => {
    setValues((prev) => ({ ...prev, latitude: coords.latitude, longitude: coords.longitude }));
    applyAddressForCoords(coords);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('pitchForm.locationTitle'), t('pitchForm.locationDenied'));
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      setValues((prev) => ({ ...prev, latitude: coords.latitude, longitude: coords.longitude }));

      try {
        const [place] = await Location.reverseGeocodeAsync(coords);

        // İlçe: konumu alan kişi zaten o ilçede duruyor, elle seçtirmeyelim.
        // subregion Türkiye'de ilçeye denk geliyor; city bazı cihazlarda aynısını veriyor.
        const district = matchDistrict(districts, [place?.subregion, place?.city, place?.district]);
        if (district) set('districtId', district.id);
      } catch {
        // İlçe bulunamadıysa sorun değil; elle seçilebilir.
      }
      await applyAddressForCoords(coords);
    } catch (e) {
      console.log('[Saha formu] konum alınamadı:', e);
      Alert.alert(t('pitchForm.locationTitle'), t('pitchForm.locationFailed'));
    } finally {
      setLocating(false);
    }
  };

  const toggleFeature = (feature: string) =>
    setValues((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));

  const handleSubmit = () => {
    if (!values.name.trim()) {
      Alert.alert(t('pitchForm.missingTitle'), t('pitchForm.missingName'));
      return;
    }
    if (!values.districtId) {
      Alert.alert(t('pitchForm.missingTitle'), t('pitchForm.missingDistrict'));
      return;
    }
    if (values.latitude == null || values.longitude == null) {
      Alert.alert(t('pitchForm.missingTitle'), t('pitchForm.missingLocation'));
      return;
    }
    // Adres/telefon/ücret yalnızca öneri formunda zorunlu: admin sahadayken
    // hızlı ekleme için bunları boş bırakabiliyor.
    if (!isAdmin) {
      if (!values.address.trim()) {
        Alert.alert(t('pitchForm.missingTitle'), t('pitchForm.missingAddress'));
        return;
      }
      if (values.phone.replace(/\D/g, '').length < PHONE_MAX_DIGITS) {
        Alert.alert(t('pitchForm.missingTitle'), t('pitchForm.missingPhone'));
        return;
      }
      if (!values.price) {
        Alert.alert(t('pitchForm.missingTitle'), t('pitchForm.missingPrice'));
        return;
      }
      if (values.features.length === 0) {
        Alert.alert(t('pitchForm.missingTitle'), t('pitchForm.missingFeatures'));
        return;
      }
    }
    onSubmit(values);
  };

  const inputStyle = {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const;

  // Alan başlıkları uygulamanın yeşili; altlarında az boşluk.
  const label = (text: string, required = false) => (
    <Text style={{ color: colors.primaryDark, fontWeight: '600', marginBottom: 6 }}>
      {text}
      {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
    </Text>
  );

  const hasCoords = values.latitude != null && values.longitude != null;

  return (
    <View>
      {/* Saha adı */}
      <View className="mb-3">
        {label(t('pitchForm.name'), true)}
        <TextInput
          value={values.name}
          onChangeText={(v) => set('name', v)}
          placeholder={t('pitchForm.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
          style={inputStyle}
        />
      </View>

      {/* İlçe */}
      <View className="mb-3">
        {label(t('pitchForm.district'), true)}
        <TouchableOpacity
          onPress={() => setDistrictPickerOpen(true)}
          style={[
            inputStyle,
            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
          ]}
        >
          <Text style={{ color: districtName ? colors.text : colors.textMuted }}>
            {districtName || t('pitchForm.districtPlaceholder')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Konum */}
      <View className="mb-3">
        {label(t('pitchForm.location'), true)}
        <TouchableOpacity
          onPress={useMyLocation}
          disabled={locating}
          className="flex-row items-center justify-center rounded-lg px-3 py-2 mb-2"
          style={{ backgroundColor: colors.primary, opacity: locating ? 0.6 : 1 }}
        >
          {locating ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons name="locate-outline" size={18} color="white" />
          )}
          <Text className="text-white font-semibold ml-2">{t('pitchForm.useMyLocation')}</Text>
        </TouchableOpacity>

        {hasCoords ? (
          <>
            <PitchLocationPicker
              latitude={values.latitude as number}
              longitude={values.longitude as number}
              onChange={handleLocationChange}
            />
            <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
              {t('pitchForm.locationHint')} ({(values.latitude as number).toFixed(6)},{' '}
              {(values.longitude as number).toFixed(6)})
            </Text>
          </>
        ) : (
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            {t('pitchForm.locationEmpty')}
          </Text>
        )}
      </View>

      {/* Adres */}
      <View className="mb-3">
        {label(t('pitchForm.address'), !isAdmin)}
        <TextInput
          value={values.address}
          onChangeText={(v) => {
            addressEditedRef.current = true;
            set('address', v);
          }}
          placeholder={t('pitchForm.addressPlaceholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          style={[inputStyle, { minHeight: 60, textAlignVertical: 'top' }]}
        />
      </View>

      {/* Telefon + ücret */}
      <View className="flex-row mb-3">
        <View className="flex-1 mr-2">
          {label(t('pitchForm.phone'), !isAdmin)}
          <TextInput
            value={values.phone}
            onChangeText={(v) => set('phone', formatPhone(v))}
            // Alan boşken odaklanınca "05" hazır gelsin; gerisini kullanıcı yazıyor.
            onFocus={() => {
              if (!values.phone) set('phone', '05');
            }}
            placeholder="05xx xxx xx xx"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            // 11 hane + 3 boşluk: daha fazlası yazılamıyor.
            maxLength={PHONE_MAX_DIGITS + 3}
            style={inputStyle}
          />
        </View>
        <View className="flex-1 ml-2">
          {label(t('pitchForm.price'), !isAdmin)}
          {/* ₺ metnin parçası değil, ayrı bir Text: TextInput içindeki yazının
              bir kısmını farklı renklendirmek mümkün değil. Böylece geri tuşu da
              doğal çalışıyor, state'te yalnızca rakamlar duruyor.
              Input, yazının ölçülen genişliği kadar daraltılıyor; yoksa tüm
              genişliği kaplayıp ₺'yi alanın sağ kenarına itiyordu. Boş alanına
              dokunulduğunda da odaklansın diye satır Pressable. */}
          <Pressable
            onPress={() => priceInputRef.current?.focus()}
            style={[inputStyle, { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}
          >
            <TextInput
              ref={priceInputRef}
              value={values.price}
              onChangeText={(v) => set('price', v.replace(/[^0-9]/g, ''))}
              placeholder="₺"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={PRICE_MAX_DIGITS}
              style={{
                width: values.price ? priceMaxWidth : '100%',
                color: colors.text,
                fontSize: PRICE_FONT_SIZE,
                paddingVertical: 10,
              }}
            />
            {!!values.price && (
              <Text
                style={{
                  color: colors.primaryDark,
                  fontWeight: '700',
                  fontSize: PRICE_FONT_SIZE,
                  marginLeft: 3,
                }}
              >
                ₺
              </Text>
            )}
            {/* Yalnızca ölçüm için; yerleşimi etkilemiyor. Sabit "0000" ile
                ölçülüyor (PRICE_MAX_DIGITS haneli en geniş durum), anlık
                değerle değil -- bkz. priceMaxWidth. Android'de biraz fazladan
                pay bırakılıyor: EditText'in kendi iç dolgusu Text ile birebir
                aynı ölçülmüyor. */}
            <Text
              pointerEvents="none"
              style={{ position: 'absolute', opacity: 0, fontSize: PRICE_FONT_SIZE }}
              onLayout={(e) =>
                setPriceMaxWidth(
                  e.nativeEvent.layout.width + (Platform.OS === 'android' ? 6 : 2)
                )
              }
            >
              {'0'.repeat(PRICE_MAX_DIGITS)}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Özellikler: seçmeli. Seçili olanlar sahaya aynen yazılıyor. */}
      <View className="mb-3">
        {label(t('pitchForm.features'), !isAdmin)}
        <View className="flex-row flex-wrap">
          {FEATURE_PRESETS.map((feature) => {
            const active = values.features.includes(feature);
            return (
              <Pressable
                key={feature}
                onPress={() => toggleFeature(feature)}
                // TouchableOpacity DEĞİL: çocuklarını yerel sürücüyle
                // animasyonlanan bir Animated.View'a sarıyor ve seçilen çip
                // ancak bir sonraki render'da renk değiştiriyordu. Stil de
                // tamamen satır içi; className ile dinamik style karışımı
                // NativeWind'de aynı gecikmeyi yaratıyor.
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  marginRight: 8,
                  marginBottom: 8,
                  backgroundColor: active ? colors.primary : colors.surfaceAlt,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                {active && (
                  <Ionicons name="checkmark" size={14} color="white" style={{ marginRight: 4 }} />
                )}
                <Text style={{ color: active ? 'white' : colors.textSecondary }}>{feature}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        className="rounded-lg py-3 items-center mt-1"
        style={{ backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-semibold text-base">{submitLabel}</Text>
        )}
      </TouchableOpacity>

      {/* İlçe seçici */}
      <Modal visible={districtPickerOpen} transparent animationType="slide">
        {/* Klavye açılınca liste ve arama kutusu klavyenin arkasında kalıyordu. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}
        >
          <View
            className="rounded-t-2xl p-4"
            style={{ backgroundColor: colors.surface, maxHeight: '75%' }}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold" style={{ color: colors.text }}>
                {t('pitchForm.districtPlaceholder')}
              </Text>
              <TouchableOpacity onPress={() => setDistrictPickerOpen(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={districtQuery}
              onChangeText={setDistrictQuery}
              placeholder={t('pitchForm.districtSearch')}
              placeholderTextColor={colors.textMuted}
              style={[inputStyle, { marginBottom: 10 }]}
            />

            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              {filteredDistricts.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  onPress={() => {
                    set('districtId', d.id);
                    setDistrictPickerOpen(false);
                    setDistrictQuery('');
                  }}
                  className="py-3 px-2 rounded-lg"
                  style={{
                    backgroundColor:
                      values.districtId === d.id ? colors.surfaceAlt : 'transparent',
                  }}
                >
                  <Text style={{ color: colors.text }}>{d.name}</Text>
                </TouchableOpacity>
              ))}
              {filteredDistricts.length === 0 && (
                <Text className="text-center py-4" style={{ color: colors.textMuted }}>
                  {t('pitchForm.districtNotFound')}
                </Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
