// MatchDetails event listeners hook'u
import { useEffect, useRef } from 'react';
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

    console.log(`[MatchDetails] MatchStatusEventBus dinleyicisi kuruluyor: matchId=${match.id}`);

    const unsubscribe = subscribeMatchStatus(match.id, async (data) => {
      console.log(`[MatchDetails] MatchStatusEventBus event alındı:`, data);

      // Kabul edilen pozisyon
      if (data.acceptedPosition) {
        await fetchMissingRef.current();
        setAcceptedPosition(data.acceptedPosition);
        setSentRequests((prev) => prev.filter((p) => p !== data.acceptedPosition));
        setShownAcceptedPositions((prev) => new Set([...prev, data.acceptedPosition!]));
        console.log(`[MatchDetails] MatchStatusEventBus - acceptedPosition güncellendi: ${data.acceptedPosition}`);
      }

      // Red edilen pozisyon
      if (data.rejectedPosition) {
        console.log(`[MatchDetails] MatchStatusEventBus - rejectedPosition işleniyor: ${data.rejectedPosition}`);
        setAcceptedPosition(null);
        setShownAcceptedPositions((prev) => {
          const newSet = new Set(prev);
          newSet.delete(data.rejectedPosition!);
          return newSet;
        });

        const rejectedMessage = `${getPositionName(data.rejectedPosition)} pozisyonu için maça kabul edilmediniz.`;
        setRejectedPosition({
          position: data.rejectedPosition,
          message: rejectedMessage,
        });
        setSentRequests((prev) => prev.filter((p) => p !== data.rejectedPosition));
        console.log(`[MatchDetails] MatchStatusEventBus - rejectedPosition state güncellendi: ${data.rejectedPosition}`);
      }
    });

    return () => {
      console.log(`[MatchDetails] MatchStatusEventBus dinleyicisi kaldırılıyor: matchId=${match.id}`);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

};

