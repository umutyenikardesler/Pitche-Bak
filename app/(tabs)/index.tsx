import { useState, useCallback } from 'react';
import { View } from "react-native";
import { GestureHandlerRootView, GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter, useFocusEffect } from "expo-router";
import { supabase } from '@/services/supabase';
import IndexCondition from '@/components/index/IndexCondition';
import MyMatches from '@/components/index/MyMatches';
import OtherMatches from '@/components/index/OtherMatches';
import MatchDetails from '@/components/index/MatchDetails';
import { Match } from '@/components/index/types';

export default function Index() {
  const [futureMatches, setFutureMatches] = useState<Match[]>([]);
  const [otherMatches, setOtherMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMatchCount, setTotalMatchCount] = useState(0);
  const router = useRouter();

  const fetchMatches = useCallback(async () => {
    setRefreshing(true);
    const today = new Date().toISOString().split("T")[0];
    const currentHours = new Date().getHours();
    const currentMinutes = new Date().getMinutes();

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
        return matchHours + 1 > currentHours || 
               (matchHours + 1 === currentHours && matchMinutes > currentMinutes);
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
        id, title, time, date, prices, missing_groups,
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
      return () => {};
    }, [fetchMatches])
  );

  return (
    <GestureHandlerRootView className="flex-1">
      {selectedMatch ? (
        <GestureDetector gesture={swipeGesture}>
          <MatchDetails match={selectedMatch} onClose={handleCloseDetail} />
        </GestureDetector>
      ) : (
        <View className="flex-1">

          <IndexCondition totalMatchCount={totalMatchCount} />
          
          <MyMatches 
            matches={futureMatches} 
            refreshing={refreshing} 
            onRefresh={fetchMatches}
            onSelectMatch={handleSelectMatch}
            onCreateMatch={handleCreateMatch}
          />
          
          <OtherMatches 
            matches={otherMatches} 
            refreshing={refreshing} 
            onRefresh={fetchMatches}
            onSelectMatch={handleSelectMatch}
            onCreateMatch={handleCreateMatch}
          />
        </View>
      )}
    </GestureHandlerRootView>
  );
}