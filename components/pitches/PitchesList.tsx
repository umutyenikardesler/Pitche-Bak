import { FlatList, RefreshControl, ScrollView, Text, TouchableOpacity, View, Platform, Linking, Modal, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PitchMap from "@/components/maps/PitchMap";
import { useRouter } from "expo-router";
import { supabase } from '@/services/supabase';
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestAuthAlert } from "@/contexts/GuestAuthModalContext";
import { FontAwesome } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect, useState } from 'react';

export default function PitchesList({ pitches, selectedPitch, setSelectedPitch, handleCloseDetail, refreshing, onRefresh, onPriceUpdated }: any) {
  const { t } = useLanguage();
  const { isGuest } = useAuth();
  const { showGuestAuthAlert } = useGuestAuthAlert();
  const router = useRouter();

  const [mapChooserVisible, setMapChooserVisible] = useState(false);
  const [availableMaps, setAvailableMaps] = useState<{ google: boolean; waze: boolean }>({ google: false, waze: false });
  const [priceInfoVisible, setPriceInfoVisible] = useState(false);
  const [priceEditVisible, setPriceEditVisible] = useState(false);
  const [editPriceValue, setEditPriceValue] = useState('');
  const [priceUpdating, setPriceUpdating] = useState(false);

  // Yanıp sönme - opacity ile (layout etkilemez)
  const pulseOpacity = useSharedValue(1);
  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withTiming(0.65, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));


  const showMapChooser = async () => {
    try {
      const [hasGoogle, hasWaze] = await Promise.all([
        Linking.canOpenURL(Platform.OS === 'ios' ? 'comgooglemaps://' : 'geo:0,0?q='),
        Linking.canOpenURL('waze://'),
      ]);
      setAvailableMaps({ google: !!hasGoogle, waze: !!hasWaze });
    } catch (e) {
      setAvailableMaps({ google: false, waze: false });
    }
    setMapChooserVisible(true);
  };

  const openInAppleMaps = () => {
    if (!selectedPitch) return;
    const lat = selectedPitch.latitude;
    const lng = selectedPitch.longitude;
    const label = encodeURIComponent(selectedPitch.name || 'Konum');
    const url = `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
    Linking.openURL(url);
    setMapChooserVisible(false);
  };

  const openInGoogleMaps = () => {
    if (!selectedPitch) return;
    const lat = selectedPitch.latitude;
    const lng = selectedPitch.longitude;
    const label = encodeURIComponent(selectedPitch.name || 'Konum');
    let url = '';
    if (Platform.OS === 'ios') {
      url = `comgooglemaps://?q=${lat},${lng}(${label})`;
    } else {
      url = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    }
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
    });
    setMapChooserVisible(false);
  };

  const openInWaze = () => {
    if (!selectedPitch) return;
    const lat = selectedPitch.latitude;
    const lng = selectedPitch.longitude;
    const url = `waze://?ll=${lat},${lng}&navigate=yes`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
    });
    setMapChooserVisible(false);
  };

  // Statik stil - sürekli withRepeat layout titremede sebep oluyordu


  const handleSelectPitch = async (pitchId: string) => {
    // Misafir: Create sayfasına gitmeden önce uyarı göster, giriş sayfasına yönlendir
    if (isGuest) {
      showGuestAuthAlert(t('auth.guestCreateMatch'));
      return;
    }

    const { data, error } = await supabase
      .from("pitches")
      .select("id, district_id, name, price, district:districts(name)")
      .eq("id", pitchId)
      .single();

    if (error) {
      console.error("❌ Saha verisi alınamadı:", error);
      return;
    }

    const districtName = (data as any)?.district?.name ?? '';

    router.push({
      pathname: "/create",
      params: {
        pitchId: data.id,
        district: data.district_id,
        districtName,
        name: data.name,
        price: data.price,
        shouldSetFields: "true"
      },
    });
  };

  const featuresArray = selectedPitch?.features || [];
  const pitchPhone = selectedPitch?.phone || '';
  const hasPhone = !!pitchPhone;

  const openPriceEdit = () => {
    if (isGuest) return;
    setEditPriceValue(String(selectedPitch?.price ?? ''));
    setPriceEditVisible(true);
  };

  const handleSavePrice = async () => {
    if (isGuest) {
      setPriceEditVisible(false);
      return;
    }
    const num = parseInt(editPriceValue.replace(/\D/g, ''), 10);
    if (isNaN(num) || num < 0) {
      Alert.alert('', t('pitches.priceInvalid'));
      return;
    }
    if (!selectedPitch?.id) return;
    setPriceUpdating(true);
    const { error } = await supabase.from('pitches').update({ price: num }).eq('id', selectedPitch.id);
    setPriceUpdating(false);
    setPriceEditVisible(false);
    if (!error && onPriceUpdated) {
      onPriceUpdated(selectedPitch.id, num);
    } else if (error) {
      Alert.alert(t('general.error'), error.message || t('pitches.priceUpdateFailed'));
    }
  };

  if (selectedPitch) {
    return (
      <View style={{ flex: 1, overflow: 'visible' }}>
        <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingBottom: Platform.OS === 'android' ? 50 : 0,
              }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              scrollEnabled={true}
              keyboardShouldPersistTaps="handled"
              removeClippedSubviews={false}
              scrollEventThrottle={16}
              decelerationRate="normal"
              alwaysBounceVertical={true}
              overScrollMode="auto"
            >
              <View className="bg-white rounded-lg mx-4 mt-2 p-4 shadow-md mb-4" style={{ minHeight: '97%' }}>
                <View className="flex flex-col items-center flex-1 justify-between">
                  <View className="w-full flex-1">
                    <Text className="text-xl font-bold text-green-700 text-center mb-2">{t('pitches.pitchSummary')}</Text>

                    {selectedPitch.latitude && selectedPitch.longitude && (
                      <View
                        className="w-full rounded-lg overflow-hidden my-2"
                        style={{ position: 'relative', height: 192, minHeight: 192 }}
                      >
                        <PitchMap
                          latitude={selectedPitch.latitude}
                          longitude={selectedPitch.longitude}
                          title={selectedPitch.name}
                          height={192}
                        />

                        {/* Open in maps chooser - bottom-right (native'de anlamlı, web'de zaten PitchMap buton gösteriyor) */}
                        {Platform.OS !== 'web' ? (
                          <View style={{ position: 'absolute', right: 8, bottom: 8 }}>
                            <TouchableOpacity
                              onPress={showMapChooser}
                              style={{ backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9999 }}
                            >
                              <Text style={{ fontWeight: '700', color: '#111' }}>Haritalar uygulamasında Aç</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}

                        {/* Maps chooser modal */}
                        <Modal
                          visible={mapChooserVisible}
                          transparent
                          animationType="fade"
                          onRequestClose={() => setMapChooserVisible(false)}
                        >
                          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 16, width: 280 }}>
                              <Text style={{ fontWeight: '800', fontSize: 16, marginBottom: 10, textAlign: 'center', color: '#16a34a' }}>
                                Haritalarda aç
                              </Text>
                              {Platform.OS === 'ios' ? (
                                <TouchableOpacity onPress={openInAppleMaps} style={{ paddingVertical: 10 }}>
                                  <Text style={{ textAlign: 'center', fontWeight: '600' }}>Apple Haritalar</Text>
                                </TouchableOpacity>
                              ) : null}
                              <TouchableOpacity onPress={openInGoogleMaps} style={{ paddingVertical: 10 }}>
                                <Text style={{ textAlign: 'center', fontWeight: '600' }}>Google Maps</Text>
                              </TouchableOpacity>
                              {availableMaps.waze ? (
                                <TouchableOpacity onPress={openInWaze} style={{ paddingVertical: 10 }}>
                                  <Text style={{ textAlign: 'center', fontWeight: '600' }}>Waze</Text>
                                </TouchableOpacity>
                              ) : null}
                              <TouchableOpacity
                                onPress={() => setMapChooserVisible(false)}
                                style={{
                                  marginTop: 10,
                                  paddingVertical: 10,
                                  backgroundColor: '#e5e7eb',
                                  borderRadius: 10,
                                  borderWidth: 1,
                                  borderColor: '#9ca3af',
                                }}
                              >
                                <Text style={{ textAlign: 'center', color: '#374151', fontWeight: '700' }}>
                                  İptal
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </Modal>
                      </View>
                    )}

                    <View>
                      <Text className="h-7 text-xl text-green-700 font-semibold text-center mt-4">{selectedPitch.name}</Text>
                    </View>

                    <View>
                      <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-4">{t('pitches.openAddress')}</Text>
                      <View className="flex-row justify-center items-center pt-1">
                        <Ionicons name="location-outline" size={20} color="green" />
                        <Text className="pl-2 text-gray-700 font-semibold">{selectedPitch.address}</Text>
                      </View>
                    </View>

                    {/* Telefon ve Ücret yan yana */}
                    <View className="flex-row mt-3">
                      {/* Sol: Halı Saha Telefonu */}
                      <View className="w-1/2 pr-1">
                        <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">
                          Halı Saha Telefonu
                        </Text>
                        {hasPhone ? (
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${pitchPhone}`)}
                            activeOpacity={0.7}
                          >
                            <View className="flex-row justify-center items-center pt-1">
                              <Ionicons name="call-outline" size={18} color="green" />
                              <Text className="pl-2 text-gray-900 font-semibold">
                                {pitchPhone}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <View className="flex-row justify-center items-center pt-1">
                            <Ionicons name="call-outline" size={18} color="green" />
                            <Text className="pl-2 text-gray-700 font-semibold">
                              Telefon bilgisi yok
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Sağ: Saha Ücreti */}
                      <View className="w-1/2 pl-1">
                        <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">
                          {t('pitches.pitchPrice')}
                        </Text>
                        <View className="flex-row justify-center items-center pt-1 flex-wrap">
                          <Ionicons name="wallet-outline" size={18} color="green" />
                          <Text className="pl-2 text-gray-700 font-semibold">
                            {selectedPitch.price} ₺
                          </Text>
                          {!isGuest ? (
                            <TouchableOpacity onPress={() => setPriceInfoVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 4 }}>
                              <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
                            </TouchableOpacity>
                          ) : null}
                          {!isGuest ? (
                            <TouchableOpacity onPress={openPriceEdit} style={{ marginLeft: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#e5e7eb', borderRadius: 6 }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>{t('pitches.editPrice')}</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <View>
                      <Text className="text-lg font-semibold text-green-700 text-center mt-3 mb-2">{t('pitches.pitchFeatures')}</Text>
                      <View className="flex-row flex-wrap justify-center">
                        {featuresArray.map((feature: string, index: number) => (
                          <View key={index} className={`${featuresArray.length === 1 ? 'w-auto' : 'w-1/2'}  mb-1`}>
                            <View className="flex-row p-2 bg-green-700 rounded mr-1 items-center justify-center">
                              <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                              <Text className="text-white pl-1">{feature}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Geri Dön butonu - HALI SAHA ÖZETİ içinde */}
                  <View className="mt-6 mb-1 w-full">
                    <TouchableOpacity className="w-full items-center bg-green-700 px-2 py-2 rounded-lg" onPress={handleCloseDetail}>
                      <Text className="text-white font-bold text-lg">{t('general.back')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute',
                right: 20,
                top: '38%',
                alignItems: 'center',
                overflow: 'visible',
              }}
            >
              {/* Maç Oluştur - top işaretinin hemen üstünde, yan yana */}
              <View
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 20,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  marginBottom: 2,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 3,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: '#16a34a',
                    fontSize: 13,
                    fontWeight: 'bold',
                  }}
                >
                  Maç Oluştur
                </Text>
              </View>
              
              <Animated.View
                style={[
                  {
                    backgroundColor: '#16a34a',
                    borderRadius: 9999,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.6,
                    shadowRadius: 6,
                    elevation: 10,
                  },
                  pulseStyle,
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleSelectPitch(selectedPitch.id)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderRadius: 9999,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FontAwesome name="soccer-ball-o" size={24} color="#fff" />
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Saha ücreti bilgi modalı */}
            <Modal visible={priceInfoVisible} transparent animationType="fade">
              <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} activeOpacity={1} onPress={() => setPriceInfoVisible(false)}>
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: 12, padding: 20 }}>
                  <Text style={{ fontSize: 13, color: '#374151', lineHeight: 20, textAlign: 'center' }}>
                    {t('pitches.priceDisclaimer')}
                  </Text>
                  <TouchableOpacity onPress={() => setPriceInfoVisible(false)} style={{ marginTop: 16, paddingVertical: 10, backgroundColor: '#6b7280', borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: '600' }}>{t('general.close')}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>

            {/* Saha ücreti düzenleme modalı */}
            <Modal visible={priceEditVisible} transparent animationType="fade">
              <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }} activeOpacity={1} onPress={() => !priceUpdating && setPriceEditVisible(false)}>
                <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={{ backgroundColor: 'white', borderRadius: 12, padding: 20 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' }}>{t('pitches.editPriceTitle')}</Text>
                  <TextInput
                    value={editPriceValue}
                    onChangeText={setEditPriceValue}
                    keyboardType="numeric"
                    placeholder="0"
                    style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginBottom: 16 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity onPress={() => setPriceEditVisible(false)} style={{ flex: 1, paddingVertical: 10, backgroundColor: '#e5e7eb', borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: '#374151', fontWeight: '600' }}>{t('general.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSavePrice} disabled={priceUpdating} style={{ flex: 1, paddingVertical: 10, backgroundColor: '#16a34a', borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: 'white', fontWeight: '600' }}>{priceUpdating ? '...' : t('general.save')}</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          </>
      </View>
    );
  }

  return (
    <FlatList
      data={pitches}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => setSelectedPitch(item)}>
          <View className="bg-white rounded-lg mx-4 mt-3 p-3 shadow-md">
            <View className="flex-row justify-between">
              <Text className="w-4/6 text-base font-semibold">{item.name}</Text>
              <Text className="w-1/6 text-right text-sm text-gray-500">{item.distance?.toFixed(2)} km</Text>
              <Ionicons className="w-3 text-right" name="chevron-forward-outline" size={16} color="green" />
            </View>
          </View>
        </TouchableOpacity>
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      contentContainerStyle={{ paddingBottom: 10 }}
      nestedScrollEnabled
    />
  );
}
