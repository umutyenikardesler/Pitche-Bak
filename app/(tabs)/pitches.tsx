import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { supabase } from "@/services/supabase";
import haversine from "haversine";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PitchesLocation from "@/components/pitches/PitchesLocation";
import PitchesList from "@/components/pitches/PitchesList";

export default function Pitches() {
  const [pitches, setPitches] = useState([]);
  const [selectedPitch, setSelectedPitch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationText, setLocationText] = useState("Konum alınıyor...");
  const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);

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
          Alert.alert("Konum izni gerekli", "Uygulamayı kullanmak için konum izni vermeniz gerekiyor.");
        }
      }
    } catch (error) {
      console.error("İzin kontrolünde hata:", error);
    }
  };

  const fetchPitches = async (userLat?: number, userLon?: number) => {
    setLoading(true);
    const { data, error } = await supabase.from("pitches").select("*");
    if (error) {
      console.error("Veri çekme hatası:", error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (userLat && userLon) {
      const sorted = data
        .map((pitch) => ({
          ...pitch,
          distance: haversine(
            { latitude: userLat, longitude: userLon },
            { latitude: pitch.latitude, longitude: pitch.longitude },
            { unit: "km" }
          ),
        }))
        .sort((a, b) => a.distance - b.distance);
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
        const address = await Location.reverseGeocodeAsync({ latitude, longitude });
        const { street, name, subregion, region } = address[0] || {};
        const formatted = `${street ?? name ?? ""}, ${subregion ?? ""}, ${region ?? ""}`.trim();
        setLocationText(formatted || "Adres bulunamadı.");
      } catch {
        setLocationText("Adres alınamadı.");
      }

      fetchPitches(latitude, longitude);
    } catch (err) {
      console.error("Konum hatası:", err);
      setLocationText("Konum alınamadı.");
      Alert.alert("Konum Hatası", "Konum bilgisi alınamadı.");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPitches(location?.latitude, location?.longitude);
  };

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
          handleCloseDetail={() => setSelectedPitch(null)}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      </View>
    </GestureHandlerRootView>
  );
}
