// MatchDetails event listeners hook'u
import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { Match } from '@/components/index/types';
import { getPositionName } from '../utils/getPositionName';
import { subscribeMatchStatus } from '../matchStatusEventBus';

interface UseMatchEventListenersProps {
  match: Match;
  currentUserId: string | null;
  setAcceptedPosition: (position: string | null) => void;
  setShownAcceptedPositions: (positions: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSentRequests: (requests: string[] | ((prev: string[]) => string[])) => void;
  setRejectedPosition: (position: { position: string; message: string } | null) => void;
  fetchMissing: () => Promise<void>;
}

export const useMatchEventListeners = ({
  match,
  currentUserId,
  setAcceptedPosition,
  setShownAcceptedPositions,
  setSentRequests,
  setRejectedPosition,
  fetchMissing,
}: UseMatchEventListenersProps) => {
  // fetchMissing'i ref ile tut (closure problemi için)
  const fetchMissingRef = useRef(fetchMissing);
  useEffect(() => {
    fetchMissingRef.current = fetchMissing;
  }, [fetchMissing]);

  // Bildirim kabulü/reddi sonrası lokal event ile tetikleme (global event bus)
  useEffect(() => {
    if (!match.id) {
      console.warn(`[MatchDetails] MatchStatusEventBus dinleyicisi kurulamadı - match.id yok`);
      return;
    }

    // Maçı oluşturan kullanıcı veya henüz oturumu belli olmayan kullanıcı için
    // bu event dinleyicisi kişisel durum mesajı açısından anlamsız;
    // sadece katılım isteği GÖNDEREN kullanıcılar için gerekli.
    if (!currentUserId || currentUserId === match.create_user) {
      return;
    }

    console.log(`[MatchDetails] MatchStatusEventBus dinleyicisi kuruluyor: matchId=${match.id}`);

    const unsubscribe = subscribeMatchStatus(match.id, async (data) => {
      console.log(`[MatchDetails] MatchStatusEventBus event alındı:`, data);

      // Kabul edilen pozisyon
      if (data.acceptedPosition) {
        const positionName = getPositionName(data.acceptedPosition);
        
        // Önce pop-up göster
        Alert.alert(
          "Başarılı",
          `${positionName} olarak maça katılım sağladınız.`,
          [
            {
              text: "Tamam",
              onPress: async () => {
                // Pop-up kapatıldıktan sonra state'i güncelle
                // Kimin kabul edildiğine karar verme işini fetchMissing'e bırakıyoruz.
                // fetchMissing, sadece bu maça gerçekten katılım isteği göndermiş olan
                // kullanıcılar için acceptedPosition state'ini güncelliyor.
                await fetchMissingRef.current();
                console.log(`[MatchDetails] MatchStatusEventBus - acceptedPosition event alındı: ${data.acceptedPosition}`);
              }
            }
          ]
        );
      }

      // Red edilen pozisyon
      if (data.rejectedPosition) {
        const positionName = getPositionName(data.rejectedPosition);
        
        // Pop-up göster (kabul gibi basit)
        Alert.alert(
          "Reddedildi",
          `${positionName} pozisyonu için maça kabul edilmediniz.`,
          [
            {
              text: "Tamam",
              onPress: async () => {
                // Pop-up kapatıldıktan sonra state'i güncelle
                await fetchMissingRef.current();
                console.log(`[MatchDetails] MatchStatusEventBus - rejectedPosition event alındı: ${data.rejectedPosition}`);
              }
            }
          ]
        );
      }
    });

    return () => {
      console.log(`[MatchDetails] MatchStatusEventBus dinleyicisi kaldırılıyor: matchId=${match.id}`);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

};

