// MatchDetails position handlers hook'u
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/services/supabase';
import { Match } from '@/components/index/types';
import { getPositionName } from '../utils/getPositionName';

interface UseMatchPositionHandlersProps {
  match: Match;
  currentUserId: string | null;
  sentRequests: string[];
  acceptedPosition: string | null;
  shownAcceptedPositions: Set<string>;
  rejectedPosition: { position: string; message: string } | null;
  missingGroups: string[];
  setIsLoading: (loading: boolean) => void;
  setSentRequests: (requests: string[] | ((prev: string[]) => string[])) => void;
  setAcceptedPosition: (position: string | null) => void;
  setShownAcceptedPositions: (positions: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setMissingGroups: (groups: string[]) => void;
  setCancelledPositions: (positions: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setIsCancellingPosition: (cancelling: boolean) => void;
  setCompletedPositions: (positions: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  fetchSentRequests: () => Promise<void>;
}

export const useMatchPositionHandlers = ({
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
}: UseMatchPositionHandlersProps) => {
  // Katılım isteği gönder
  const sendJoinRequest = useCallback(async (position: string) => {
    setIsLoading(true);
    try {
      // currentUserId'yi direkt auth'dan al
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserIdFromAuth = user?.id || null;
      
      if (!currentUserIdFromAuth) {
        Alert.alert("Hata", "Kullanıcı bilgisi bulunamadı");
        setIsLoading(false);
        return;
      }
      
      console.log(`[MatchDetails] Katılım isteği gönderiliyor: ${position} - Maç ID: ${match.id}`);
      
      // Sunucuda da mükerrer kontrolü yap
      const { data: existingRequests, error: existingError } = await supabase
        .from('notifications')
        .select('id, position, is_read, message')
        .eq('type', 'join_request')
        .eq('sender_id', currentUserIdFromAuth)
        .eq('match_id', match.id);
      
      if (existingError) {
        console.error(`[MatchDetails] Mevcut istekler kontrol hatası:`, existingError);
      }
      
      if (existingRequests && existingRequests.length > 0) {
        const pendingRequests = existingRequests.filter((req: any) => !req.is_read);
        const acceptedRequests = existingRequests.filter((req: any) => req.is_read && req.message && req.message.includes('kabul edildiniz'));
        const rejectedRequests = existingRequests.filter((req: any) => req.is_read && req.message && req.message.includes('kabul edilmediniz'));
        
        if (pendingRequests.length > 0) {
          const pendingPosition = pendingRequests[0].position;
          Alert.alert("Bilgi", `${getPositionName(pendingPosition)} olarak katılım isteğin zaten gönderilmiş. Sadece 1 pozisyon için istek gönderebilirsiniz.`);
          setIsLoading(false);
          return;
        }
        
        if (acceptedRequests.length > 0) {
          const acceptedPos = acceptedRequests[0].position;
          Alert.alert("Bilgi", `${getPositionName(acceptedPos)} olarak maça katılım sağladınız. Sadece 1 pozisyon için istek gönderebilirsiniz.`);
          setIsLoading(false);
          return;
        }
        
        if (rejectedRequests.length > 0) {
          const rejectedPos = rejectedRequests[0].position;
          Alert.alert("Bilgi", `${getPositionName(rejectedPos)} pozisyonu için daha önce istek gönderdiniz. Sadece 1 pozisyon için istek gönderebilirsiniz.`);
          setIsLoading(false);
          return;
        }
      }

      // Bildirim oluştur
      const notificationData = {
        user_id: match.create_user,
        sender_id: currentUserIdFromAuth,
        message: `${getPositionName(position)} pozisyonunda katılım isteği`,
        type: 'join_request',
        match_id: match.id,
        position: position,
        is_read: false
      };
      
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (notificationError) {
        console.error('[MatchDetails] Bildirim oluşturma hatası:', notificationError);
        throw notificationError;
      }

      setSentRequests(prev => [...prev, position]);
      await fetchSentRequests();

      Alert.alert(
        "Başarılı",
        `${getPositionName(position)} olarak maça katılma istediğin gönderildi.`,
        [{ text: "Tamam" }]
      );

    } catch (error) {
      console.error('[MatchDetails] Katılım isteği gönderme hatası:', error);
      Alert.alert("Hata", "Katılım isteği gönderilemedi. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  }, [match.id, match.create_user, setIsLoading, setSentRequests, fetchSentRequests]);

  // Katılım isteğini iptal et
  const cancelJoinRequest = useCallback(async (position: string) => {
    setIsLoading(true);
    try {
      console.log(`[MatchDetails] Katılım isteği iptal ediliyor: ${position} - Maç ID: ${match.id}`);
      
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('type', 'join_request')
        .eq('sender_id', currentUserId)
        .eq('match_id', match.id)
        .eq('position', position);

      if (deleteError) {
        console.error('[MatchDetails] Bildirim silme hatası:', deleteError);
        throw deleteError;
      }

      setSentRequests(prev => prev.filter(p => p !== position));
      await fetchSentRequests();

      Alert.alert(
        "İptal Edildi",
        `${getPositionName(position)} pozisyonundaki katılım isteğin iptal edildi.`,
        [{ text: "Tamam" }]
      );

    } catch (error) {
      console.error('[MatchDetails] Katılım isteği iptal etme hatası:', error);
      Alert.alert("Hata", "Katılım isteği iptal edilemedi. Lütfen tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  }, [match.id, currentUserId, setIsLoading, setSentRequests, fetchSentRequests]);

  // Kabul edilen pozisyonu iptal et
  const cancelAcceptedPosition = useCallback(async (position: string) => {
    setIsLoading(true);
    try {
      console.log(`[MatchDetails] cancelAcceptedPosition START - pozisyon: ${position} - matchId: ${match.id}`);

      // 1) ÖNCE LOCAL STATE'İ GÜNCELLE (kullanıcı D x 1'i hemen görsün)
      const localGroups: string[] = [...missingGroups];
      const localIndex = localGroups.findIndex((g) => g.startsWith(position + ':'));
      if (localIndex !== -1) {
        const [pos, count] = localGroups[localIndex].split(':');
        const newCount = parseInt(count, 10) + 1;
        localGroups[localIndex] = `${pos}:${newCount}`;
      } else {
        localGroups.push(`${position}:1`);
      }
      setMissingGroups(localGroups);
      setAcceptedPosition(null);
      setShownAcceptedPositions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(position);
        return newSet;
      });
      setCompletedPositions((prev) => {
        const next = new Set(prev);
        next.delete(position);
        return next;
      });
      setCancelledPositions((prev) => new Set([...prev, position]));
      setIsCancellingPosition(true);

      // En güncel missing_groups'u direkt DB'den al ve güncelle
      const { data: matchRow, error: matchError } = await supabase
        .from('match')
        .select('missing_groups')
        .eq('id', match.id)
        .single();

      if (matchError) {
        console.error('[MatchDetails] cancelAcceptedPosition match fetch error:', matchError);
        throw matchError;
      }

      const currentGroups: string[] = Array.isArray(matchRow?.missing_groups)
        ? matchRow!.missing_groups
        : [];

      console.log('[MatchDetails] cancelAcceptedPosition - currentGroups (DBden gelen missing_groups):', currentGroups);

      const updatedGroups: string[] = [...currentGroups];
      const existingGroupIndex = updatedGroups.findIndex((g) => g.startsWith(position + ':'));

      if (existingGroupIndex !== -1) {
        const [pos, count] = updatedGroups[existingGroupIndex].split(':');
        const newCount = parseInt(count, 10) + 1;
        updatedGroups[existingGroupIndex] = `${pos}:${newCount}`;
      } else {
        // Hiç yoksa tekrar 1 eksik olarak ekle
        updatedGroups.push(`${position}:1`);
      }

      console.log('[MatchDetails] cancelAcceptedPosition - updatedGroups (DBye yazılacak missing_groups):', updatedGroups);

      // 2) DB'yi sync etmeye çalış (RLS izin veriyorsa)
      console.log('[MatchDetails] cancelAcceptedPosition - match tablosu update ediliyor...');
      const { data: updatedMatchRows, error: updateMatchError } = await supabase
        .from('match')
        .update({ missing_groups: updatedGroups })
        .eq('id', match.id);

      if (updateMatchError) {
        console.error('[MatchDetails] cancelAcceptedPosition - match update hatası (muhtemel RLS):', updateMatchError);
        throw updateMatchError;
      }

      console.log('[MatchDetails] cancelAcceptedPosition - match update SUCCESS, dönen satırlar:', updatedMatchRows);

      // Güncellemeden sonra, gerçekten DB'de ne olduğunu tekrar oku ve hem logla hem state'e yaz
      const { data: verifyRow, error: verifyError } = await supabase
        .from('match')
        .select('missing_groups')
        .eq('id', match.id)
        .single();

      if (verifyError) {
        console.error('[MatchDetails] cancelAcceptedPosition - verify select hatası:', verifyError);
      } else {
        console.log(
          '[MatchDetails] cancelAcceptedPosition - verify missing_groups (DB gerçekte ne durumda):',
          verifyRow?.missing_groups
        );
        // UI şu an local state üzerinden zaten doğru durumda; 
        // DB senkronu sadece logluyoruz, state'i zorla geri almıyoruz.
      }

      const { data: { user } } = await supabase.auth.getUser();
      const currentUserIdFromAuth = user?.id || null;
      
      if (!currentUserIdFromAuth) {
        Alert.alert("Hata", "Kullanıcı bilgisi bulunamadı");
        setIsLoading(false);
        return;
      }

      console.log('[MatchDetails] cancelAcceptedPosition - notifications join_request delete çağrılıyor, sender_id:', currentUserIdFromAuth);
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('type', 'join_request')
        .eq('sender_id', currentUserIdFromAuth)
        .eq('match_id', match.id)
        .eq('position', position);

      if (deleteError) {
        console.error('[MatchDetails] cancelAcceptedPosition - notifications delete hatası:', deleteError);
        throw deleteError;
      }

      Alert.alert(
        "İptal Edildi",
        `${getPositionName(position)} pozisyonundaki katılımınız iptal edildi. Yeni pozisyon seçebilirsiniz.`,
        [{ text: "Tamam" }]
      );

      setTimeout(() => {
        setIsCancellingPosition(false);
      }, 15000);

    } catch (error) {
      console.error('[MatchDetails] cancelAcceptedPosition CATCH - hata:', error);
      Alert.alert("Hata", "Pozisyon iptal edilemedi. Lütfen tekrar deneyin.");
      setIsCancellingPosition(false);
    } finally {
      setIsLoading(false);
    }
  }, [match.id, missingGroups, setIsLoading, setMissingGroups, setAcceptedPosition, setShownAcceptedPositions, setCompletedPositions, setCancelledPositions, setIsCancellingPosition]);

  // Katılım isteği gönder veya iptal et
  const handlePositionRequest = useCallback(async (position: string) => {
    if (!currentUserId) {
      Alert.alert("Hata", "Kullanıcı bilgisi bulunamadı");
      return;
    }

    if (currentUserId === match.create_user) {
      Alert.alert("Bilgi", "Kendi oluşturduğunuz maça katılım isteği gönderemezsiniz");
      return;
    }

    // Eğer bu pozisyon için zaten istek gönderilmişse, iptal et
    if (sentRequests.includes(position)) {
      await cancelJoinRequest(position);
      return;
    }

    // Eğer bu pozisyon kabul edilmişse, iptal et
    if (acceptedPosition === position || shownAcceptedPositions.has(position)) {
      console.log(`[MatchDetails] Kabul edilen pozisyon iptal ediliyor: ${position}`);
      await cancelAcceptedPosition(position);
      return;
    }

    // Başka bir pozisyon için istek gönderilmişse, kabul edilmişse veya red edilmişse uyar
    if (sentRequests.length > 0 || acceptedPosition || shownAcceptedPositions.size > 0 || rejectedPosition) {
      Alert.alert("Bilgi", "Bu maça zaten katılım sağladınız veya katılım isteği gönderdiniz. Sadece 1 pozisyon için istek gönderebilirsiniz.");
      return;
    }

    await sendJoinRequest(position);
  }, [currentUserId, match.create_user, sentRequests, acceptedPosition, shownAcceptedPositions, rejectedPosition, sendJoinRequest, cancelJoinRequest, cancelAcceptedPosition]);

  return {
    handlePositionRequest,
  };
};

