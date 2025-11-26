import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { Match } from "./types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEffect } from "react";
import '@/global.css';
import { supabase } from '@/services/supabase';
import MatchHeader from '@/components/matchDetails/components/MatchHeader';
import MatchInfo from '@/components/matchDetails/components/MatchInfo';
import PositionList from '@/components/matchDetails/components/PositionList';
import StatusMessages from '@/components/matchDetails/components/StatusMessages';
import PitchSummary from '@/components/matchDetails/components/PitchSummary';
import MatchCreator from '@/components/matchDetails/components/MatchCreator';
import Divider from '@/components/matchDetails/components/Divider';
import { useMatchDetailsState } from '@/components/matchDetails/hooks/useMatchDetailsState';
import { useMatchDataFetching } from '@/components/matchDetails/hooks/useMatchDataFetching';
import { useMatchRealtime } from '@/components/matchDetails/hooks/useMatchRealtime';
import { useMatchEventListeners } from '@/components/matchDetails/hooks/useMatchEventListeners';
import { useMatchPositionHandlers } from '@/components/matchDetails/hooks/useMatchPositionHandlers';

interface MatchDetailsProps {
  match: Match;
  onClose: () => void;
  onOpenProfilePreview?: (userId: string) => void;
}

export default function MatchDetails({ match, onClose, onOpenProfilePreview }: MatchDetailsProps) {
  const { t } = useLanguage();
  
  // State yönetimi
  const state = useMatchDetailsState(match);
  const {
    currentUserId,
    sentRequests,
    setSentRequests,
    isLoading,
    setIsLoading,
    acceptedPosition,
    setAcceptedPosition,
    fadeAnim,
    shownAcceptedPositions,
    setShownAcceptedPositions,
    isCancellingPosition,
    setIsCancellingPosition,
    cancelledPositions,
    setCancelledPositions,
    rejectedPosition,
    setRejectedPosition,
    missingGroups,
    setMissingGroups,
    completedPositions,
    setCompletedPositions,
  } = state;

  // Data fetching
  const { fetchMissing, fetchSentRequests, loadAcceptedPositions, loadRejectedPosition } = useMatchDataFetching({
    match,
    currentUserId,
    missingGroups,
    cancelledPositions,
    shownAcceptedPositions,
    setMissingGroups,
    setAcceptedPosition,
    setShownAcceptedPositions,
    setSentRequests,
    setRejectedPosition,
    setCompletedPositions,
  });

  // Realtime subscriptions
  useMatchRealtime({
    match,
    currentUserId,
    isCancellingPosition,
    shownAcceptedPositions,
    setMissingGroups,
    setAcceptedPosition,
    setShownAcceptedPositions,
    setSentRequests,
    setCompletedPositions,
    setRejectedPosition,
    fetchMissing,
  });

  // Event listeners
  useMatchEventListeners({
    match,
    currentUserId,
    setAcceptedPosition,
    setShownAcceptedPositions,
    setSentRequests,
    setRejectedPosition,
    fetchMissing,
  });

  // Position handlers
  const { handlePositionRequest } = useMatchPositionHandlers({
    match,
    currentUserId,
    sentRequests,
    acceptedPosition,
    shownAcceptedPositions,
    rejectedPosition,
    missingGroups,
    setIsLoading,
    setSentRequests,
    setAcceptedPosition,
    setShownAcceptedPositions,
    setMissingGroups,
    setCancelledPositions,
    setIsCancellingPosition,
    setCompletedPositions,
    fetchSentRequests,
  });

  // İlk yüklemede çek
  useEffect(() => {
    fetchMissing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  // Component mount olduğunda sentRequests'i güncelle ve kabul edilen pozisyonları yükle
  useEffect(() => {
    if (currentUserId) {
      setCancelledPositions(new Set());
      setAcceptedPosition(null);
      setShownAcceptedPositions(new Set());
      setRejectedPosition(null);
      fetchSentRequests();
      loadAcceptedPositions();
      loadRejectedPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, match.id]);

  // İlk açılışta (ve kullanıcı değiştiğinde) "Dolu" pozisyonlarını DB'den yükle
  // Senaryo: Maçtaki eksik pozisyon 1 iken kabul edilmiş ve missing_groups'tan düşmüşse,
  // match detayına sonradan girildiğinde de örn. "F Dolu" şeklinde görünmesi için.
  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;

    (async () => {
      try {
        // Güncel missing_groups'u al
        const { data: matchRow, error: matchError } = await supabase
          .from('match')
          .select('missing_groups')
          .eq('id', match.id)
          .single();

        if (matchError) {
          console.error('[MatchDetails] completedPositions match fetch error:', matchError);
          return;
        }

        const missingArr: string[] = Array.isArray(matchRow?.missing_groups)
          ? matchRow!.missing_groups
          : [];
        const missingPositions = new Set(
          missingArr.map((g) => String(g).split(':')[0])
        );

        // Bu kullanıcı için, bu maça ait "kabul edildiniz" join_request bildirimlerini al
        const { data: notifRows, error: notifError } = await supabase
          .from('notifications')
          .select('position')
          .eq('type', 'join_request')
          .eq('match_id', match.id)
          .eq('user_id', currentUserId)
          .ilike('message', '%kabul edildiniz%');

        if (notifError) {
          console.error('[MatchDetails] completedPositions notifications fetch error:', notifError);
          return;
        }

        // Kullanıcının bu maça gönderdiği (ve halen DB'de duran) istekleri al
        // Not: İptal edilen pozisyonların ilgili notification kaydı (sender_id = currentUserId) siliniyor,
        // bu yüzden burada olmayan pozisyonları "Dolu" kabul ETMEYECEĞİZ.
        const { data: requestRows, error: requestError } = await supabase
          .from('notifications')
          .select('position')
          .eq('type', 'join_request')
          .eq('match_id', match.id)
          .eq('sender_id', currentUserId);

        if (requestError) {
          console.error('[MatchDetails] completedPositions requests fetch error:', requestError);
          return;
        }

        const positionsWithRequest = new Set<string>();
        (requestRows || []).forEach((row: any) => {
          if (typeof row.position === 'string' && row.position) {
            positionsWithRequest.add(row.position);
          }
        });

        const completedFromDb = new Set<string>();
        (notifRows || []).forEach((row: any) => {
          const pos = row.position;
          // Sadece:
          // 1) Bu kullanıcı için "kabul edildiniz" bildirimi olan,
          // 2) Halen DB'de bu kullanıcıya ait join_request kaydı bulunan (iptal edilmemiş),
          // 3) Ve missing_groups'ta eksik olarak görünmeyen (gerçekten dolu olan)
          // pozisyonları "Dolu" olarak işaretle.
          if (
            typeof pos === 'string' &&
            pos &&
            positionsWithRequest.has(pos) &&
            !missingPositions.has(pos)
          ) {
            completedFromDb.add(pos);
          }
        });

        if (cancelled || completedFromDb.size === 0) return;

        // Bu noktada, sadece gerçekten geçerli olan "Dolu" pozisyonları biliyoruz.
        // Önceki state'i taşımak yerine, tamamını bu set ile SIFIRDAN kur.
        setCompletedPositions(new Set(completedFromDb));
      } catch (e) {
        console.error('[MatchDetails] completedPositions load error:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, match.id, setCompletedPositions]);

  // Red durumunu periyodik olarak kontrol et (realtime kaçarsa fallback)
  useEffect(() => {
    if (!currentUserId) return;

    // Sadece henüz kabul / red netleşmemişse kontrol et
    const shouldPoll =
      !acceptedPosition && // kabul yok
      !!sentRequests.length; // en az bir gönderilmiş istek var

    if (!shouldPoll) return;

    const interval = setInterval(() => {
      loadRejectedPosition();
    }, 2000); // 2 saniyede bir kontrol et

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId, match.id, acceptedPosition, sentRequests.length]);


  return (
    <ScrollView
      contentContainerStyle={{ 
        flexGrow: 1,
        paddingBottom: 0
      }}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
      bounces={true}
      scrollEnabled={true}
      keyboardShouldPersistTaps="handled"
      removeClippedSubviews={false}
      scrollEventThrottle={16}
      decelerationRate="normal"
      alwaysBounceVertical={false}
      overScrollMode="auto"
    >
      <View className="flex-1 bg-white p-4 rounded-lg m-3 shadow-lg">
        <MatchHeader title={match.title} />
        <MatchInfo match={match} />

        <View>
          <Text className="text-xl font-semibold text-green-700 text-center mt-3">
            {t('home.missingSquads')}
          </Text>
          <Text className="text-base font-semibold text-center mb-2">
            ( Kaleci: <Text className="text-red-500 font-bold">K</Text>, Defans: <Text className="text-blue-700 font-bold">D</Text>, Orta Saha: <Text className="text-green-700 font-bold">O</Text>, Forvet: <Text className="text-yellow-600 font-bold">F</Text> )
          </Text>
        </View>

        <PositionList
          missingGroups={missingGroups}
          sentRequests={sentRequests}
          acceptedPosition={acceptedPosition}
          shownAcceptedPositions={shownAcceptedPositions}
          completedPositions={completedPositions}
          currentUserId={currentUserId}
          matchCreateUser={match.create_user}
          isLoading={isLoading}
          onPositionPress={handlePositionRequest}
        />

        <StatusMessages
          acceptedPosition={acceptedPosition}
          sentRequests={sentRequests}
          rejectedPosition={rejectedPosition}
          missingGroups={missingGroups}
          fadeAnim={fadeAnim}
          currentUserId={currentUserId}
          matchCreateUser={match.create_user}
        />
        {/* Eksik Kadrolar */}

        {match.users && (
          <MatchCreator
            userName={(Array.isArray(match.users) ? match.users[0]?.name : match.users?.name) ?? 'Bilinmiyor'}
            userSurname={(Array.isArray(match.users) ? match.users[0]?.surname : match.users?.surname) ?? ''}
            userId={match.create_user}
            onOpenProfilePreview={onOpenProfilePreview}
          />
        )}

        <Divider />

        <PitchSummary match={match} />

        {/* ScrollView için alt padding - butonun altında kalmaması için */}
        <View className="h-20"></View>
        
        {/* Geri Dön butonu - ScrollView içinde sabit */}
        <View className="absolute bottom-0 left-0 right-0 bg-white py-2 mr-8 ml-1">
          <TouchableOpacity className="w-full items-center bg-green-700 p-3 rounded-lg m-3" onPress={onClose}>
            <Text className="text-white font-bold text-lg">{t('general.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}