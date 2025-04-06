import { useEffect, useState, useCallback } from 'react';
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
  const router = useRouter();

  // // Index.tsx içinde
  const { height } = Dimensions.get('window');
  const itemHeight = height * 0.14; // Her maç için yaklaşık yükseklik
  const maxHeight = height * 0.233; // Maksimum yükseklik belirle
  const myMatchesHeight = Math.min(futureMatches.length * itemHeight, maxHeight);

  // State'leri ekleyin
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // URL parametrelerini dinleyin
  const params = useLocalSearchParams();
  const userId = params.userId as string | undefined;

  useEffect(() => {
    if (userId) {
      setViewingUserId(userId as string);
      setProfileModalVisible(true);
    }
  }, [userId]);

  // Modal kapatma fonksiyonu
  const closeProfileModal = () => {
    setProfileModalVisible(false);
    router.setParams({ userId: undefined }); // URL'den parametreyi kaldır
  };

  const fetchMatches = useCallback(async () => {
    setRefreshing(true);
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

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

    // Gelecekteki maçları çek
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

    if (!matchError) {
      const filteredMatches = matchData?.filter((item) => {
        if (item.date > today) return true;

        const [matchHours, matchMinutes] = item.time.split(":").map(Number);
        const matchEndHour = matchHours + 1;

        // Gece yarısı kontrolü (00:00-03:00 arası özel durum)
        if (currentHours >= 0 && currentHours < 3) {
          // Eğer maç gece yarısından sonra bitiyorsa
          if (matchEndHour >= 24) {
            const normalizedEndHour = matchEndHour % 24;
            // Maç bitiş saati şu anki saatten büyükse göster
            return normalizedEndHour > currentHours ||
              (normalizedEndHour === currentHours && matchMinutes > currentMinutes);
          }
          // Normal durum
          return matchEndHour > currentHours ||
            (matchEndHour === currentHours && matchMinutes > currentMinutes);
        }
        // Normal gündüz saatleri
        return matchEndHour > currentHours ||
          (matchEndHour === currentHours && matchMinutes > currentMinutes);
      });

      const formattedData = filteredMatches?.map((item) => ({
        ...item,
        formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
        startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
        endFormatted: `${parseInt(item.time.split(":")[0], 10) + 1}:${item.time.split(":")[1]}`,
      })) || [];

      setFutureMatches(formattedData);
    }

    // Diğer kullanıcıların maçları
    const { data: otherMatchData, error: otherMatchError } = await supabase
      .from("match")
      .select(`
        id, title, time, date, prices, missing_groups, create_user,
        pitches (name, price, address, features, district_id, latitude, longitude, districts (name)),
        users (id, name, surname, profile_image)
      `)
      .neq("create_user", loggedUserId)
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (!otherMatchError) {
      const filteredOtherMatches = otherMatchData?.filter((item) => {
        if (item.date > today) return true;

        const [matchHours, matchMinutes] = item.time.split(":").map(Number);
        const matchEndHour = matchHours + 1;

        // Gece yarısı kontrolü (00:00-03:00 arası özel durum)
        if (currentHours >= 0 && currentHours < 3) {
          // Eğer maç gece yarısından sonra bitiyorsa
          if (matchEndHour >= 24) {
            const normalizedEndHour = matchEndHour % 24;
            return normalizedEndHour > currentHours ||
              (normalizedEndHour === currentHours && matchMinutes > currentMinutes);
          }
          return matchEndHour > currentHours ||
            (matchEndHour === currentHours && matchMinutes > currentMinutes);
        }
        return matchEndHour > currentHours ||
          (matchEndHour === currentHours && matchMinutes > currentMinutes);
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

  useFocusEffect(
    useCallback(() => {
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
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        onRequestClose={closeProfileModal}
      >
        <ProfilePreview
          userId={viewingUserId}
          onClose={closeProfileModal}
        />
      </Modal>
      {selectedMatch ? (
        <GestureDetector gesture={swipeGesture}>
          <MatchDetails match={selectedMatch} onClose={handleCloseDetail} />
        </GestureDetector>
      ) : (
        <View className="flex-1">

          <IndexCondition totalMatchCount={totalMatchCount} />

          {/* MyMatches için dinamik yükseklik hesapla */}
          <View style={{ height: futureMatches.length === 0 ? 'auto' : myMatchesHeight }}>
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