// MatchDetails data fetching hook'u
import { useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/services/supabase';
import { Match } from '@/components/index/types';
import { getPositionName } from '../utils/getPositionName';

interface UseMatchDataFetchingProps {
  match: Match;
  currentUserId: string | null;
  missingGroups: string[];
  cancelledPositions: Set<string>;
  shownAcceptedPositions: Set<string>;
  setMissingGroups: (groups: string[]) => void;
  setAcceptedPosition: (position: string | null) => void;
  setShownAcceptedPositions: (positions: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSentRequests: (requests: string[] | ((prev: string[]) => string[])) => void;
  setRejectedPosition: (position: { position: string; message: string } | null) => void;
  setCompletedPositions: (positions: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
}

export const useMatchDataFetching = ({
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
}: UseMatchDataFetchingProps) => {
  // Güncel state değerlerini ref ile tut (closure problemi için)
  const missingGroupsRef = useRef(missingGroups);
  const cancelledPositionsRef = useRef(cancelledPositions);
  const shownAcceptedPositionsRef = useRef(shownAcceptedPositions);

  useEffect(() => {
    missingGroupsRef.current = missingGroups;
    cancelledPositionsRef.current = cancelledPositions;
    shownAcceptedPositionsRef.current = shownAcceptedPositions;
  }, [missingGroups, cancelledPositions, shownAcceptedPositions]);

  // Ortak fetch fonksiyonu - realtime ve event listener için
  const fetchMissing = useCallback(async () => {
    try {
      // Log'ları azalttık - sadece önemli durumlarda log
      
      // currentUserId'yi tekrar al
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserIdFromAuth = user?.id || null;
      
      // Tüm maç verilerini çek (cache bypass için)
      const { data, error } = await supabase
        .from('match')
        .select('missing_groups')
        .eq('id', match.id)
        .single();
      
      if (error) {
        console.error(`[MatchDetails] fetchMissing hatası:`, error);
        return;
      }
      
      if (Array.isArray(data?.missing_groups)) {
        const oldGroups = missingGroupsRef.current;
        const newGroups = data.missing_groups;
        
        // Pozisyon sayısı azalan ve/veya tamamen dolan pozisyonları bul
        const decreasedPositions: string[] = [];
        const newlyCompletedPositions: string[] = [];

        oldGroups.forEach(oldGroup => {
          const [position, oldCountStr] = oldGroup.split(':');
          const oldCount = parseInt(oldCountStr, 10);
          const newGroup = newGroups.find(g => g.startsWith(position + ':'));

          if (newGroup) {
            const [, newCountStr] = newGroup.split(':');
            const newCount = parseInt(newCountStr, 10);

            if (newCount < oldCount) {
              decreasedPositions.push(position);
            }
            // Güvenlik için, eğer yeni değer 0 ise "Doldu" olarak işaretle
            if (newCount === 0) {
              newlyCompletedPositions.push(position);
            }
          } else {
            // Pozisyon tamamen kaybolmuş (sayı 0'a düşmüş) → Doldu
            decreasedPositions.push(position);
            newlyCompletedPositions.push(position);
          }
        });
        
        // Eğer iptal edilen pozisyonlar varsa, onları da güncelle
        if (cancelledPositionsRef.current.size > 0) {
          // İptal edilen pozisyonları missingGroups'a ekle
          const updatedGroupsWithCancelled = [...newGroups];
          cancelledPositionsRef.current.forEach(pos => {
            const existingGroup = updatedGroupsWithCancelled.find(g => g.startsWith(pos + ':'));
            if (existingGroup) {
              const [position, count] = existingGroup.split(':');
              const newCount = parseInt(count, 10) + 1;
              const index = updatedGroupsWithCancelled.indexOf(existingGroup);
              updatedGroupsWithCancelled[index] = `${position}:${newCount}`;
            } else {
              updatedGroupsWithCancelled.push(`${pos}:1`);
            }
          });
          setMissingGroups(updatedGroupsWithCancelled);
        } else {
          // Eğer iptal edilen pozisyon yoksa, sadece yeni grupları kullan
          // Sadece değişiklik varsa güncelle (gereksiz re-render'ı önlemek için)
          if (JSON.stringify(oldGroups) !== JSON.stringify(newGroups)) {
            setMissingGroups(newGroups);
          }
        }

        // Eğer tamamen dolan pozisyonlar varsa, bunları completedPositions set'ine ekle
        // Ancak iptal edilmiş (cancelledPositions) pozisyonları hariç tut
        if (newlyCompletedPositions.length > 0) {
          const effectiveCompleted = newlyCompletedPositions.filter(
            (pos) => !cancelledPositionsRef.current.has(pos)
          );

          if (effectiveCompleted.length > 0) {
            setCompletedPositions((prev) => {
              const next = new Set(prev);
              effectiveCompleted.forEach((pos) => next.add(pos));
              return next;
            });
          }
        }
        
        // Eğer pozisyon sayısı azaldıysa ve kullanıcının gönderdiği istek varsa başarı mesajını göster
        if (decreasedPositions.length > 0 && currentUserIdFromAuth && currentUserIdFromAuth !== match.create_user) {
          console.log(`[MatchDetails] Azalan pozisyonlar: ${decreasedPositions.join(', ')}`);
          
          // İptal edilen pozisyonları kontrol et
          const nonCancelledPositions = decreasedPositions.filter(pos => !cancelledPositionsRef.current.has(pos));
          console.log(`[MatchDetails] İptal edilmemiş pozisyonlar: ${nonCancelledPositions.join(', ')}`);
          
          if (nonCancelledPositions.length === 0) {
            console.log(`[MatchDetails] Tüm azalan pozisyonlar iptal edilmiş, başarı mesajı gösterilmiyor`);
            return;
          }
          
          // Önce güncel sentRequests'i al (hem okunmuş hem okunmamış)
          const { data: currentSentData } = await supabase
            .from('notifications')
            .select('position, is_read')
            .eq('type', 'join_request')
            .eq('sender_id', currentUserIdFromAuth)
            .eq('match_id', match.id)
            .order('created_at', { ascending: false })
            .limit(5);
          
          console.log(`[MatchDetails] Database'den gelen notifications:`, currentSentData);
          
          // Bu kullanıcı bu maç için hiç katılım isteği göndermediyse
          // kişisel kabul/red durumu göstermiyoruz
          if (!currentSentData || currentSentData.length === 0) {
            console.log('[MatchDetails] Kullanıcının bu maç için gönderilmiş katılım isteği yok, durum mesajı gösterilmeyecek.');
            return;
          }
          
          // Azalan pozisyonlardan kullanıcının gönderdiği istekleri bul
          const allSentPositions = (currentSentData || [])
            .map((row: any) => row.position)
            .filter((p: any) => typeof p === 'string');
            
          console.log(`[MatchDetails] Database'deki tüm sent positions: ${allSentPositions.join(', ')}`);
          
          const acceptedPositions = nonCancelledPositions.filter(pos => allSentPositions.includes(pos));
          
          console.log(`[MatchDetails] Kabul edilen pozisyonlar: ${acceptedPositions.join(', ')}`);
          
          if (acceptedPositions.length > 0) {
            // İlk kabul edilen pozisyonu göster
            const acceptedPositionToShow = acceptedPositions[0];
            
            // Eğer bu pozisyon daha önce gösterildiyse tekrar gösterme
            if (shownAcceptedPositionsRef.current.has(acceptedPositionToShow)) {
              console.log(`[MatchDetails] Pozisyon ${acceptedPositionToShow} daha önce gösterildi, tekrar gösterme`);
              return;
            }
            
            console.log(`[MatchDetails] Başarı mesajı gösterilecek pozisyon: ${acceptedPositionToShow}`);
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
                    // Gösterilen pozisyonları kaydet
                    setShownAcceptedPositions(prev => new Set([...prev, acceptedPositionToShow]));
                    
                    // sentRequests'i güncelle - kabul edilen pozisyonu kaldır
                    setSentRequests(prev => {
                      const filtered = prev.filter(p => p !== acceptedPositionToShow);
                      console.log(`[MatchDetails] sentRequests güncelleniyor: ${prev} -> ${filtered}`);
                      return filtered;
                    });
                  }
                }
              ]
            );
          } else {
            // Eğer acceptedPositions boşsa ama decreasedPositions varsa, 
            // bu pozisyonu zaten kabul edilmiş olarak işaretle
            console.log(`[MatchDetails] acceptedPositions boş, ama decreasedPositions var. Pozisyon zaten kabul edilmiş olabilir.`);
            const acceptedPositionToShow = nonCancelledPositions[0];
            
            if (!shownAcceptedPositionsRef.current.has(acceptedPositionToShow)) {
              console.log(`[MatchDetails] Pozisyon ${acceptedPositionToShow} kabul edilmiş olarak işaretleniyor`);
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
                    }
                  }
                ]
              );
            }
          }
        }
      } else {
        console.log(`[MatchDetails] missing_groups array değil:`, data?.missing_groups);
      }
    } catch (error) {
      console.error(`[MatchDetails] fetchMissing catch hatası:`, error);
    }
  }, [match.id, match.create_user]);

  // Gönderilmiş istekleri getir (hem okunmuş hem okunmamış)
  const fetchSentRequests = useCallback(async () => {
    try {
      // currentUserId'yi direkt auth'dan al
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserIdFromAuth = user?.id || null;
      
      if (!currentUserIdFromAuth) {
        console.log(`[MatchDetails] fetchSentRequests - currentUserId yok: ${currentUserIdFromAuth}`);
        return;
      }
      
      console.log(`[MatchDetails] fetchSentRequests çağrıldı - User: ${currentUserIdFromAuth}, Match: ${match.id}`);
      const { data, error } = await supabase
        .from('notifications')
        .select('position, is_read, created_at')
        .eq('type', 'join_request')
        .eq('sender_id', currentUserIdFromAuth)
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        console.error(`[MatchDetails] fetchSentRequests hatası:`, error);
        return;
      }
      
      console.log(`[MatchDetails] Database'den gelen notifications:`, data);
      
      // Sadece en son okunmamış (pending) isteği göster
      const pendingNotifications = (data || [])
        .filter((row: any) => row.is_read === false)
        .sort((a: any, b: any) => {
          // created_at'e göre sırala (en yeni en üstte)
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });
      
      // Sadece en son gönderilen isteği al
      const lastPendingPosition = pendingNotifications.length > 0 
        ? pendingNotifications[0].position 
        : null;
        
      console.log(`[MatchDetails] fetchSentRequests sonucu (son pending):`, lastPendingPosition);
      
      if (lastPendingPosition && typeof lastPendingPosition === 'string') {
        setSentRequests([lastPendingPosition]);
      } else {
        setSentRequests([]);
      }
    } catch (error) {
      console.error(`[MatchDetails] fetchSentRequests catch hatası:`, error);
    }
  }, [match.id]);

  // Kabul edilen pozisyonları database'den yükle
  const loadAcceptedPositions = useCallback(async () => {
    if (!currentUserId) return;
    try {
      console.log(`[MatchDetails] loadAcceptedPositions çağrıldı - User: ${currentUserId}, Match: ${match.id}`);
      
      // Tüm notifications'ı kontrol et (hem kabul edilen hem bekleyen hem red edilen)
      const { data: allNotifications, error } = await supabase
        .from('notifications')
        .select('position, is_read, created_at, message')
        .eq('type', 'join_request')
        .eq('sender_id', currentUserId)
        .eq('match_id', match.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error(`[MatchDetails] loadAcceptedPositions hatası:`, error);
        return;
      }
      
      console.log(`[MatchDetails] Tüm notifications yüklendi:`, allNotifications);
      
      // Red edilen pozisyonları bul (mesaj "kabul edilmediniz" veya "reddedildi" içeriyorsa)
      const rejectedPositions = (allNotifications || [])
        .filter((row: any) => row.is_read === true && row.message && (row.message.includes('kabul edilmediniz') || row.message.includes('reddedildi')))
        .map((row: any) => row.position)
        .filter((p: any) => typeof p === 'string');
      
      console.log(`[MatchDetails] Red edilen pozisyonlar:`, rejectedPositions);
      
      // Kabul edilen pozisyonları bul (is_read: true ama red edilmemiş)
      const acceptedPositions = (allNotifications || [])
        .filter((row: any) => row.is_read === true && row.message && !row.message.includes('kabul edilmediniz') && !row.message.includes('reddedildi'))
        .map((row: any) => row.position)
        .filter((p: any) => typeof p === 'string');
        
      // Bekleyen pozisyonları bul (is_read: false)
      const pendingPositions = (allNotifications || [])
        .filter((row: any) => row.is_read === false)
        .map((row: any) => row.position)
        .filter((p: any) => typeof p === 'string');
        
      console.log(`[MatchDetails] Kabul edilen pozisyonlar:`, acceptedPositions);
      console.log(`[MatchDetails] Red edilen pozisyonlar:`, rejectedPositions);
      console.log(`[MatchDetails] Bekleyen pozisyonlar:`, pendingPositions);
      
      // Red edilen pozisyonları acceptedPositions'tan çıkar
      const nonRejectedAcceptedPositions = acceptedPositions.filter(pos => !rejectedPositions.includes(pos));
      
      // İptal edilen pozisyonları filtrele (güncel state'i al)
      const currentCancelledPositions = cancelledPositionsRef.current;
      console.log(`[MatchDetails] Mevcut cancelledPositions:`, Array.from(currentCancelledPositions));
      
      // Eğer cancelledPositions boşsa, tüm pozisyonları göster (ama red edilenleri hariç tut)
      if (currentCancelledPositions.size === 0) {
        console.log(`[MatchDetails] CancelledPositions boş, tüm pozisyonlar gösteriliyor (red edilenler hariç)`);
        if (nonRejectedAcceptedPositions.length > 0 && pendingPositions.length === 0) {
          console.log(`[MatchDetails] Sadece kabul edilen pozisyonlar var (red edilenler hariç), gösteriliyor`);
          setShownAcceptedPositions(new Set(nonRejectedAcceptedPositions));
          setAcceptedPosition(nonRejectedAcceptedPositions[0]);
        } else if (pendingPositions.length > 0) {
          console.log(`[MatchDetails] Bekleyen pozisyonlar var, kabul edilen pozisyonlar gösterilmiyor`);
          setShownAcceptedPositions(new Set());
          setAcceptedPosition(null);
        } else {
          console.log(`[MatchDetails] Hiç pozisyon yok`);
          setShownAcceptedPositions(new Set());
          setAcceptedPosition(null);
        }
      } else {
        // İptal edilen pozisyonları filtrele
        const nonCancelledAcceptedPositions = nonRejectedAcceptedPositions.filter(pos => !currentCancelledPositions.has(pos));
        const nonCancelledPendingPositions = pendingPositions.filter(pos => !currentCancelledPositions.has(pos));
        
        console.log(`[MatchDetails] İptal edilmemiş ve red edilmemiş kabul edilen pozisyonlar:`, nonCancelledAcceptedPositions);
        console.log(`[MatchDetails] İptal edilmemiş bekleyen pozisyonlar:`, nonCancelledPendingPositions);
        
        // Eğer sadece kabul edilen pozisyon varsa ve bekleyen yoksa, kabul edileni göster
        if (nonCancelledAcceptedPositions.length > 0 && nonCancelledPendingPositions.length === 0) {
          console.log(`[MatchDetails] Sadece kabul edilen pozisyonlar var, gösteriliyor`);
          setShownAcceptedPositions(new Set(nonCancelledAcceptedPositions));
          setAcceptedPosition(nonCancelledAcceptedPositions[0]);
        } else if (nonCancelledPendingPositions.length > 0) {
          console.log(`[MatchDetails] Bekleyen pozisyonlar var, kabul edilen pozisyonlar gösterilmiyor`);
          setShownAcceptedPositions(new Set());
          setAcceptedPosition(null);
        } else {
          console.log(`[MatchDetails] Hiç pozisyon yok`);
          setShownAcceptedPositions(new Set());
          setAcceptedPosition(null);
        }
      }
    } catch (error) {
      console.error(`[MatchDetails] loadAcceptedPositions catch hatası:`, error);
    }
  }, [currentUserId, match.id]);

  // Red bildirimini yükle (sayfa ilk açıldığında) - en son red edilen
  const loadRejectedPosition = useCallback(async () => {
    if (!currentUserId) return;
    // Maçı oluşturan kullanıcı için red / durum mesajı göstermiyoruz.
    // Bu mesajlar sadece maça katılmak için pozisyon isteği GÖNDEREN kullanıcıya özel.
    if (currentUserId === match.create_user) {
      setRejectedPosition(null);
      return;
    }
    try {
      console.log(`[MatchDetails] loadRejectedPosition çağrıldı - User: ${currentUserId}, Match: ${match.id}`);
      
      // Sadece en son red bildirimini al (hem "kabul edilmediniz" hem de "reddedildi" içeren mesajlar)
      const { data: rejectedNotification, error } = await supabase
        .from('notifications')
        .select('id, position, message, created_at, is_read')
        .eq('type', 'join_request')
        .eq('user_id', currentUserId) // Bildirim alan kişi (istek gönderen)
        .eq('match_id', match.id)
        .or('message.ilike.%kabul edilmediniz%,message.ilike.%reddedildi%') // Red mesajları
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error(`[MatchDetails] loadRejectedPosition hatası:`, error);
        return;
      }
      
      console.log(`[MatchDetails] En son red bildirimi yüklendi:`, rejectedNotification);
      
      // Red bildirimi varsa
      if (rejectedNotification && rejectedNotification.position && rejectedNotification.message) {
        const rejectedPos = rejectedNotification.position;
        const positionName = getPositionName(rejectedPos);
        const rejectedMessage = `${positionName} pozisyonu için maça kabul edilmediniz.`;
        
        // Eğer bildirim henüz okunmamışsa (yeni red) popup göster
        if (rejectedNotification.is_read === false) {
          // Bildirimi okundu olarak işaretle (döngüyü önlemek için)
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', rejectedNotification.id);
          
          Alert.alert(
            "Reddedildi",
            rejectedMessage,
            [
              {
                text: "Tamam",
                onPress: () => {
                  setRejectedPosition({
                    position: rejectedPos,
                    message: rejectedMessage
                  });
                  setSentRequests(prev => prev.filter(p => p !== rejectedPos));
                }
              }
            ]
          );
        } else {
          // Zaten okunmuş - popup olmadan state güncelle
          setRejectedPosition({
            position: rejectedPos,
            message: rejectedMessage
          });
          setSentRequests(prev => prev.filter(p => p !== rejectedPos));
        }
        console.log(`[MatchDetails] RejectedPosition state'i güncellendi:`, rejectedPos);
      } else {
        setRejectedPosition(null);
        console.log(`[MatchDetails] Red bildirimi bulunamadı:`, rejectedNotification);
      }
    } catch (error) {
      console.error(`[MatchDetails] loadRejectedPosition catch hatası:`, error);
    }
  }, [currentUserId, match.id, setRejectedPosition, setSentRequests]);

  return {
    fetchMissing,
    fetchSentRequests,
    loadAcceptedPositions,
    loadRejectedPosition,
  };
};

