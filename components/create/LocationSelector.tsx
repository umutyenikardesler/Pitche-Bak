import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Dimensions, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import * as Location from 'expo-location';
import SuggestPitchModal from '@/components/pitches/SuggestPitchModal';

interface Province {
  id: number;
  name: string;
}

interface District {
  id: number;
  name: string;
  province_id?: number | null;
}

/** Ters coğrafi kodlamadan gelen il adını liste ile karşılaştırmak için. */
const norm = (v: string) => v.trim().toLocaleLowerCase('tr-TR');

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
  const { colors, isDark } = useAppTheme();
  const [districts, setDistricts] = useState<District[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  // İl tablosu henüz yoksa (migration uygulanmadıysa) eski davranışa dönülür:
  // il adımı gizlenir ve tüm ilçeler listelenir.
  const [provincesAvailable, setProvincesAvailable] = useState(false);
  const [selectedProvince, setSelectedProvince] = useState<number | null>(null);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  // Konumdan bulunan il; modalda en üstte ayrı gösterilir.
  const [detectedProvince, setDetectedProvince] = useState<number | null>(null);
  // Konumla otomatik il seçimi yalnızca bir kez ve kullanıcı seçmediyse yapılır.
  const autoProvinceTriedRef = useRef(false);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  // Sahalar ilçe seçilince ağdan çekiliyor. Boş liste tek başına "bu ilçede
  // saha yok" demek değil: henüz yükleniyor ya da sorgu hata vermiş olabilir.
  // Uyarı yalnızca yükleme BAŞARIYLA bitip liste boş geldiğinde gösterilir.
  const [pitchesLoading, setPitchesLoading] = useState(false);
  const [pitchesError, setPitchesError] = useState(false);
  // Son istenen ilçe. İlçe hızlıca değiştirilirse eski sorgunun yanıtı
  // yenisinin üstüne yazmasın.
  const latestDistrictRef = useRef<string | null>(null);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [showPitchModal, setShowPitchModal] = useState(false);
  const [suggestVisible, setSuggestVisible] = useState(false);

  useEffect(() => {
    fetchDistricts();
  }, []);

  // Saha/ilçe parametreyle geldiyse (ör. sahalar sayfasından) il, ilçeden bulunur.
  useEffect(() => {
    if (!selectedDistrict || districts.length === 0) return;
    const d = districts.find(x => x.id === Number(selectedDistrict));
    if (d?.province_id && d.province_id !== selectedProvince) {
      setSelectedProvince(d.province_id);
    }
  }, [selectedDistrict, districts]);

  // Konuma göre il seçili gelsin.
  useEffect(() => {
    if (!provincesAvailable || provinces.length === 0) return;
    if (autoProvinceTriedRef.current || selectedProvince || selectedDistrict) return;
    autoProvinceTriedRef.current = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!pos) return;
        const [place] = await Location.reverseGeocodeAsync(pos.coords);
        // Türkiye'de il çoğunlukla region, bazı cihazlarda city/subregion olarak gelir.
        for (const candidate of [place?.region, place?.city, place?.subregion]) {
          if (!candidate) continue;
          const hit = provinces.find(p => norm(p.name) === norm(candidate));
          if (hit) {
            setDetectedProvince(hit.id);
            // Kullanıcı bu sırada kendisi seçtiyse ezme.
            setSelectedProvince(prev => prev ?? hit.id);
            return;
          }
        }
      } catch (e) {
        console.warn('Konumdan il seçilemedi:', e);
      }
    })();
  }, [provincesAvailable, provinces, selectedProvince, selectedDistrict]);

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
      latestDistrictRef.current = null;
      setPitches([]);
      setPitchesLoading(false);
      setPitchesError(false);
      return;
    }
    fetchPitches(selectedDistrict);
  }, [selectedDistrict]);


  const fetchDistricts = async () => {
    const [districtRes, provinceRes] = await Promise.all([
      supabase.from('districts').select('*').order('name'),
      supabase.from('provinces').select('id, name').order('name'),
    ]);
    const allDistricts = (districtRes.data ?? []) as District[];
    if (districtRes.data) setDistricts(allDistricts);

    if (!provinceRes.error && provinceRes.data) {
      // Tüm iller listelenir; ilçesi henüz eklenmemiş ilde ilçe listesi boş bir bilgi mesajı gösterir.
      setProvinces(provinceRes.data as Province[]);
      setProvincesAvailable(allDistricts.some(d => d.province_id));
    }
  };

  const visibleDistricts = provincesAvailable
    ? districts.filter(d => d.province_id === selectedProvince)
    : districts;

  const fetchPitches = async (districtId: string) => {
    latestDistrictRef.current = districtId;
    setPitchesLoading(true);
    setPitchesError(false);

    const { data, error } = await supabase
      .from('pitches')
      .select('*')
      .eq('district_id', districtId);

    // Bu arada başka bir ilçe seçildiyse bu yanıt artık geçersiz.
    if (latestDistrictRef.current !== districtId) return;

    if (error) {
      console.error('Veri çekme hatası:', error);
      // Önceki ilçenin sahaları listede kalmasın.
      setPitches([]);
      setPitchesError(true);
    } else {
      setPitches(data as Pitch[]);
    }
    setPitchesLoading(false);
  };

  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  // iPhone 15 gibi cihazlarda (393dp) "küçük ekran" davranışı isteniyor
  const isCompact = screenWidth <= 430;
  const districtModalWidth = isCompact ? '30%' : '40%';
  const pitchModalWidth = isCompact ? '50%' : '60%'; // büyük ekranda max %50

  const renderProvinceModal = () => {
    if (!showProvinceModal) return null;

    const detected = provinces.find(p => p.id === detectedProvince) ?? null;
    const others = provinces
      .filter(p => p.id !== detectedProvince)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));

    // Genişlik en uzun il adına göre: karakter başına ~8px + liste/satır dolguları
    // ve konum ikonu payı. Ekranın %85'ini geçmez.
    const longestName = provinces.reduce((m, p) => Math.max(m, p.name.length), 0);
    const provinceModalWidth = Math.min(screenWidth * 0.85, Math.max(140, longestName * 8 + 48));

    const selectProvince = (item: Province) => {
      if (item.id !== selectedProvince) {
        setSelectedProvince(item.id);
        // İl değişince ilçe, saha ve fiyat sıfırlansın.
        setSelectedDistrict('');
        setSelectedPitch('');
        setPrice('');
      }
      setShowProvinceModal(false);
    };

    return (
      <Modal
        visible={showProvinceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProvinceModal(false)}
      >
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.overlay }}>
          <View
            className="rounded-lg p-4"
            style={{
              backgroundColor: colors.surface,
              width: provinceModalWidth,
              maxHeight: screenHeight * 0.75,
              alignSelf: 'center',
            }}
          >
            <FlatList
              data={others}
              keyExtractor={(item) => item.id.toString()}
              ListHeaderComponent={
                detected ? (
                  <View style={{ borderBottomWidth: 2, borderBottomColor: colors.primary }}>
                    <TouchableOpacity className="p-3 flex-row items-center" onPress={() => selectProvince(detected)}>
                      <Ionicons name="locate" size={16} color={colors.primary} />
                      <Text className="ml-2 font-semibold" style={{ color: colors.text }}>{detected.name}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
              renderItem={({ item }: { item: Province }) => (
                <TouchableOpacity
                  className="p-3"
                  style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={() => selectProvince(item)}
                >
                  <Text style={{ color: colors.text }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              className="mt-4 bg-green-600 rounded p-3"
              onPress={() => setShowProvinceModal(false)}
            >
              <Text className="text-white text-center">{t('general.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderDistrictModal = () => {
    if (!showDistrictModal) return null;

    return (
      <Modal
        visible={showDistrictModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDistrictModal(false)}
      >
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.overlay }}>
          <View
            className="rounded-lg p-4"
            style={{
              backgroundColor: colors.surface,
              width: districtModalWidth,
              minWidth: isCompact ? 0 : 180,
              maxWidth: isCompact ? undefined : 320,
              maxHeight: screenHeight * 0.75,
              alignSelf: 'center',
            }}
          >
            <FlatList
              data={visibleDistricts}
              ListEmptyComponent={
                <Text style={{ color: colors.textSecondary, textAlign: 'center', paddingVertical: 16 }}>
                  {t('create.noDistrictsInProvince')}
                </Text>
              }
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }: { item: District }) => (
                <TouchableOpacity
                  className="p-3"
                  style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={() => {
                    setSelectedDistrict(String(item.id));
                    setShowDistrictModal(false);
                    setSelectedPitch(''); // İlçe değişince seçilen sahayı sıfırla
                    setPrice('');
                  }}
                >
                  <Text style={{ color: colors.text }}>{item.name}</Text>
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
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.overlay }}>
          <View
            className="rounded-lg p-4"
            style={{
              backgroundColor: colors.surface,
              width: pitchModalWidth,
              minWidth: isCompact ? 0 : 240,
              maxWidth: isCompact ? undefined : 420,
              maxHeight: screenHeight * 0.75,
              overflow: 'hidden',
              alignSelf: 'center',
            }}
          >
            <FlatList
              data={pitches as Pitch[]}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }: { item: Pitch }) => (
                <TouchableOpacity
                  className="p-3"
                  style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                  onPress={() => {
                    setSelectedPitch(String(item.id));
                    setPrice(String(item.price)); // Fiyatı state'e kaydet
                    setShowPitchModal(false);
                  }}
                >
                  <Text style={{ color: colors.text }}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                pitchesLoading ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <ActivityIndicator color="#16a34a" />
                  </View>
                ) : (
                  <View
                    style={{
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(245,158,11,0.35)' : '#fde68a',
                      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#fffbeb',
                    }}
                  >
                    <Ionicons name="alert-circle-outline" size={32} color="#f59e0b" />
                    <Text style={{ marginTop: 8, fontWeight: '700', color: colors.text, textAlign: 'center' }}>
                      {pitchesError ? t('general.error') : t('create.noPitchesTitle')}
                    </Text>
                    <Text style={{ marginTop: 4, fontSize: 13, color: colors.textSecondary, textAlign: 'center' }}>
                      {pitchesError ? t('create.pitchesLoadFailed') : t('create.noPitchesMessage')}
                    </Text>
                    {/* Eksigi en iyi burada duran kullanici biliyor: oneriyi tam bu anda istiyoruz. */}
                    {!pitchesError && (
                      <TouchableOpacity
                        onPress={() => {
                          setShowPitchModal(false);
                          setSuggestVisible(true);
                        }}
                        className="flex-row items-center mt-3 px-3 py-2 rounded-lg"
                        style={{ borderWidth: 1, borderColor: colors.primary }}
                      >
                        <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                        <Text className="ml-1 font-semibold" style={{ color: colors.primary }}>
                          {t('suggestPitch.title')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              }
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
      <Text className="font-semibold mb-2" style={{ color: colors.primaryDark }}>{t('create.locationTitle')}</Text>
      {provincesAvailable && (
        <TouchableOpacity
          className="rounded mb-2 p-3"
          onPress={() => setShowProvinceModal(true)}
          style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }}
        >
          <Text style={{ color: selectedProvince ? colors.text : colors.textMuted }}>
            {provinces.find(p => p.id === selectedProvince)?.name || t('create.selectProvincePlaceholder')}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        className="rounded mb-2 p-3"
        onPress={() => {
          if (provincesAvailable && !selectedProvince) return;
          setShowDistrictModal(true);
        }}
        disabled={provincesAvailable && !selectedProvince}
        style={{
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          opacity: provincesAvailable && !selectedProvince ? 0.7 : 1,
        }}
      >
        <Text style={{ color: districtName ? colors.text : colors.textMuted }}>
          {districtName || t('create.selectDistrictPlaceholder')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="rounded mb-2 p-3"
        onPress={() => {
          if (!selectedDistrict) return;
          setShowPitchModal(true);
        }}
        disabled={!selectedDistrict}
        style={{
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          opacity: !selectedDistrict ? 0.7 : 1, // Opaklığı azalt (isteğe bağlı)
        }}
      >
        <Text style={{ color: selectedPitch ? colors.text : colors.textMuted }}>
          {selectedPitch
            ? (pitches.find(p => String(p.id) === selectedPitch)?.name ?? t('create.selectPitchPlaceholder'))
            : t('create.selectPitchPlaceholder')}
        </Text>
      </TouchableOpacity>

      {/* Modallar */}
      {renderProvinceModal()}
      {renderDistrictModal()}
      {renderPitchModal()}

      <Text className="font-semibold mb-2" style={{ color: colors.primaryDark }}>{t('create.priceTitle')}</Text>
      <TextInput
        className="w-full p-3 rounded"
        placeholder={t('create.pricePlaceholder')}
        placeholderTextColor={colors.textMuted}
        value={price ? `${price} ₺` : ""} // State'deki fiyatı göster
        editable={false} // TextInput'u pasif yap
        style={{
          color: colors.primaryDark,
          fontWeight: '600',
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          opacity: !selectedDistrict ? 0.7 : 1, // Opaklığı azalt (isteğe bağlı)
        }} // Fiyatı yeşil yap
      />

      <SuggestPitchModal
        visible={suggestVisible}
        onClose={() => setSuggestVisible(false)}
        initialDistrictId={selectedDistrict ? Number(selectedDistrict) : null}
      />
    </View>
  );
};