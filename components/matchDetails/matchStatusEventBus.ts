// Basit global event bus - MatchDetails ile Notifications arasında iletişim için

type MatchStatusEvent = {
  acceptedPosition?: string | null;
  rejectedPosition?: string | null;
};

type Listener = (data: MatchStatusEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export const subscribeMatchStatus = (matchId: string, listener: Listener) => {
  if (!listeners.has(matchId)) {
    listeners.set(matchId, new Set());
  }
  listeners.get(matchId)!.add(listener);

  // Unsubscribe fonksiyonu
  return () => {
    const set = listeners.get(matchId);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) {
      listeners.delete(matchId);
    }
  };
};

export const emitMatchStatus = (matchId: string, data: MatchStatusEvent) => {
  const set = listeners.get(matchId);
  if (!set) return;
  set.forEach((listener) => {
    try {
      listener(data);
    } catch (e) {
      console.error('[MatchStatusEventBus] Listener error:', e);
    }
  });
};


