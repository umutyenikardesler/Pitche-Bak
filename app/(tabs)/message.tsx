import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Animated, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { supabase } from "@/services/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface JoinedMatchSummary {
  id: string; // match id
  title: string;
  date: string;
  time: string;
  owner_id: string;
  owner_name: string;
  owner_surname: string;
  owner_profile_image?: string | null;
  pitches?: { name?: string; districts?: { name?: string } } | null;
  unreadCount?: number;
}

export default function Messages() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<JoinedMatchSummary[]>([]);
  const screenWidth = Dimensions.get('window').width;
  // Mesajlar ekranı için yatay animasyon (0: ekranda, +width: sağa kaymış)
  const [translateX] = useState(new Animated.Value(0));

  const fetchJoinedMatches = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Katılım kabul edilmiş join_request bildirimlerinden sohbetleri topla
      // Hem maça katılan kişi (user_id = current) hem de maç sahibi (user_id = current)
      // için partner her zaman sender_id'deki kullanıcıdır.
      const { data: allData, error } = await supabase
        .from('notifications')
        .select(`
          id,
          match_id,
          created_at,
          sender:users!notifications_sender_id_fkey(id, name, surname, profile_image),
          match:match!notifications_match_id_fkey(id, title, date, time, create_user, pitches(name, districts(name)))
        `)
        .eq('user_id', user.id)
        .eq('type', 'join_request')
        .like('message', '%kabul edildiniz%')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Kullanıcıya gelen okunmamış direct_message bildirimlerini çek (kişi+maç bazında gruplayacağız)
      const { data: unreadNotifs, error: unreadError } = await supabase
        .from('notifications')
        .select(`sender_id, match_id`)
        .eq('user_id', user.id)
        .eq('type', 'direct_message')
        .eq('is_read', false);

      if (unreadError) {
        console.error('[Messages] unread direct_message fetch error:', unreadError);
      }

      const unreadMap = new Map<string, number>();
      (unreadNotifs || []).forEach((n: any) => {
        const key = `${n.sender_id}-${n.match_id || 'null'}`;
        unreadMap.set(key, (unreadMap.get(key) || 0) + 1);
      });

      const summaries: JoinedMatchSummary[] = (allData || [])
        .filter((n: any) => n.match && n.sender && n.sender.id && n.sender.id !== user.id)
        .map((n: any) => {
          const key = `${n.sender.id}-${n.match.id}`;
          return {
            id: n.match.id,
            title: n.match.title,
            date: n.match.date,
            time: n.match.time,
            owner_id: n.sender.id, // sohbet partneri (her zaman diğer kullanıcı)
            owner_name: n.sender.name || '',
            owner_surname: n.sender.surname || '',
            owner_profile_image: n.sender.profile_image || null,
            pitches: n.match?.pitches || null,
            unreadCount: unreadMap.get(key) || 0,
          };
        });

      // Duplicate'leri kaldır (aynı maç + aynı kullanıcı için tek sohbet)
      const uniqueSummaries = summaries.filter((summary, index, self) =>
        index === self.findIndex(s => s.id === summary.id && s.owner_id === summary.owner_id)
      );

      // Sohbetleri sıralama:
      // 1) Mesaj gelen (unreadCount > 0) sohbetler üstte
      // 2) Maç tarihi geçmiş olanlar altta
      // 3) Kalanları en yakın maç tarihi/saatine göre (en yakın üstte)
      const now = new Date();

      const sorted = [...uniqueSummaries].sort((a, b) => {
        const unreadA = (a.unreadCount ?? 0) > 0 ? 1 : 0;
        const unreadB = (b.unreadCount ?? 0) > 0 ? 1 : 0;
        if (unreadA !== unreadB) {
          return unreadB - unreadA; // unread olanlar önce
        }

        const startA = new Date(`${a.date}T${a.time}`);
        const endA = new Date(startA.getTime() + 60 * 60 * 1000); // +1 saat
        const startB = new Date(`${b.date}T${b.time}`);
        const endB = new Date(startB.getTime() + 60 * 60 * 1000);

        const pastA = endA < now ? 1 : 0;
        const pastB = endB < now ? 1 : 0;
        if (pastA !== pastB) {
          return pastA - pastB; // gelecekteki maçlar önce
        }

        // Tarih/saat karşılaştırması (en yakın maç üstte)
        if (startA.getTime() !== startB.getTime()) {
          return startA.getTime() - startB.getTime();
        }

        return 0;
      });

      setItems(sorted);
    } catch (e) {
      console.error('[Messages] fetchJoinedMatches error:', e);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJoinedMatches();
  }, [fetchJoinedMatches]);

  const onRefresh = useCallback(() => {
    fetchJoinedMatches(true);
  }, [fetchJoinedMatches]);

  // Ekran odağa geldiğinde sohbet listesini bir kez tazele (ör: chat ekranından geri dönünce)
  useFocusEffect(
    useCallback(() => {
      fetchJoinedMatches();
      return () => {};
    }, [fetchJoinedMatches])
  );

  // Soldan sağa kaydırarak index sayfasına dön (animasyonlu)
  const handleSwipeBack = useCallback(() => {
    Animated.timing(translateX, {
      toValue: screenWidth,
      duration: 350, // daha yavaş ve belirgin
      useNativeDriver: true,
    }).start(() => {
      router.push("/");
      // Sonraki giriş için pozisyonu sıfırla
      translateX.setValue(0);
    });
  }, [router, screenWidth, translateX]);

  const swipeGesture = Gesture.Pan().onEnd((event) => {
    if (event.translationX > 80) {
      runOnJS(handleSwipeBack)();
    }
  });

  // Realtime: C kullanıcısı Messages ekranındayken A'dan gelen yeni mesajlarda sohbet listesini anlık güncelle
  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      // Sadece current user'a gelen mesaj INSERT'lerini dinle
      channel = supabase
        .channel(`dm-list-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
          () => {
            // Mesaj INSERT olduktan hemen sonra sohbet listesini güncelle
            fetchJoinedMatches(true);
            // Birkaç yüz ms sonra tekrar çek ki notification da kesin oluşmuş olsun (unreadCount doğru gelsin)
            setTimeout(() => {
              fetchJoinedMatches(true);
            }, 300);
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchJoinedMatches]);

  const renderItem = ({ item }: { item: JoinedMatchSummary }) => {
    // Format date and times similar to MyMatches
    const formattedDate = new Date(item.date).toLocaleDateString("tr-TR");
    const [hours, minutes] = item.time.split(":").map(Number);
    const startFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const endFormatted = `${String((hours + 1)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    const hasUnread = (item.unreadCount ?? 0) > 0;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/message/chat', params: { to: item.owner_id, matchId: item.id, name: `${item.owner_name} ${item.owner_surname}` } })}
      >
        <View className={`bg-white rounded-lg mx-4 my-1 p-1 shadow-lg ${hasUnread ? '' : 'opacity-60'}`}>
          <View className="flex-row items-center justify-between">
          {/* Profil Resmi */}
          <View className="w-1/5 flex justify-center p-1 py-1.5">
            <Image
              source={item.owner_profile_image ? { uri: item.owner_profile_image } : require('@/assets/images/ball.png')}
              className="rounded-full mx-auto"
              style={{ width: 60, height: 60, resizeMode: 'contain' }}
            />
          </View>

          {/* Sağ bilgi alanı */}
          <View className="w-4/6 flex justify-center -mt-2 -ml-4">
            <View className="flex-row items-center justify-between">
              <Text className={`text-lg font-semibold ${hasUnread ? 'text-green-700' : 'text-gray-500'}`}>
                {item.owner_name} {item.owner_surname}
              </Text>
              {hasUnread && (
                <View className="ml-2 px-2 py-0.5 rounded-full bg-red-500">
                  <Text className="text-xs font-bold text-white">
                    {item.unreadCount}
                  </Text>
                </View>
              )}
            </View>

            <View className="text-gray-700 text-md flex-row items-center">
              <Ionicons name="calendar-outline" size={18} color="black" />
              <Text className="pl-2 font-semibold"> {formattedDate} →</Text>
              <Text className="pl-2 font-bold text-green-700"> {startFormatted}-{endFormatted} </Text>
            </View>

            <View className="text-gray-700 text-md flex-row items-center pt-1">
              <Ionicons name="location" size={18} color="black" />
              <Text className="pl-2 font-semibold"> {(item.pitches?.districts?.name || 'Bilinmiyor')} →</Text>
              <Text className="pl-2 font-bold text-green-700"> {item.pitches?.name || 'Bilinmiyor'} </Text>
            </View>
          </View>
          {/* Sağdaki ok ikonu (index sayfasındaki gibi) */}
          <View className="mr-1">
            <Ionicons name="chevron-forward-outline" size={20} color="green" />
          </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  let content: JSX.Element;

  if (loading) {
    content = (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  } else if (!items.length) {
    content = (
      <FlatList
        data={[]}
        keyExtractor={() => 'empty'}
        renderItem={null as any}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center" style={{ minHeight: 200 }}>
            <Text className="text-gray-600">
              {t('messages.noAcceptedJoins') || 'Henüz katıldığın maç yok'}
            </Text>
          </View>
        }
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
      />
    );
  } else {
    content = (
      <FlatList
        data={items}
        keyExtractor={(it) => `${it.id}-${it.owner_id}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 16, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
      />
    );
  }

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
        {content}
      </Animated.View>
    </GestureDetector>
  );
}