import { Text, View, Image, FlatList, TouchableOpacity, RefreshControl, Dimensions, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from '@/services/supabase';
import { useEffect, useState, useCallback } from 'react';
import '@/global.css';
import { useFocusEffect } from '@react-navigation/native';
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import MapView, { Marker } from "react-native-maps";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function Index() {
  //const progress = 85;
  const screenWidth = Dimensions.get("window").width;
  const fontSize = screenWidth > 430 ? 12 : screenWidth > 320 ? 11.5 : 10;

  const [allMatches, setAllMatches] = useState([]);
  const [futureMatches, setFutureMatches] = useState([]);
  const [otherMatches, setOtherMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState(null);
  const [totalMatchCount, setTotalMatchCount] = useState(0);

  const fetchMatches = async () => {
    //setLoading(true); // 🟢 Veri çekme başlıyor, yükleniyor durumuna geç
    setRefreshing(true);

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD formatında
    const currentHours = new Date().getHours();
    const currentMinutes = new Date().getMinutes();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user.id) {
      console.error("Kullanıcı kimlik doğrulama hatası veya geçersiz ID:", authError);
      setRefreshing(false);
      // setLoading(false);
      return;
    }

    const loggedUserId = authData.user.id;
    setUserId(loggedUserId); // ✅ userId'yi güncelle

    // TÜM MAÇLARI ÇEK (KONDİSYON HESABI İÇİN)
    const { data: allMatchData, error: allMatchError } = await supabase
      .from("match")
      .select(`id`)
      .eq("create_user", loggedUserId);

    if (!allMatchError) {
      setTotalMatchCount(allMatchData.length);
    }

    // GELECEKTEKİ MAÇLARI ÇEK (LİSTELEME İÇİN)
    const { data: matchData, error: matchError } = await supabase
      .from("match")
      .select(`
        id, title, time, date, prices, missing_groups, create_user,
        pitches (name, address, price, features, district_id, latitude, longitude, districts (name)),
        users (id, name, surname, profile_image)
      `)
      .eq("create_user", loggedUserId)
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (matchError) {
      console.error("Maçları çekerken hata:", matchError);
    } else {
      const filteredMatches = matchData?.filter((item) => {
        if (item.date > today) return true;
        const [matchHours, matchMinutes] = item.time.split(":").map(Number);
        return matchHours + 1 > currentHours || 
               (matchHours + 1 === currentHours && matchMinutes > currentMinutes);
      });

      const formattedData = filteredMatches?.map((item) => ({
        ...item,
        formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
        startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
        endFormatted: `${parseInt(item.time.split(":")[0], 10) + 1}:${item.time.split(":")[1]}`,
      })) || [];

      setAllMatches(formattedData);
      setFutureMatches(formattedData); // Gelecekteki maçları ayrı state'te tut
    }

    setRefreshing(false);
    //setLoading(false);


    // DİĞER KULLANICILARIN MAÇLARI
    const { data: otherMatchData, error: otherMatchError } = await supabase
      .from("match")
      .select(`
        id, title, time, date, prices, missing_groups,
        pitches (name, price, address, features, district_id, latitude, longitude, districts (name)),
        users (id, name, surname, profile_image)
      `)
      .neq("create_user", loggedUserId)
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (otherMatchError) {
      console.error("Diğer maçları çekerken hata:", otherMatchError);
      setOtherMatches([]);
    } else {
      const filteredOtherMatches = otherMatchData?.filter((item) => {
        if (item.date > today) return true;
        const [matchHours, matchMinutes] = item.time.split(":").map(Number);
        return matchHours + 1 > currentHours || 
               (matchHours + 1 === currentHours && matchMinutes > currentMinutes);
      });
    
      const otherFormattedData = filteredOtherMatches?.map((item) => ({
        ...item,
        formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
        startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
        endFormatted: `${parseInt(item.time.split(":")[0], 10) + 1}:${item.time.split(":")[1]}`,
      })) || [];

      setOtherMatches(otherFormattedData);
    }

    setRefreshing(false);
  };

  const router = useRouter(); // Router'ı tanımlayalım.

  useFocusEffect(
    useCallback(() => {
      fetchMatches();

      if (router.params?.refreshProfile) {
        navigation.navigate("profile", { refreshMatches: true });
      }

      return () => { };
    }, [router.params])
  );

  const handleSelectMatch = (match) => {
    setSelectedMatch(match);
  };

  const handleCloseDetail = () => {
    setSelectedMatch(null);
  };

  const swipeGesture = Gesture.Pan().onUpdate((event) => {
    if (event.translationX > 100) {
      runOnJS(handleCloseDetail)();
    }
  });

  const formatTitle = (text) => {
    if (!text) return "";
    const formattedText = text.charAt(0).toUpperCase() + text.slice(1); // İlk harfi büyük yap
    return formattedText.length > 23 ? formattedText.slice(0, 23) + "..." : formattedText;
  };

  const featuresArray = selectedMatch?.pitches?.features
    ? Array.isArray(selectedMatch.pitches.features)
      ? selectedMatch.pitches.features
      : []
    : [];


  // KONDİSYON HESAPLAMA FONKSİYONU
  const calculateCondition = (matchCount) => {
    if (matchCount < 3) return 0;
    if (matchCount === 3) return 60;
    if (matchCount === 4) return 80;
    if (matchCount === 5) return 90;
    if (matchCount > 5) return Math.min(90 + (matchCount - 5) * 2, 100);
    return 0;
  };

  const progress = calculateCondition(totalMatchCount);

  // KONDİSYON MESAJI
  let conditionMessage = "";
  let conditionMessageColor = "green";

  if (totalMatchCount < 3) {
    conditionMessage = "Kondisyon kazanman için en az 3 maç yapman lazım!";
    conditionMessageColor = "red";
  } else if (totalMatchCount === 3) {
    conditionMessage = "Eğer 1 maç daha yaparsan kondisyonun 80'e yükselecek";
  } else if (totalMatchCount === 4) {
    conditionMessage = "Eğer 1 maç daha yaparsan kondisyonun 90'a yükselecek";
  } else if (totalMatchCount === 5) {
    conditionMessage = "İlk 5 maçını tamamladın. Spor yapmaya devam!";
  } else {
    conditionMessage = "Gerekli kondisyonu kazandın. Sağlıklı günler!";
  }

  const renderMatch = ({ item }) => {

    return (
      <TouchableOpacity onPress={() => handleSelectMatch(item)}>
        <View className="bg-white rounded-lg mx-4 mt-1 mb-1 p-2 shadow-lg">
          <View className="flex-row">
            <View className="w-1/5 justify-center py-1 p-1">
              <Image
                source={ item.users?.profile_image
                  ? { uri: item.users.profile_image }
                  : require('@/assets/images/ball.png')}
                className="rounded-full mx-auto"
                style={{ width: 60, height: 60, resizeMode: 'contain' }}
              />
            </View>

            <View className="w-4/6 px-2">
              <Text className="text-lg text-green-600 font-semibold">
                {formatTitle(item.title)}
              </Text>

              <View className="text-gray-700 text-md flex-row items-center">
                <Ionicons name="calendar-outline" size={18} color="black" />
                <Text className="pl-2 font-semibold"> {item.formattedDate}  →</Text>
                <Text className="pl-2 font-bold text-green-600"> {item.startFormatted}-{item.endFormatted} </Text>
              </View>

              <View className="text-gray-700 text-md flex-row items-center pt-1">
                <Ionicons name="location" size={18} color="black" />
                <Text className="pl-2 font-semibold"> {item.pitches?.districts?.name ?? 'Bilinmiyor'}  →</Text>
                <Text className="pl-2 font-bold text-green-700"> {item.pitches?.name ?? 'Bilinmiyor'} </Text>
              </View>
            </View>

            <View className="flex-1 items-end justify-center px-1">
              <Ionicons name="chevron-forward-outline" size={20} color="green" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (

    <GestureHandlerRootView className="flex-1">
      {selectedMatch ? (
        <GestureDetector gesture={swipeGesture}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <View className="flex-1 bg-white p-4 rounded-lg m-3 shadow-lg">

              <View className="flex-row mb-2 justify-center">
                <Ionicons name="accessibility-outline" size={16} color="green" className="pt-1" />
                <Text className="text-xl font-bold text-green-700 "> MAÇ ÖZETİ </Text>
              </View>

              <Text className="text-lg text-green-700 font-semibold text-center">{selectedMatch.title}</Text>

              <View className="flex-row ">
                <View className="w-1/2 text-gray-700 text-md flex-row justify-center items-center">
                  <Ionicons name="calendar-outline" size={18} color="black" />
                  <Text className="pl-2 font-semibold">{selectedMatch.formattedDate}</Text>
                </View>
                <View className=" w-1/2 text-gray-700 text-md flex-row justify-center items-center pt-1">
                  <Ionicons name="time-outline" size={18} color="black" />
                  <Text className="pl-2 font-semibold">{selectedMatch.startFormatted} - {selectedMatch.endFormatted}</Text>
                </View>
              </View>

              <View className="flex-row ">
                <View className="w-3/5 text-gray-700 text-md flex-row justify-center items-center pt-1">
                  <Ionicons name="location" size={18} color="black" />
                  <Text className="pl-2 font-semibold">{selectedMatch.pitches?.name ?? 'Bilinmiyor'}</Text>
                </View>
                <View className="w-2/5 text-gray-700 text-md flex-row justify-center items-center pt-1">
                  <Ionicons name="wallet-outline" size={18} color="black" />
                  <Text className="pl-2 font-semibold text-green-600">{selectedMatch.prices} ₺</Text>
                </View>
              </View>

              <View>
                <Text className="text-lg font-semibold text-green-700 text-center my-2">Eksik Kadrolar</Text>
              </View>

              <View className="flex-row max-w-full items-center justify-center mb-2">
                {selectedMatch.missing_groups?.length > 0 && selectedMatch.missing_groups.map((group, index) => {
                  const [position, count] = group.split(':');
                  return (
                    <View key={index} className="flex-row items-center ml-2 border-solid border-2 border-gray-500 rounded-full p-1">
                      <View className={`rounded-full p-1 ${position === 'K' ? 'bg-red-500'
                        : position === 'D' ? 'bg-blue-500'
                          : position === 'O' ? 'bg-green-500'
                            : 'bg-yellow-500'}`}>
                        <Text className="text-white font-bold text-md px-1">{position}</Text>
                      </View>
                      <Text className="ml-2 font-semibold pr-1">x {count}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Maçı Oluşturan kişi Profili */}
              {selectedMatch?.users ? (
                <View className="flex-row max-w-full items-center justify-center mt-2 mb-1">
                  <Text className="font-semibold">Maçı oluşturan: </Text>
                  <TouchableOpacity onPress={() => router.push(`/profile?userId=${selectedMatch.create_user}`)}>
                    <Text className="text-green-600 font-semibold">{selectedMatch.users?.name} {selectedMatch.users?.surname}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View className="h-[1px] bg-gray-600 my-3" />

              {/* HALI SAHA ÖZETİ */}

              <View className="flex-row mb-2 justify-center">
                <Ionicons name="accessibility-outline" size={16} color="green" className="pt-1" />
                <Text className=" h-7 text-xl font-bold text-green-700 "> HALI SAHA ÖZETİ </Text>
              </View>

              {/* 🌍 Harita Buraya Eklendi */}
              {selectedMatch.pitches?.latitude && selectedMatch.pitches?.longitude && (
                <View className="w-full h-48 rounded-lg overflow-hidden my-2">
                  <MapView
                    style={{ width: "100%", height: "100%" }}
                    initialRegion={{
                      latitude: selectedMatch.pitches.latitude,
                      longitude: selectedMatch.pitches.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                  >
                    <Marker
                      coordinate={{
                        latitude: selectedMatch.pitches.latitude,
                        longitude: selectedMatch.pitches.longitude,
                      }}
                      title={selectedMatch.pitches.name}
                    />
                  </MapView>
                </View>
              )}

              <View className="">
                <Text className="h-7 text-xl font-semibold text-green-700 text-center my-2">{selectedMatch.pitches?.name}</Text>
              </View>

              <View className="">
                <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">Açık Adres</Text>
              </View>
              <View className=" text-gray-700 text-md flex-row justify-center items-center pt-1">
                <Ionicons name="location" size={18} color="black" />
                <Text className="pl-2 font-semibold text-gray-700">{selectedMatch.pitches?.address}</Text>
              </View>

              <View className="">
                <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-3 my-2">Saha Ücreti</Text>
              </View>
              <View className=" text-gray-700 text-md flex-row justify-center items-center pt-1">
                <Ionicons name="wallet-outline" size={18} color="green" />
                <Text className="pl-2 font-semibold text-gray-700">{selectedMatch.pitches?.price} ₺</Text>
              </View>

              <View>
                <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-4">Sahanın Özellikleri</Text>
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

              <View className="flex-1 flex-col-reverse justifyy-end items-center">
                <TouchableOpacity className="w-1/2 items-center mt-4 bg-green-700 px-4 py-2 rounded " onPress={handleCloseDetail}>
                  <Text className="text-white font-bold">Geri dön</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </GestureDetector>
      ) : (
        <View className="flex-1">
          {/* KONDİSYONUN Başlığı ve İçeriği */}
          <View className="flex-row mt-3 px-3">
            <Ionicons name="accessibility" size={16} color="green" className="pl-2" />
            <Text className="font-bold text-green-700"> KONDİSYONUN </Text>
          </View>

          <View className="bg-white rounded-lg mx-4 my-2 p-3 shadow-md">
            {/* Progress Bar ve Yüzde */}
            <View className="w-full mb-1 flex-row items-center">
              {/* Progress Bar */}
              <View className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                <View className="bg-green-600 h-full" style={{ width: `${progress}%` }} />
              </View>
              {/* Yüzde */}
              <Text className="pl-2 font-semibold text-base text-green-500">{progress}%</Text>
            </View>

            {/* İkon ve Metin */}
            <View className="flex-row items-center justify-start">
              {/* <Ionicons name="information-circle-outline" size={16} color="black" /> */}
              {/* Dinamik Uyarı Mesajı */}
              {conditionMessage && (
                <View className=''>
                  <Text className={`text-xs font-semibold text-center`} style={{ color: conditionMessageColor }}>
                    {conditionMessage}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* SENİ BEKLEYEN MAÇLAR Başlığı */}
          <View className="flex-row py-3 bg-green-700 px-3">
            <Ionicons name="alarm-outline" size={16} color="white" className="pl-2" />
            <Text className="font-bold text-white "> SENİ BEKLEYEN MAÇLAR </Text>
          </View>

          {/* Kullanıcının oluşturduğu maçlar */}

          {futureMatches.length === 0 ? (
            <View className='flex justify-center items-center'>
              <Text className="text-center font-bold my-4">Oluşturduğun Maç Yok!</Text>
              <TouchableOpacity className="text-center bg-green-600 text-white font-semibold rounded-md px-1 mb-2 items-center" onPress={() => router.push("/create")} >
                <Text className="w-1/2 text-white font-semibold text-center p-3">Hemen Maç Oluştur</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={futureMatches}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMatch}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMatches} />}
              style={{ paddingTop: 2, paddingBottom: 3, maxHeight: futureMatches.length === 1 ? "13.3%" : "27%" }}
              nestedScrollEnabled={true}
            />
          )}

          {/* KADROSU EKSİK MAÇLAR Başlığı */}
          <View className="flex-row px-3 py-3 bg-green-700 ">
            <Ionicons name="alarm-outline" size={16} color="white" className="pl-2" />
            <Text className="font-bold text-white "> KADROSU EKSİK MAÇLAR </Text>
          </View>

          {/* Kullanıcının oluşturmadığı maçlar */}
          {otherMatches.length === 0 ? (
            <View className='flex justify-center items-center'>
              <Text className="text-center font-bold my-4">Başkaları Tarafından Oluşturulan Kadrosu Eksik Maç Yok!</Text>
              <TouchableOpacity className="text-center bg-green-600 text-white font-semibold rounded-md px-1 items-center" onPress={() => router.push("/create")} >
                <Text className="w-1/2 text-white font-semibold text-center p-4">Hemen Maç Oluştur</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={otherMatches}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderMatch}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchMatches} />}
              style={{ paddingTop: 2, paddingBottom: 3 }}
              className="h-auto max-h-[70%]"
            />
          )}
        </View>
      )}
    </GestureHandlerRootView>
  );
}