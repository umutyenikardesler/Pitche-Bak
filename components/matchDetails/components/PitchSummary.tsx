// Halı saha özeti componenti
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Modal, TextInput, Alert, Platform, DeviceEventEmitter } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PitchMap from '@/components/maps/PitchMap';
import { useLanguage } from '@/contexts/LanguageContext';
import { Match } from '@/components/index/types';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface PitchSummaryProps {
  match: Match;
  currentUserId?: string | null;
}

export default function PitchSummary({ match, currentUserId }: PitchSummaryProps) {
  const { t } = useLanguage();
  const { isGuest } = useAuth();
  const isMatchOwner = !!currentUserId && currentUserId === match.create_user;
  // "Halı Saha Özeti" başlangıçta açık gelsin (mobil + web)
  const [isExpanded, setIsExpanded] = useState(true);
  const [priceInfoVisible, setPriceInfoVisible] = useState(false);
  const [priceEditVisible, setPriceEditVisible] = useState(false);
  const [editPriceValue, setEditPriceValue] = useState('');
  const [priceUpdating, setPriceUpdating] = useState(false);
  const [localPrice, setLocalPrice] = useState<number | null>(null);
  const [mapChooserVisible, setMapChooserVisible] = useState(false);
  const [availableMaps, setAvailableMaps] = useState<{ google: boolean; waze: boolean }>({ google: false, waze: false });
  
  const featuresArray: string[] = Array.isArray(match.pitches) 
    ? match.pitches[0]?.features || []
    : match.pitches?.features || [];

  const pitch = Array.isArray(match.pitches) ? match.pitches[0] : match.pitches;
  const pitchName = pitch?.name ?? 'Bilinmiyor';
  const pitchAddress = pitch?.address ?? 'Adres bilgisi yok';
  const pitchId = (pitch as any)?.id as string | undefined;
  const pitchPriceRaw = localPrice != null ? localPrice : (pitch as any)?.price;
  const hasPrice = pitchPriceRaw != null && pitchPriceRaw !== '';
  const pitchPhone = pitch?.phone ?? '';
  const hasPhone = !!pitchPhone;
  const pitchLat = (pitch as any)?.latitude as number | undefined;
  const pitchLon = (pitch as any)?.longitude as number | undefined;
  const hasCoords = !!pitchLat && !!pitchLon;

  const showMapChooser = async () => {
    if (!hasCoords) return;
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
    if (!hasCoords) return;
    const label = encodeURIComponent(pitchName || 'Konum');
    const url = `http://maps.apple.com/?ll=${pitchLat},${pitchLon}&q=${label}`;
    Linking.openURL(url);
    setMapChooserVisible(false);
  };

  const openInGoogleMaps = () => {
    if (!hasCoords) return;
    const label = encodeURIComponent(pitchName || 'Konum');
    let url = '';
    if (Platform.OS === 'ios') {
      url = `comgooglemaps://?q=${pitchLat},${pitchLon}(${label})`;
    } else {
      url = `geo:${pitchLat},${pitchLon}?q=${pitchLat},${pitchLon}(${label})`;
    }
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${pitchLat},${pitchLon}`);
    });
    setMapChooserVisible(false);
  };

  const openInWaze = () => {
    if (!hasCoords) return;
    const url = `waze://?ll=${pitchLat},${pitchLon}&navigate=yes`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://waze.com/ul?ll=${pitchLat},${pitchLon}&navigate=yes`);
    });
    setMapChooserVisible(false);
  };

  const openPriceEdit = () => {
    if (isGuest) return;
    if (!pitchId) {
      Alert.alert(t('general.error'), 'Saha bilgisi bulunamadı.');
      return;
    }
    setEditPriceValue(String(pitchPriceRaw ?? ''));
    setPriceEditVisible(true);
  };

  const handleSavePrice = async () => {
    if (isGuest) {
      setPriceEditVisible(false);
      return;
    }
    if (!pitchId) return;
    const num = parseInt(String(editPriceValue || '').replace(/\D/g, ''), 10);
    if (isNaN(num) || num < 0) {
      Alert.alert('', t('pitches.priceInvalid'));
      return;
    }
    setPriceUpdating(true);
    const { data: updated, error } = await supabase
      .from('pitches')
      .update({ price: num })
      .eq('id', pitchId)
      .select('id, price');
    setPriceUpdating(false);
    setPriceEditVisible(false);
    if (error) {
      Alert.alert(t('general.error'), error.message || t('pitches.priceUpdateFailed'));
      return;
    }
    if (!updated || updated.length === 0) {
      Alert.alert(t('general.error'), t('pitches.priceUpdateFailed'));
      return;
    }
    setLocalPrice(num);

    // Maç tarihi henüz geçmediyse match.prices alanını da senkron tut
    const matchDate = new Date(match.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (matchDate >= today) {
      await supabase
        .from('match')
        .update({ prices: num })
        .eq('id', match.id);
    }

    try {
      DeviceEventEmitter.emit('pitchPriceUpdated', { matchId: match.id, pitchId, price: num });
    } catch (_) {}
  };

  return (
    <>
      <TouchableOpacity 
        className="flex-row mb-3 justify-center items-center bg-green-100 border-2 border-green-300 rounded-lg py-3 px-2"
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <Ionicons name="accessibility-outline" size={20} color="green" />
        <Text className="text-xl font-bold text-green-700 ml-3"> {t('home.pitchSummary')} </Text>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={24} 
          color="green" 
          className="ml-3" 
        />
      </TouchableOpacity>

      {/* Dropdown içeriği */}
      {isExpanded && (
        <View style={{ minHeight: 200 }}>
          {hasCoords && (
            <View className="w-full rounded-lg overflow-hidden my-2" style={{ position: 'relative', height: 192, minHeight: 192 }}>
              <PitchMap latitude={pitchLat!} longitude={pitchLon!} title={pitchName} height={192} />

              {/* Open in maps chooser - bottom-right (native'de anlamlı, web'de zaten PitchMap buton gösterebilir) */}
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

          <View className="">
            <Text className="h-7 text-xl font-semibold text-green-700 text-center my-2">{pitchName}</Text>
          </View>

          <View className="">
            <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">{t('home.openAddress')}</Text>
          </View>
          <View className="text-gray-700 text-md flex-row justify-center items-center pt-1">
            <Ionicons name="location" size={18} color="black" />
            <Text className="pl-2 font-semibold text-gray-700">{pitchAddress}</Text>
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
                  <View className="text-gray-700 text-md flex-row justify-center items-center pt-1">
                    <Ionicons name="call-outline" size={18} color="green" />
                    <Text className="pl-2 font-semibold text-gray-900">
                      {pitchPhone}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View className="text-gray-700 text-md flex-row justify-center items-center pt-1">
                  <Ionicons name="call-outline" size={18} color="green" />
                  <Text className="pl-2 font-semibold text-gray-700">
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
                {hasPrice ? (
                  <Text className="pl-2 font-semibold text-gray-700">
                    {pitchPriceRaw} ₺
                  </Text>
                ) : (
                  <Text className="pl-2 font-semibold text-gray-700">
                    Fiyat bilgisi yok
                  </Text>
                )}
                {!isGuest ? (
                  <TouchableOpacity
                    onPress={() => setPriceInfoVisible(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ marginLeft: 4 }}
                  >
                    <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
                  </TouchableOpacity>
                ) : null}
                {isMatchOwner ? (
                  <TouchableOpacity
                    onPress={openPriceEdit}
                    style={{ marginLeft: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#e5e7eb', borderRadius: 6 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151' }}>
                      {t('pitches.editPrice')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          <View>
            <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-4">{t('home.pitchFeatures')}</Text>
          </View>
          <View className="flex-row flex-wrap justify-center items-center mt-3">
            {featuresArray.map((feature, index) => (
              <View key={index} className="w-1/2 mb-1">
                <View className="flex-row p-2 bg-green-700 rounded mr-1 items-center justify-center">
                  <Ionicons name="checkmark-circle-outline" size={16} color="white" className="" />
                  <Text className="text-white pl-1">{feature}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Saha ücreti bilgi modalı */}
          <Modal visible={priceInfoVisible} transparent animationType="fade">
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
              activeOpacity={1}
              onPress={() => setPriceInfoVisible(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={{ backgroundColor: 'white', borderRadius: 12, padding: 20 }}
              >
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
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
              activeOpacity={1}
              onPress={() => !priceUpdating && setPriceEditVisible(false)}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={{ backgroundColor: 'white', borderRadius: 12, padding: 20 }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12, textAlign: 'center' }}>
                  {t('pitches.editPriceTitle')}
                </Text>
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
        </View>
      )}
    </>
  );
}

