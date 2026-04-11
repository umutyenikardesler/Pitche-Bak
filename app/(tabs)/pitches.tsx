import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, Alert, Platform, View, DeviceEventEmitter, Linking } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { supabase } from "@/services/supabase";
import haversine from "haversine";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "@/contexts/LanguageContext";
import PitchesLocation from "@/components/pitches/PitchesLocation";
import PitchesList from "@/components/pitches/PitchesList";
import AdMobBanner from "@/components/ads/AdMobBanner";

type PitchRow = {
  id: string;
  price?: any;
  latitude?: number;
  longitude?: number;
  distance?: number;
  [key: string]: any;
};

export default function Pitches() {
  const { t } = useLanguage();
  const [pitches, setPitches] = useState<PitchRow[]>([]);
  const [selectedPitch, setSelectedPitch] = useState<PitchRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationText, setLocationText] = useState("Konum alınıyor...");
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchPitches();
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const stored = await AsyncStorage.getItem("locationPermissionStatus");
      if (stored === "granted") {
        setLocationPermissionStatus("granted");
        // İzin verilmişse otomatik olarak konumu al
        await getLocation();
      } else {
        const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
        setLocationPermissionStatus(status);
        await AsyncStorage.setItem("locationPermissionStatus", status);
        if (status === "granted") {
          // İzin verildiyse otomatik olarak konumu al
          await getLocation();
        } else {
          // İzin verilmediyse kullanıcıya bilgi ver
          Alert.alert(
            t('pitches.locationPermissionRequired'),
            t('pitches.locationPermissionMessage'),
            [
              {
                text: t('general.cancel'),
                style: 'cancel'
              },
              {
                text: Platform.OS === 'ios' ? t('general.openSettings') : t('general.givePermission'),
                onPress: async () => {
                  if (Platform.OS === 'ios') {
                    await Linking.openSettings();
                  } else {
                    await Location.requestForegroundPermissionsAsync();
                  }
                }
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error(t('pitches.permissionCheckError'), error);
    }
  };

  const fetchPitches = useCallback(
    async (
      userLat?: number,
      userLon?: number,
      opts?: {
        showLoading?: boolean;
      }
    ) => {
      const showLoading = opts?.showLoading !== false;
      if (showLoading) setLoading(true);

      try {
        const { data, error } = await supabase.from("pitches").select("*");
        if (error) {
          console.error(t("pitches.dataFetchError"), error);
          return;
        }

        if (userLat != null && userLon != null) {
          const sorted = (data || [])
            .map((pitch: any) => ({
              ...pitch,
              distance: haversine(
                { latitude: userLat, longitude: userLon },
                { latitude: pitch.latitude, longitude: pitch.longitude },
                { unit: "km" }
              ),
            }))
            .sort((a: any, b: any) => a.distance - b.distance);
          setPitches(sorted);
        } else {
          setPitches(data || []);
        }
      } catch (e) {
        // Network request failed vb. durumda refresh/loading sonsuza kadar dönmesin.
        console.error(t("pitches.dataFetchError"), e);
      } finally {
        if (showLoading) setLoading(false);
        setRefreshing(false);
      }
    },
    [t]
  );

  const getLocation = useCallback(async (showAlertOnError: boolean = false) => {
    try {
      // İzin kontrolü - state'e bağlı kalmadan direkt kontrol et
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationText(t('pitches.locationCouldNotBeRetrieved'));
        if (showAlertOnError) {
          Alert.alert(t('pitches.locationError'), t('pitches.locationInfoCouldNotBeRetrieved'));
        }
        return;
      }
      
      setLocationPermissionStatus("granted");
      await AsyncStorage.setItem("locationPermissionStatus", "granted");
      
      const { coords } = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = coords;
      setLocation({ latitude, longitude });

      try {
        const stripMahalleSuffix = (s: string) => {
          return s
            .replace(/\s*Mahallesi\s*$/i, '')
            .replace(/\s*Mah\.\s*$/i, '')
            .trim();
        };

        const toTrTitleCase = (text: string) => {
          return text
            .toLocaleLowerCase('tr-TR')
            .split(' ')
            .filter(Boolean)
            .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
            .join(' ');
        };

        const normalizeStreetTr = (streetRaw: string) => {
          const s = streetRaw.trim();
          // "Sokak" -> "Sok", "Cadde" -> "Cad" gibi (örnekte "5043 Sok")
          return s
            .replace(/\b(sokak|sokağı)\b/gi, 'Sok')
            .replace(/\b(cadde|caddesi)\b/gi, 'Cad')
            // "294. Sok" -> "294 Sok"
            .replace(/(\d+)\.\s*(Sok|Cad)\b/gi, '$1 $2')
            // "294." gibi kalan nokta
            .replace(/(\d+)\.\b/g, '$1');
        };

        const formatTrAddress = (args: {
          neighborhood?: string | null;
          street?: string | null;
          streetNumber?: string | null;
          district?: string | null; // ilçe
          province?: string | null; // il
        }) => {
          // İstenen örnek: "Rafetpaşa, 5043 Sok, 10, Bornova / İZMİR"
          const neighborhood = args.neighborhood ? toTrTitleCase(stripMahalleSuffix(args.neighborhood)) : '';
          const street = args.street ? normalizeStreetTr(args.street) : '';
          const no = (args.streetNumber ?? '').trim();
          const district = args.district ? toTrTitleCase(args.district.trim()) : '';
          const province = args.province ? args.province.trim().toLocaleUpperCase('tr-TR') : '';

          const leftParts: string[] = [];
          if (neighborhood) leftParts.push(neighborhood);
          if (street) leftParts.push(street);
          if (no) leftParts.push(no);

          const left = leftParts.join(', ').trim();

          const right =
            district && province ? `${district} / ${province}` : district ? district : province ? province : '';

          if (left && right) return `${left}, ${right}`;
          return (left || right).trim();
        };

        // Web'de expo-location reverse geocode çoğu zaman detaylı adres dönmeyebiliyor.
        // Bu yüzden web'de önce Nominatim ile adresi dene.
        const reverseGeocodeWeb = async (lat: number, lon: number) => {
          const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
          const res = await fetch(url, {
            headers: {
              // Nominatim temel kullanım şartı: user-agent bilgisi
              'User-Agent': 'SahayaBak/1.0 (web)',
              'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
            },
          });
          if (!res.ok) return null;
          const json: any = await res.json();
          const a = json?.address ?? {};

          const isTr = (a.country_code || '').toLowerCase() === 'tr';

          if (isTr) {
            const neighborhood = a.suburb || a.neighbourhood || a.quarter;
            const street = a.road || a.pedestrian || a.footway || a.path;
            const no = a.house_number;

            // Nominatim TR alanları şehir/ilçe bazen farklı key'lerde gelebiliyor:
            // - il (province): state / province / region / city
            // - ilçe (district): county / city_district / municipality / district
            const isRegionLike = (s: any) =>
              typeof s === 'string' && /bölgesi|region/i.test(s);

            // "Ege Bölgesi" gibi değerleri il olarak kabul etmeyelim.
            // TR için il genelde `state` veya `city` alanında gelir (örn. state="İzmir", city="Bayraklı" gibi karışık durumlar olabiliyor).
            let province: string =
              (!isRegionLike(a.state) ? a.state : '') ||
              (!isRegionLike(a.province) ? a.province : '') ||
              (!isRegionLike(a.city) ? a.city : '') ||
              (!isRegionLike(a.town) ? a.town : '') ||
              (!isRegionLike(a.village) ? a.village : '') ||
              '';

            let district: string =
              a.city_district || a.county || a.municipality || a.district || '';

            // Bazı durumlarda ilçe a.city olarak gelir (örn. city="Bayraklı", state="İzmir")
            // İlçe boşsa ve city, province'den farklıysa city'yi ilçe olarak al.
            if (!district && a.city && province && a.city !== province) {
              district = a.city;
            }

            // Kritik düzeltme:
            // Bazı TR adreslerinde `city` ilçe (Bayraklı) olarak gelir, `state` ise il (İzmir) olur.
            // Eğer ilçe boş kaldıysa ama `state` varsa ve province state'den farklıysa:
            // province'i state yap, önceki province'i ilçe kabul et.
            if (!district && a.state && province && a.state !== province && !isRegionLike(a.state)) {
              district = province;
              province = a.state;
            }

            // Eğer province ile district aynıysa (tekrar), province'i state'e çekmeye çalış
            if (
              district &&
              province &&
              district.toLocaleLowerCase('tr-TR') === province.toLocaleLowerCase('tr-TR') &&
              a.state &&
              !isRegionLike(a.state)
            ) {
              province = a.state;
            }

            // Eğer hala il "bölge" gibi kaldıysa ama address içinde daha iyi aday varsa, city'yi dene
            if (isRegionLike(province) && a.city && !isRegionLike(a.city)) {
              province = a.city;
            }

            // Son güvenlik: TR'de il mutlaka büyük harf olsun diye province boşsa state/province'ı tekrar dene
            if (!province && a.state && !isRegionLike(a.state)) {
              province = a.state;
            }

            const formatted = formatTrAddress({
              neighborhood,
              street,
              streetNumber: no,
              district,
              province,
            });

            return formatted || json?.display_name || null;
          }

          // TR değilse basit bir fallback
          return json?.display_name || null;
        };

        if (Platform.OS === 'web') {
          const webAddress = await reverseGeocodeWeb(latitude, longitude);
          if (webAddress) {
            setLocationText(webAddress);
            fetchPitches(latitude, longitude);
            return;
          }
        }

        // Önce standart reverse geocoding
        const address = await Location.reverseGeocodeAsync({ latitude, longitude });
        console.log("📍 Tam adres verisi:", address[0]); // Debug için
        
        let formatted = "";
        
                 if (address && address.length > 0) {
           const addr = address[0];
           const { street, streetNumber, name, district, subregion, region, city, country, postalCode } = addr;
           
           // Türkiye için özel adres formatı (MOBİL zaten düzgün görünüyordu, eski davranışı koru)
           if (country === "Turkey" || country === "Türkiye") {
             // Sokak ve numara
             if (street) {
               if (streetNumber) {
                 formatted = `${street} ${streetNumber}`;
               } else {
                 formatted = street;
               }
             } else if (name) {
               formatted = name;
             }
             
             // Mahalle/İlçe (Türkiye'de genellikle subregion)
             if (subregion && subregion !== street && subregion !== name) {
               formatted += formatted ? `, ${subregion}` : subregion;
             }
             
             // Şehir (Türkiye'de genellikle city)
             if (city && city !== subregion && city !== street && city !== name) {
               formatted += formatted ? `, ${city}` : city;
             }
             
             // İl (Türkiye'de genellikle region)
             if (region && region !== city && region !== subregion && region !== street && region !== name) {
               formatted += formatted ? `, ${region}` : region;
             }
           } else {
             // Diğer ülkeler için standart format
             if (street) {
               if (streetNumber) {
                 formatted = `${street} ${streetNumber}`;
               } else {
                 formatted = street;
               }
             } else if (name) {
               formatted = name;
             }
             
             if (subregion && subregion !== street && subregion !== name) {
               formatted += formatted ? `, ${subregion}` : subregion;
             }
             
             if (city && city !== subregion && city !== street && city !== name) {
               formatted += formatted ? `, ${city}` : city;
             }
             
             if (region && region !== city && region !== subregion && region !== street && region !== name) {
               formatted += formatted ? `, ${region}` : region;
             }
             
             if (country) {
               formatted += formatted ? `, ${country}` : country;
             }
           }
           
           // Posta kodu (varsa)
           if (postalCode) {
             formatted += formatted ? `, ${postalCode}` : postalCode;
           }
           
           // Son temizlik
           formatted = formatted
             .replace(/^,\s*/, "") // Baştaki virgülü kaldır
             .replace(/,\s*,/g, ",") // Çift virgülleri tek yap
             // Türkçe sokak türlerindeki noktaları kaldır
             .replace(/(\d+)\.\s*(Sokak|Cadde|Mahalle|Bulvar|Caddesi|Sokağı|Mahallesi|Bulvarı|Sk\.|Cd\.|Mh\.|Blv\.)/g, "$1 $2")
             // İngilizce sokak türlerindeki noktaları kaldır
             .replace(/(\d+)\.\s*(Street|Road|Avenue|Boulevard|Lane|Drive|Way|St\.|Rd\.|Ave\.|Blvd\.)/g, "$1 $2")
             // Genel sayı + nokta + boşluk + kelime formatını düzelt
             .replace(/(\d+)\.\s+([A-Za-zğüşıöçĞÜŞİÖÇ]+)/g, "$1 $2")
             // Kısaltmalardaki noktaları kaldır
             .replace(/(\d+)\.\s*(Sk|Cd|Mh|Blv|St|Rd|Ave|Blvd)/g, "$1 $2")
             .trim();
         }
        
                 // Eğer hala adres bulunamadıysa, koordinatları göster
         if (!formatted) {
           // Web'de koordinat göstermek yerine daha sade göster
           formatted = Platform.OS === 'web'
             ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
             : `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
         }
        
        setLocationText(formatted || t('pitches.addressNotFound'));
      } catch (error) {
        console.log("📍 Adres bulma hatası:", error);
        setLocationText(t('pitches.addressCouldNotBeRetrieved'));
      }

      fetchPitches(latitude, longitude);
    } catch (err) {
      console.error(t('pitches.locationError'), err);
      setLocationText(t('pitches.locationCouldNotBeRetrieved'));
      // Sadece manuel çağrıda (butonla) Alert göster
      if (showAlertOnError) {
        Alert.alert(t('pitches.locationError'), t('pitches.locationInfoCouldNotBeRetrieved'));
      }
    }
  }, [t, fetchPitches]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPitches(location?.latitude, location?.longitude, { showLoading: false });
  };

  const handleCloseDetail = useCallback(() => {
    setSelectedPitch(null);
  }, []);

  const handlePriceUpdated = useCallback((pitchId: string, newPrice: number) => {
    setPitches((prev) => prev.map((p) => (p.id === pitchId ? { ...p, price: newPrice } : p)));
    setSelectedPitch((prev) => (prev?.id === pitchId ? { ...prev, price: newPrice } : prev));
  }, []);

  // Soldan sağa swipe ile saha detayından geri dön
  const swipeBackGesture = Gesture.Pan()
    .activeOffsetX(20)
    .failOffsetY([-12, 12])
    .onEnd((event) => {
      if (event.translationX > 80 && Math.abs(event.translationY) < 100) {
        runOnJS(handleCloseDetail)();
      }
    });

  // CustomHeader başlık tıklaması veya tab'a basılması ile modal'ları/detayı kapat
  useEffect(() => {
    const closeModalsSub = DeviceEventEmitter.addListener('closeModals', () => {
      console.log('closeModals event alındı, pitches modal\'ı kapatılıyor');
      if (selectedPitch) {
        handleCloseDetail();
      }
    });

    const closePitchDetailSub = DeviceEventEmitter.addListener('closePitchDetail', () => {
      console.log('closePitchDetail event alındı, saha detayı kapatılıyor');
      if (selectedPitch) {
        handleCloseDetail();
      }
    });

    return () => {
      closeModalsSub.remove();
      closePitchDetailSub.remove();
    };
  }, [selectedPitch]);

  if (loading) {
    return <ActivityIndicator size="large" color="green" className="flex-1 justify-center items-center" />;
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <GestureDetector gesture={swipeBackGesture}>
        <View className="bg-slate-100 flex-1">
          {!selectedPitch && (
            <View style={{ flexShrink: 0 }} collapsable={false}>
              <PitchesLocation locationText={locationText} setLocationText={setLocationText} getLocation={getLocation} />
            </View>
          )}
          {!selectedPitch ? (
            <View style={{ marginTop: 8 }}>
              <AdMobBanner />
            </View>
          ) : null}
          <PitchesList
          pitches={pitches}
          selectedPitch={selectedPitch}
          setSelectedPitch={setSelectedPitch}
          handleCloseDetail={handleCloseDetail}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onPriceUpdated={handlePriceUpdated}
        />
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
