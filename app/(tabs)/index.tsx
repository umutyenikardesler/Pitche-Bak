import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Dimensions, Modal, TouchableOpacity } from "react-native";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from '@/services/supabase';
import '@/global.css';

import IndexCondition from '@/components/index/IndexCondition';
import MyMatches from '@/components/index/MyMatches';
import OtherMatches from '@/components/index/OtherMatches';
import MatchDetails from '@/components/index/MatchDetails';
import ProfilePreview from '@/components/index/ProfilePreview';
import { Match } from '@/components/index/types';

export default function Index() {
  const [futureMatches, setFutureMatches] = useState<Match[]>([]);
  const [otherMatches, setOtherMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMatchCount, setTotalMatchCount] = useState(0);
  const [myMatchesHeight, setMyMatchesHeight] = useState(0); // Yüksekliği state olarak tut
  const router = useRouter();

  // Dinamik yükseklik hesaplaması - Her render'da yeniden hesaplanır
  const { height } = Dimensions.get('window');
  const itemHeight = 80; // Sabit maç yüksekliği (px)
  const headerHeight = 20; // "SENİ BEKLEYEN MAÇLAR" başlığı yüksekliği
  
  // Yükseklik hesaplama fonksiyonu
  const calculateHeight = useCallback(() => {
    const calculatedHeight = (() => {
      if (futureMatches.length === 0) return headerHeight + 90; // Boş durum için ekstra alan
      if (futureMatches.length === 1) return headerHeight + itemHeight + 22; // 1 maç + padding
      if (futureMatches.length === 2) return headerHeight + (itemHeight * 2) + 25; // 2 maç + padding
      // 3 veya daha fazla maç varsa 2 maç + daha fazla padding + header
      return headerHeight + (itemHeight * 2) + 30; // 80px padding ekledik
    })();
    
    console.log('Yükseklik hesaplandı:', calculatedHeight, 'Maç sayısı:', futureMatches.length);
    setMyMatchesHeight(calculatedHeight);
  }, [futureMatches.length, headerHeight, itemHeight]);

  // Dimensions değişikliklerini dinle
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      // Ekran boyutu değiştiğinde yükseklikleri yeniden hesapla
      calculateHeight();
    });

    return () => subscription?.remove();
  }, [calculateHeight]);

  // State'leri ekleyin
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // URL parametrelerini dinleyin
  const params = useLocalSearchParams();
  const userId = params.userId as string | undefined;

  useEffect(() => {
    if (userId && userId !== 'undefined') {
      setViewingUserId(userId);
      setProfileModalVisible(true);
    } else {
      setViewingUserId(null);
      setProfileModalVisible(false);
    }
  }, [userId]);

  // Modal kapatma fonksiyonu
  const closeProfileModal = useCallback(() => {
    // Önce state'leri sıfırla
    setViewingUserId(null);
    setProfileModalVisible(false);
    // URL parametrelerini temizle
    router.setParams({ userId: undefined });
  }, [router]);

  const fetchMatches = useCallback(async () => {
    setRefreshing(true);
    // Türkiye saati için düzeltme (UTC+3)
    const now = new Date();
    const turkeyOffset = 3; // UTC+3 için offset
    const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const turkeyNow = new Date(utcNow.getTime() + (turkeyOffset * 3600000));
    
    // Bugünün tarihini al (Türkiye saati) - toISOString yerine toLocaleDateString kullan
    const today = turkeyNow.toLocaleDateString('en-CA'); // YYYY-MM-DD formatında
    const currentHours = turkeyNow.getHours();
    const currentMinutes = turkeyNow.getMinutes();
    
    console.log('Türkiye saati (UTC):', turkeyNow.toISOString());
    console.log('Türkiye saati (yerel):', turkeyNow.toString());
    console.log('Bugünün tarihi:', today);
    console.log('Şu anki saat:', currentHours + ':' + currentMinutes);
    console.log('Şu anki zaman (dakika):', currentHours * 60 + currentMinutes);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user.id) {
      console.error("Kullanıcı kimlik doğrulama hatası:", authError);
      setRefreshing(false);
      return;
    }

    const loggedUserId = authData.user.id;

    // Tüm maçları say (kondisyon için)
    const { data: allMatchData, error: allMatchError } = await supabase
      .from("match")
      .select(`id`)
      .eq("create_user", loggedUserId);

    if (!allMatchError) {
      setTotalMatchCount(allMatchData.length);
    }

    // Tüm maçları çek (tarih filtrelemesi yapmadan)
    const { data: matchData, error: matchError } = await supabase
      .from("match")
      .select(`
        id, title, time, date, prices, missing_groups, create_user,
        pitches (name, address, price, features, district_id, latitude, longitude, districts (name)),
        users (id, name, surname, profile_image)
      `)
      .eq("create_user", loggedUserId)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (!matchError) {
      const filteredMatches = matchData?.filter((item) => {
        // Maç tarihini Date objesine çevir
        const matchDate = new Date(item.date);
        const matchDateStr = matchDate.toISOString().split('T')[0];
        
        // Eğer maç bugünden sonraki bir tarihte ise direkt göster
        if (matchDateStr > today) return true;
        
        // Eğer maç bugünden önceki bir tarihte ise kesinlikle gösterme
        if (matchDateStr < today) return false;

        // Bugünkü maçlar için saat kontrolü
        const [matchHours, matchMinutes] = item.time.split(":").map(Number);
        const matchEndHour = matchHours + 1;
        
        // Şu anki zamanı dakika cinsinden hesapla
        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        const matchEndTimeInMinutes = matchEndHour * 60 + matchMinutes;
        
        // Maç bitiş saati şu anki saatten sonra olmalı
        return matchEndTimeInMinutes > currentTimeInMinutes;
      });

      const formattedData = filteredMatches?.map((item) => ({
        ...item,
        formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
        startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
        endFormatted: `${parseInt(item.time.split(":")[0], 10) + 1}:${item.time.split(":")[1]}`,
      })) || [];

      setFutureMatches(formattedData);
      
      // Debug: Filtrelenen maçları göster
      console.log('Filtrelenen maçlar:');
      formattedData.forEach(match => {
        const [matchHours, matchMinutes] = match.time.split(":").map(Number);
        const matchEndHour = matchHours + 1;
        const matchEndTimeInMinutes = matchEndHour * 60 + matchMinutes;
        console.log(`- ${match.date} ${match.time} (bitiş: ${matchEndHour}:${matchMinutes}) - EndTime: ${matchEndTimeInMinutes} > Current: ${currentHours * 60 + currentMinutes}`);
      });
      
      // Maç verisi değiştiğinde yüksekliği güncelleniyor - useEffect ile otomatik
      console.log('Maç verisi yüklendi, maç sayısı:', formattedData.length);
    }

    // Diğer kullanıcıların tüm maçları (tarih filtrelemesi yapmadan)
    const { data: otherMatchData, error: otherMatchError } = await supabase
      .from("match")
      .select(`
        id, title, time, date, prices, missing_groups, create_user,
        pitches (name, price, address, features, district_id, latitude, longitude, districts (name)),
        users (id, name, surname, profile_image)
      `)
      .neq("create_user", loggedUserId)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (!otherMatchError) {
      const filteredOtherMatches = otherMatchData?.filter((item) => {
        // Maç tarihini Date objesine çevir
        const matchDate = new Date(item.date);
        const matchDateStr = matchDate.toISOString().split('T')[0];
        
        // Eğer maç bugünden sonraki bir tarihte ise direkt göster
        if (matchDateStr > today) return true;
        
        // Eğer maç bugünden önceki bir tarihte ise kesinlikle gösterme
        if (matchDateStr < today) return false;

        // Bugünkü maçlar için saat kontrolü
        const [matchHours, matchMinutes] = item.time.split(":").map(Number);
        const matchEndHour = matchHours + 1;
        
        // Şu anki zamanı dakika cinsinden hesapla
        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        const matchEndTimeInMinutes = matchEndHour * 60 + matchMinutes;
        
        // Maç bitiş saati şu anki saatten sonra olmalı
        return matchEndTimeInMinutes > currentTimeInMinutes;
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
  }, []);


  const handleSelectMatch = (match: Match) => {
    setSelectedMatch(match);
  };

  const handleCloseDetail = () => {
    setSelectedMatch(null);
  };

  const handleCreateMatch = () => {
    router.push("/create");
  };

  const swipeGesture = Gesture.Pan().onUpdate((event) => {
    if (event.translationX > 100) {
      runOnJS(handleCloseDetail)();
    }
  });

  useEffect(() => {
    // Component mount olduğunda yükseklikleri ayarla
    const timer = setTimeout(() => {
      calculateHeight();
    }, 200);
    
    return () => clearTimeout(timer);
  }, [calculateHeight]);

  // futureMatches değiştiğinde yüksekliği otomatik güncelle
  useEffect(() => {
    if (futureMatches.length > 0 || myMatchesHeight === 0) {
      console.log('futureMatches değişti, yükseklik güncelleniyor...');
      calculateHeight();
    }
  }, [futureMatches.length, calculateHeight]);

  // Tab değişimlerini dinle - useFocusEffect ile
  useFocusEffect(
    useCallback(() => {
      console.log('Index tab\'ına odaklanıldı - useFocusEffect');
      
      // Tab'a her dönüldüğünde maç verilerini güncelle (pull to refresh gibi)
      // Loading göstergesi için refreshing'i true yap ve state'leri sıfırla
      setRefreshing(true);
      setFutureMatches([]);
      setOtherMatches([]);
      setMyMatchesHeight(0);
      
      // Verileri yükle
      fetchMatches();
      
      return () => { };
    }, [fetchMatches])
  );

  useEffect(() => {
    const checkTimeAndRefresh = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      
      // Saat başı kontrolü (00:00, 01:00, 02:00 vb.)
      if (minutes === 0 && seconds === 0) {
        fetchMatches();
      }
    };
  
    // Her dakika kontrol etmek için interval
    const interval = setInterval(checkTimeAndRefresh, 60000); // 1 dakika
    
    // İlk yüklemede de kontrol et
    checkTimeAndRefresh();
    
    // Temizleme fonksiyonu
    return () => clearInterval(interval);
  }, [fetchMatches]);

  return (
    <GestureHandlerRootView className="flex-1">
      {profileModalVisible && (
        <Modal
          visible={profileModalVisible}
          animationType="slide"
          onRequestClose={closeProfileModal}
          transparent={true}
        >
          <ProfilePreview
            userId={viewingUserId || ''}
            onClose={closeProfileModal}
            isVisible={profileModalVisible}
          />
        </Modal>
      )}
      {selectedMatch ? (
        <GestureDetector gesture={swipeGesture}>
          <MatchDetails match={selectedMatch} onClose={handleCloseDetail} />
        </GestureDetector>
      ) : (
        <View className="flex-1">

          <IndexCondition totalMatchCount={totalMatchCount} />

          {/* MyMatches için dinamik yükseklik */}
          <View 
            style={{ height: myMatchesHeight }}>
            <MyMatches
              matches={futureMatches}
              refreshing={refreshing}
              onRefresh={fetchMatches}
              onSelectMatch={handleSelectMatch}
              onCreateMatch={handleCreateMatch}
            />
          </View>

          {/* OtherMatches kalan alanı doldursun */}
          <View style={{ flex: 1 }}>
            <OtherMatches
              matches={otherMatches}
              refreshing={refreshing}
              onRefresh={fetchMatches}
              onSelectMatch={handleSelectMatch}
              onCreateMatch={handleCreateMatch}
            />
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}