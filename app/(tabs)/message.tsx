import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
}

export default function Messages() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<JoinedMatchSummary[]>([]);

  const fetchJoinedMatches = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Katılım kabul edilmiş bildirimler üzerinden maç ve sahibi bilgilerini topla
      const { data, error } = await supabase
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
        .like('message', '%kabul edildi%')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const summaries: JoinedMatchSummary[] = (data || [])
        .filter((n: any) => n.match && n.match.create_user)
        .map((n: any) => ({
          id: n.match.id,
          title: n.match.title,
          date: n.match.date,
          time: n.match.time,
          owner_id: n.match.create_user,
          owner_name: n.sender?.name || '',
          owner_surname: n.sender?.surname || '',
          owner_profile_image: n.sender?.profile_image || null,
          pitches: n.match?.pitches || null,
        }));

      setItems(summaries);
    } catch (e) {
      console.error('[Messages] fetchJoinedMatches error:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJoinedMatches();
  }, [fetchJoinedMatches]);

  const renderItem = ({ item }: { item: JoinedMatchSummary }) => {
    // Format date and times similar to MyMatches
    const formattedDate = new Date(item.date).toLocaleDateString("tr-TR");
    const [hours, minutes] = item.time.split(":").map(Number);
    const startFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const endFormatted = `${String((hours + 1)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push({ pathname: '/message/chat', params: { to: item.owner_id, matchId: item.id, name: `${item.owner_name} ${item.owner_surname}` } })}
      >
        <View className="bg-white rounded-lg mx-4 my-1 p-1 shadow-lg">
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
              <Text className="text-lg text-green-700 font-semibold">
                {item.owner_name} {item.owner_surname}
              </Text>
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

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (!items.length) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-600">{t('messages.noAcceptedJoins') || 'Henüz katıldığın maç yok'}</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.id}
      renderItem={renderItem}
      contentContainerStyle={{ paddingBottom: 16, paddingTop: 8 }}
    />
  );
}