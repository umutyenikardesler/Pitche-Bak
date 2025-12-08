// MatchDetails realtime subscriptions hook'u
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/services/supabase';
import { Match } from '@/components/index/types';
import { getPositionName } from '../utils/getPositionName';

interface UseMatchRealtimeProps {
  match: Match;
  currentUserId: string | null;
  isCancellingPosition: boolean;
  shownAcceptedPositions: Set<string>;
  setMissingGroups: (groups: string[]) => void;
  setAcceptedPosition: (position: string | null) => void;
  setShownAcceptedPositions: (positions: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSentRequests: (requests: string[] | ((prev: string[]) => string[])) => void;
  setCompletedPositions: (positions: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setRejectedPosition: (position: { position: string; message: string } | null) => void;
  fetchMissing: () => Promise<void>;
}

export const useMatchRealtime = ({
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
}: UseMatchRealtimeProps) => {
  // fetchMissing'i ref ile tut (closure problemi için)
  const fetchMissingRef = useRef(fetchMissing);
  useEffect(() => {
    fetchMissingRef.current = fetchMissing;
  }, [fetchMissing]);

  // Realtime: match tablosundaki bu maça ait değişiklikleri dinle
  useEffect(() => {
    const channel = supabase
      .channel(`match-updates-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match',
          filter: `id=eq.${match.id}`,
        },
        async (payload: any) => {
          console.log(`[MatchDetails] Realtime tetiklendi:`, payload);
          const oldGroups = payload?.old?.missing_groups || [];
          const newGroups = payload?.new?.missing_groups || [];
          
          if (Array.isArray(newGroups)) {
            console.log(`[MatchDetails] Realtime missing_groups güncellendi:`, {
              eski: oldGroups,
              yeni: newGroups
            });
            setMissingGroups(newGroups);
            
            // Eğer pozisyon iptal ediliyorsa hiçbir şey yapma
            if (isCancellingPosition) {
              console.log(`[MatchDetails] Realtime: Pozisyon iptal ediliyor, başarı mesajı kontrolü atlanıyor`);
              return;
            }
            
            // Pozisyon sayısı azalan pozisyonları bul (kabul edilme)
            const decreasedPositions: string[] = [];
            const newlyCompletedPositions: string[] = [];
            
            oldGroups.forEach((oldGroup: string) => {
              const [position, oldCount] = oldGroup.split(':');
              const newGroup = newGroups.find(g => g.startsWith(position + ':'));
              if (newGroup) {
                const [, newCount] = newGroup.split(':');
                const newCountNum = parseInt(newCount);
                const oldCountNum = parseInt(oldCount);
                
                if (newCountNum < oldCountNum) {
                  decreasedPositions.push(position);
                  // Eğer pozisyon 0'a düştüyse tamamlanan pozisyonlara ekle
                  if (newCountNum === 0) {
                    newlyCompletedPositions.push(position);
                  }
                }
              } else {
                // Pozisyon tamamen kaybolmuş (0'a düşmüş)
                decreasedPositions.push(position);
                newlyCompletedPositions.push(position);
              }
            });
            
            // Tamamlanan pozisyonları state'e ekle
            if (newlyCompletedPositions.length > 0) {
              setCompletedPositions(prev => {
                const newSet = new Set(prev);
                newlyCompletedPositions.forEach(pos => newSet.add(pos));
                return newSet;
              });
            }
            
            console.log(`[MatchDetails] Realtime azalan pozisyonlar (Kabul):`, decreasedPositions);
            console.log(`[MatchDetails] Realtime tamamlanan pozisyonlar:`, newlyCompletedPositions);
            
            // Eğer pozisyon sayısı azaldıysa başarı mesajını göster
            // ANCAK sadece kullanıcının isteği GERÇEKTEN kabul edildiyse göster
            if (decreasedPositions.length > 0) {
              // currentUserId'yi al
              const { data: { user } } = await supabase.auth.getUser();
              const currentUserIdFromAuth = user?.id || null;
              
              if (currentUserIdFromAuth && currentUserIdFromAuth !== match.create_user) {
                // ÖNEMLİ: Sadece "kabul edildiniz" mesajı olan bildirimleri kontrol et
                // Red edildiğinde missing_groups değişmez, ama başka nedenlerle değişebilir
                const { data: acceptedNotificationsData } = await supabase
                  .from('notifications')
                  .select('position, message')
                  .eq('type', 'join_request')
                  .eq('user_id', currentUserIdFromAuth) // Bildirim alan kişi (istek gönderen)
                  .eq('match_id', match.id)
                  .like('message', '%kabul edildiniz%') // Sadece kabul mesajları
                  .order('created_at', { ascending: false })
                  .limit(10);
                
                const acceptedPositionsFromNotifications = (acceptedNotificationsData || [])
                  .map((row: any) => row.position)
                  .filter((p: any) => typeof p === 'string' && p);
                
                console.log(`[MatchDetails] Realtime: Kabul edilen pozisyonlar (bildirimlerden): ${acceptedPositionsFromNotifications.join(', ')}`);
                console.log(`[MatchDetails] Realtime: Azalan pozisyonlar: ${decreasedPositions.join(', ')}`);
                
                // Sadece hem azalan hem de kabul bildirimi olan pozisyonları göster
                const trulyAcceptedPositions = decreasedPositions.filter(pos => 
                  acceptedPositionsFromNotifications.includes(pos)
                );
                
                if (trulyAcceptedPositions.length > 0) {
                  const acceptedPositionToShow = trulyAcceptedPositions[0];
                  if (!shownAcceptedPositions.has(acceptedPositionToShow)) {
                    console.log(`[MatchDetails] Realtime başarı mesajı gösterilecek (kabul edildi): ${acceptedPositionToShow}`);
                    const positionName = getPositionName(acceptedPositionToShow);
                    
                    // Önce popup göster
                    Alert.alert(
                      "Başarılı",
                      `🎉 ${positionName} olarak maça katılım sağladınız!`,
                      [
                        {
                          text: "Tamam",
                          onPress: () => {
                            // Popup kapatıldıktan sonra state güncelle
                            setAcceptedPosition(acceptedPositionToShow);
                            setShownAcceptedPositions(prev => new Set([...prev, acceptedPositionToShow]));
                            setSentRequests(prev => prev.filter(p => p !== acceptedPositionToShow));
                          }
                        }
                      ]
                    );
                  }
                } else {
                  console.log(`[MatchDetails] Realtime: Pozisyon azaldı ama kabul bildirimi yok, mesaj gösterilmeyecek`);
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch (_) {}
    };
  }, [match.id, match.create_user, isCancellingPosition, shownAcceptedPositions, setMissingGroups, setAcceptedPosition, setShownAcceptedPositions, setSentRequests, setCompletedPositions]);

  // Realtime fallback - her 10 saniyede bir kontrol et (daha az sıklıkla)
  useEffect(() => {
    const interval = setInterval(async () => {
      // Eğer pozisyon iptal ediliyorsa fallback çalışmasın
      if (isCancellingPosition) {
        return;
      }
      // Log'u kaldırdık - gereksiz log spam'ini önlemek için
      await fetchMissingRef.current();
    }, 10000); // 3 saniye yerine 10 saniye
    
    return () => clearInterval(interval);
  }, [match.id, isCancellingPosition]);

  // Notifications tablosunu realtime ile dinle (red bildirimleri için)
  useEffect(() => {
    let mounted = true;
    let channel: any = null;
    
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      channel = supabase
        .channel(`notifications-reject-${match.id}-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            // Sadece user_id ile filtrele; match_id ve type kontrolünü handler içinde yap
            filter: `user_id=eq.${user.id}`,
          },
          async (payload: any) => {
            if (!mounted) return;
            const newNotification = payload.new;
            console.log(`[MatchDetails] Yeni bildirim geldi:`, newNotification);

            // Sadece bu maça ait join_request bildirimlerini işle
            if (
              newNotification.match_id !== match.id ||
              newNotification.type !== 'join_request'
            ) {
              return;
            }

            // Red mesajı mı? - Popup EventBus'ta gösteriliyor, burada sadece state güncelle
            if (
              newNotification.message &&
              (newNotification.message.includes('kabul edilmediniz') ||
                newNotification.message.includes('reddedildi'))
            ) {
              console.log(`[MatchDetails] Red bildirimi tespit edildi (realtime):`, newNotification);
              // State güncellemesi fetchMissing ile yapılıyor
              await fetchMissingRef.current();
            }
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) {
        try { supabase.removeChannel(channel); } catch (_) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id, currentUserId]);
};

