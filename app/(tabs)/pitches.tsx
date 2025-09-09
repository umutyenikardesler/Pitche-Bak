import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, View, DeviceEventEmitter } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { supabase } from "@/services/supabase";
import haversine from "haversine";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "@/contexts/LanguageContext";
import PitchesLocation from "@/components/pitches/PitchesLocation";
import PitchesList from "@/components/pitches/PitchesList";

export default function Pitches() {
  const { t } = useLanguage();
  const [pitches, setPitches] = useState<any[]>([]);
  const [selectedPitch, setSelectedPitch] = useState<any>(null);
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
        getLocation();
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setLocationPermissionStatus(status);
        await AsyncStorage.setItem("locationPermissionStatus", status);
        if (status !== "granted") {
          Alert.alert(t('pitches.locationPermissionRequired'), t('pitches.locationPermissionMessage'));
        }
      }
    } catch (error) {
      console.error(t('pitches.permissionCheckError'), error);
    }
  };

  const fetchPitches = async (userLat?: number, userLon?: number) => {
    setLoading(true);
    const { data, error } = await supabase.from("pitches").select("*");
    if (error) {
      console.error(t('pitches.dataFetchError'), error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (userLat && userLon) {
      const sorted = data
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
      setPitches(data);
    }

    setLoading(false);
    setRefreshing(false);
  };

  const getLocation = async () => {
    if (locationPermissionStatus !== "granted") return;
    try {
      const { coords } = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = coords;
      setLocation({ latitude, longitude });

      try {
        // Önce standart reverse geocoding
        const address = await Location.reverseGeocodeAsync({ latitude, longitude });
        console.log("📍 Tam adres verisi:", address[0]); // Debug için
        
        let formatted = "";
        
                 if (address && address.length > 0) {
           const addr = address[0];
           const { street, streetNumber, name, subregion, region, city, country, postalCode } = addr;
           
           // Türkiye için özel adres formatı
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
           formatted = `📍 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
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
      Alert.alert(t('pitches.locationError'), t('pitches.locationInfoCouldNotBeRetrieved'));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPitches(location?.latitude, location?.longitude);
  };

  const handleCloseDetail = () => {
    setSelectedPitch(null);
  };

  // CustomHeader başlık tıklaması ile modal'ları kapat
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('closeModals', () => {
      console.log('closeModals event alındı, pitches modal\'ı kapatılıyor');
      // Pitches modal'ını kapat
      if (selectedPitch) {
        handleCloseDetail();
      }
    });

    return () => subscription.remove();
  }, [selectedPitch]);

  if (loading) {
    return <ActivityIndicator size="large" color="green" className="flex-1 justify-center items-center" />;
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="bg-slate-100 flex-1">
        <PitchesLocation locationText={locationText} setLocationText={setLocationText} getLocation={getLocation} />
        <PitchesList
          pitches={pitches}
          selectedPitch={selectedPitch}
          setSelectedPitch={setSelectedPitch}
          handleCloseDetail={handleCloseDetail}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      </View>
    </GestureHandlerRootView>
  );
}
