import { View, Text, ScrollView, TouchableOpacity, Alert, DeviceEventEmitter, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Match } from "./types";
import MapView, { Marker } from "react-native-maps";
import { useRouter } from "expo-router";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/services/supabase";
import { useState, useEffect, useCallback } from "react";
import '@/global.css';

interface MatchDetailsProps {
  match: Match;
  onClose: () => void;
  onOpenProfilePreview?: (userId: string) => void;
}

export default function MatchDetails({ match, onClose, onOpenProfilePreview }: MatchDetailsProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedPosition, setAcceptedPosition] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [shownAcceptedPositions, setShownAcceptedPositions] = useState<Set<string>>(new Set());
  const [isCancellingPosition, setIsCancellingPosition] = useState(false);
  const [cancelledPositions, setCancelledPositions] = useState<Set<string>>(new Set());
  const [isPitchSummaryExpanded, setIsPitchSummaryExpanded] = useState(false);
  
  const featuresArray: string[] = Array.isArray(match.pitches) 
    ? match.pitches[0]?.features || []
    : match.pitches?.features || [];

  // Eksik kadroları izlemek için yerel state (realtime güncellemeleri için)
  const [missingGroups, setMissingGroups] = useState<string[]>(Array.isArray(match.missing_groups) ? match.missing_groups : []);

  // match değişirse state'i senkronize et
  useEffect(() => {
    setMissingGroups(Array.isArray(match.missing_groups) ? match.missing_groups : []);
  }, [match.id]);

  // Soluk gitgel animasyonu
  useEffect(() => {
    const fadeInOut = () => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => fadeInOut()); // Sonsuz döngü
    };

    fadeInOut();
  }, [fadeAnim]);

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
            oldGroups.forEach((oldGroup: string) => {
              const [position, oldCount] = oldGroup.split(':');
              const newGroup = newGroups.find(g => g.startsWith(position + ':'));
              if (newGroup) {
                const [, newCount] = newGroup.split(':');
                if (parseInt(newCount) < parseInt(oldCount)) {
                  decreasedPositions.push(position);
                }
              } else {
                // Pozisyon tamamen kaybolmuş (0'a düşmüş)
                decreasedPositions.push(position);
              }
            });
            
            console.log(`[MatchDetails] Realtime azalan pozisyonlar (Kabul):`, decreasedPositions);
            
            // Eğer pozisyon sayısı azaldıysa başarı mesajını göster
            if (decreasedPositions.length > 0) {
              // currentUserId'yi al
              const { data: { user } } = await supabase.auth.getUser();
              const currentUserIdFromAuth = user?.id || null;
              
              if (currentUserIdFromAuth && currentUserIdFromAuth !== match.create_user) {
                // Database'den sentRequests'i kontrol et
                const { data: currentSentData } = await supabase
                  .from('notifications')
                  .select('position, is_read')
                  .eq('type', 'join_request')
                  .eq('sender_id', currentUserIdFromAuth)
                  .eq('match_id', match.id)
                  .order('created_at', { ascending: false })
                  .limit(5);
                
                const allSentPositions = (currentSentData || [])
                  .map((row: any) => row.position)
                  .filter((p: any) => typeof p === 'string');
                
                console.log(`[MatchDetails] Realtime: Kullanıcının tüm sent positions: ${allSentPositions.join(', ')}`);
                
                const acceptedPositions = decreasedPositions.filter(pos => allSentPositions.includes(pos));
                
                if (acceptedPositions.length > 0) {
                  const acceptedPositionToShow = acceptedPositions[0];
                  if (!shownAcceptedPositions.has(acceptedPositionToShow)) {
                    console.log(`[MatchDetails] Realtime başarı mesajı gösterilecek: ${acceptedPositionToShow}`);
                    setAcceptedPosition(acceptedPositionToShow);
                    setShownAcceptedPositions(prev => new Set([...prev, acceptedPositionToShow]));
                    setSentRequests(prev => prev.filter(p => p !== acceptedPositionToShow));
                  }
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
  }, [match.id, isCancellingPosition, shownAcceptedPositions]);

  // Ortak fetch fonksiyonu - realtime ve event listener için
  const fetchMissing = useCallback(async () => {
    try {
      console.log(`[MatchDetails] fetchMissing çağrıldı - Maç ID: ${match.id}`);
      
      // currentUserId'yi tekrar al
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserIdFromAuth = user?.id || null;
      console.log(`[MatchDetails] fetchMissing'de currentUserId: ${currentUserIdFromAuth}`);
      
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
      
      console.log(`[MatchDetails] fetchMissing sonucu:`, data?.missing_groups);
      
      if (Array.isArray(data?.missing_groups)) {
        const oldGroups = missingGroups;
        const newGroups = data.missing_groups;
        
        // Pozisyon sayısı azalan pozisyonları bul
        const decreasedPositions: string[] = [];
        oldGroups.forEach(oldGroup => {
          const [position, oldCount] = oldGroup.split(':');
          const newGroup = newGroups.find(g => g.startsWith(position + ':'));
          if (newGroup) {
            // Pozisyon hala var, sayısını kontrol et
            const [, newCount] = newGroup.split(':');
            if (parseInt(newCount) < parseInt(oldCount)) {
              decreasedPositions.push(position);
            }
          } else {
            // Pozisyon tamamen kaybolmuş (sayı 0'a düşmüş)
            decreasedPositions.push(position);
          }
        });
        
        // Eğer iptal edilen pozisyonlar varsa, onları da güncelle
        if (cancelledPositions.size > 0) {
          console.log(`[MatchDetails] İptal edilen pozisyonlar var, missingGroups güncelleniyor:`, Array.from(cancelledPositions));
          // İptal edilen pozisyonları missingGroups'a ekle
          const updatedGroupsWithCancelled = [...newGroups];
          cancelledPositions.forEach(pos => {
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
          console.log(`[MatchDetails] İptal edilen pozisyonlarla güncellenmiş missingGroups:`, updatedGroupsWithCancelled);
        } else {
          // Eğer iptal edilen pozisyon yoksa, sadece yeni grupları kullan
          setMissingGroups(newGroups);
        }
        
        console.log(`[MatchDetails] missing_groups güncellendi:`, {
          eski: oldGroups,
          yeni: newGroups,
          azalanPozisyonlar: decreasedPositions
        });
        
        
        // Eğer pozisyon sayısı azaldıysa ve kullanıcının gönderdiği istek varsa başarı mesajını göster
        if (decreasedPositions.length > 0 && currentUserIdFromAuth && currentUserIdFromAuth !== match.create_user) {
          console.log(`[MatchDetails] Azalan pozisyonlar: ${decreasedPositions.join(', ')}`);
          
          // İptal edilen pozisyonları kontrol et
          const nonCancelledPositions = decreasedPositions.filter(pos => !cancelledPositions.has(pos));
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
            if (shownAcceptedPositions.has(acceptedPositionToShow)) {
              console.log(`[MatchDetails] Pozisyon ${acceptedPositionToShow} daha önce gösterildi, tekrar gösterme`);
              return;
            }
            
            console.log(`[MatchDetails] Başarı mesajı gösterilecek pozisyon: ${acceptedPositionToShow}`);
            setAcceptedPosition(acceptedPositionToShow);
            // Gösterilen pozisyonları kaydet
            setShownAcceptedPositions(prev => new Set([...prev, acceptedPositionToShow]));
            
            // sentRequests'i güncelle - kabul edilen pozisyonu kaldır
            setSentRequests(prev => {
              const filtered = prev.filter(p => p !== acceptedPositionToShow);
              console.log(`[MatchDetails] sentRequests güncelleniyor: ${prev} -> ${filtered}`);
              return filtered;
            });
          } else {
            // Eğer acceptedPositions boşsa ama decreasedPositions varsa, 
            // bu pozisyonu zaten kabul edilmiş olarak işaretle
            console.log(`[MatchDetails] acceptedPositions boş, ama decreasedPositions var. Pozisyon zaten kabul edilmiş olabilir.`);
            const acceptedPositionToShow = nonCancelledPositions[0];
            
            if (!shownAcceptedPositions.has(acceptedPositionToShow)) {
              console.log(`[MatchDetails] Pozisyon ${acceptedPositionToShow} kabul edilmiş olarak işaretleniyor`);
              setAcceptedPosition(acceptedPositionToShow);
              setShownAcceptedPositions(prev => new Set([...prev, acceptedPositionToShow]));
            }
          }
        }
      } else {
        console.log(`[MatchDetails] missing_groups array değil:`, data?.missing_groups);
      }
    } catch (error) {
      console.error(`[MatchDetails] fetchMissing catch hatası:`, error);
    }
  }, [match.id, currentUserId, shownAcceptedPositions, cancelledPositions]);

  // İlk yüklemede çek
  useEffect(() => {
    fetchMissing();
  }, [fetchMissing]);

  // Bildirim kabulü sonrası lokal event ile tetikleme
  useEffect(() => {
    const eventName = `match-updated-${match.id}`;
    console.log(`[MatchDetails] Event listener kuruldu: ${eventName}`);
    const sub = DeviceEventEmitter.addListener(eventName, async (data) => {
      console.log(`[MatchDetails] Event tetiklendi: ${eventName}`, data);
      
      // Önce missing_groups'u güncelle (sayı azalması için)
      await fetchMissing();
      
      // Eğer event data'sında accepted position varsa, başarı mesajını göster
      if (data && data.acceptedPosition) {
        console.log(`[MatchDetails] Event'ten kabul edilen pozisyon: ${data.acceptedPosition}`);
        setAcceptedPosition(data.acceptedPosition);
        // Gönderilen isteklerden kabul edileni kaldır
        setSentRequests(prev => prev.filter(p => p !== data.acceptedPosition));
        // Gösterilen pozisyonları kaydet
        setShownAcceptedPositions(prev => new Set([...prev, data.acceptedPosition]));
        console.log(`[MatchDetails] acceptedPosition state'i set edildi: ${data.acceptedPosition}`);
      }
    });
    return () => {
      console.log(`[MatchDetails] Event listener kaldırıldı: ${eventName}`);
      sub.remove();
    };
  }, [match.id]);

  // Realtime fallback - her 3 saniyede bir kontrol et
  useEffect(() => {
    const interval = setInterval(async () => {
      // Eğer pozisyon iptal ediliyorsa fallback çalışmasın
      if (isCancellingPosition) {
        console.log(`[MatchDetails] Realtime fallback atlandı - isCancellingPosition: true`);
        return;
      }
      console.log(`[MatchDetails] Realtime fallback - missing_groups kontrol ediliyor`);
      await fetchMissing();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [match.id, isCancellingPosition, fetchMissing]);

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
        .select('position, is_read')
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
      
      // Sadece okunmamış (pending) istekleri göster
      const pendingPositions = (data || [])
        .filter((row: any) => row.is_read === false)
        .map((row: any) => row.position)
        .filter((p: any) => typeof p === 'string');
        
      console.log(`[MatchDetails] fetchSentRequests sonucu (pending):`, pendingPositions);
      console.log(`[MatchDetails] sentRequests state'i güncelleniyor:`, Array.from(new Set(pendingPositions)));
      
      setSentRequests(Array.from(new Set(pendingPositions)));
    } catch (error) {
      console.error(`[MatchDetails] fetchSentRequests catch hatası:`, error);
    }
  }, [match.id]);

  // Kabul edilen pozisyonları database'den yükle
  const loadAcceptedPositions = useCallback(async () => {
    if (!currentUserId) return;
    try {
      console.log(`[MatchDetails] loadAcceptedPositions çağrıldı - User: ${currentUserId}, Match: ${match.id}`);
      
      // Tüm notifications'ı kontrol et (hem kabul edilen hem bekleyen)
      const { data: allNotifications, error } = await supabase
        .from('notifications')
        .select('position, is_read, created_at')
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
      
      // Kabul edilen pozisyonları bul (is_read: true)
      const acceptedPositions = (allNotifications || [])
        .filter((row: any) => row.is_read === true)
        .map((row: any) => row.position)
        .filter((p: any) => typeof p === 'string');
        
      // Bekleyen pozisyonları bul (is_read: false)
      const pendingPositions = (allNotifications || [])
        .filter((row: any) => row.is_read === false)
        .map((row: any) => row.position)
        .filter((p: any) => typeof p === 'string');
        
      console.log(`[MatchDetails] Kabul edilen pozisyonlar:`, acceptedPositions);
      console.log(`[MatchDetails] Bekleyen pozisyonlar:`, pendingPositions);
      
      // İptal edilen pozisyonları filtrele (güncel state'i al)
      const currentCancelledPositions = cancelledPositions;
      console.log(`[MatchDetails] Mevcut cancelledPositions:`, Array.from(currentCancelledPositions));
      
      // Eğer cancelledPositions boşsa, tüm pozisyonları göster
      if (currentCancelledPositions.size === 0) {
        console.log(`[MatchDetails] CancelledPositions boş, tüm pozisyonlar gösteriliyor`);
        if (acceptedPositions.length > 0 && pendingPositions.length === 0) {
          console.log(`[MatchDetails] Sadece kabul edilen pozisyonlar var, gösteriliyor`);
          setShownAcceptedPositions(new Set(acceptedPositions));
          setAcceptedPosition(acceptedPositions[0]);
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
        const nonCancelledAcceptedPositions = acceptedPositions.filter(pos => !currentCancelledPositions.has(pos));
        const nonCancelledPendingPositions = pendingPositions.filter(pos => !currentCancelledPositions.has(pos));
        
        console.log(`[MatchDetails] İptal edilmemiş kabul edilen pozisyonlar:`, nonCancelledAcceptedPositions);
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

  // Varsa bu maç için kullanıcının önceden gönderdiği katılım isteğini getir
  useEffect(() => {
    const run = async () => {
      await fetchSentRequests();
    };
    run();
  }, [fetchSentRequests]);

  // Component mount olduğunda sentRequests'i güncelle ve kabul edilen pozisyonları yükle
  useEffect(() => {
    if (currentUserId) {
      // İptal edilen pozisyonları temizle (yeni mount)
      setCancelledPositions(new Set());
      fetchSentRequests();
      loadAcceptedPositions();
    }
  }, [currentUserId, match.id, fetchSentRequests, loadAcceptedPositions]);

  // Interval kaldırıldı - sadece başlangıçta fetchSentRequests çağrılacak

  // Pull to refresh - kaldırıldı (normal sayfa yüklemesi düzgün çalışıyor)

  // Kullanıcı ID'sini al
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  // Pozisyon kodlarını tam isimlere çevir
  const getPositionName = (positionCode: string) => {
    switch (positionCode) {
      case 'K': return 'Kaleci';
      case 'D': return 'Defans';
      case 'O': return 'Orta Saha';
      case 'F': return 'Forvet';
      default: return positionCode;
    }
  };

  // Katılım isteği gönder veya iptal et
  const handlePositionRequest = async (position: string) => {
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

    // Başka bir pozisyon için istek gönderilmişse veya kabul edilmişse uyar
    if (sentRequests.length > 0 || acceptedPosition || shownAcceptedPositions.size > 0) {
      Alert.alert("Bilgi", "Bu maça zaten katılım sağladınız veya katılım isteği gönderdiniz.");
      return;
    }

    await sendJoinRequest(position);
  };

  // Katılım isteği gönder
  const sendJoinRequest = async (position: string) => {
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
      console.log(`[MatchDetails] currentUserIdFromAuth: ${currentUserIdFromAuth}`);
      console.log(`[MatchDetails] match.create_user: ${match.create_user}`);
      
      // Sunucuda da mükerrer kontrolü yap
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'join_request')
        .eq('sender_id', currentUserIdFromAuth)
        .eq('match_id', match.id)
        .limit(1)
        .maybeSingle();
      
      console.log(`[MatchDetails] Mevcut istek kontrolü:`, existing);
      
      if (existing) {
        console.log(`[MatchDetails] Zaten mevcut istek var: ${existing.id}`);
        setSentRequests((prev) => prev.length ? prev : [position]);
        Alert.alert("Bilgi", `${getPositionName(position)} olarak katılım isteğin zaten gönderilmiş.`);
        setIsLoading(false);
        return;
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
      
      console.log(`[MatchDetails] Notification data:`, notificationData);
      
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (notificationError) {
        console.error('[MatchDetails] Bildirim oluşturma hatası:', notificationError);
        throw notificationError;
      }

      // Gönderilen istekleri güncelle
      setSentRequests(prev => [...prev, position]);
      console.log(`[MatchDetails] İstek başarıyla gönderildi: ${position}`);
      console.log(`[MatchDetails] sentRequests güncellendi:`, [...sentRequests, position]);

      // sentRequests'i database'den de güncelle
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
  };

  // Katılım isteğini iptal et
  const cancelJoinRequest = async (position: string) => {
    setIsLoading(true);
    try {
      console.log(`[MatchDetails] Katılım isteği iptal ediliyor: ${position} - Maç ID: ${match.id}`);
      
      // Bildirimi sil
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

      // Gönderilen istekleri güncelle
      setSentRequests(prev => prev.filter(p => p !== position));
      console.log(`[MatchDetails] İstek başarıyla iptal edildi: ${position}`);

      // sentRequests'i database'den de güncelle
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
  };

  // Kabul edilen pozisyonu iptal et
  const cancelAcceptedPosition = async (position: string) => {
    setIsLoading(true);
    try {
      console.log(`[MatchDetails] Kabul edilen pozisyon iptal ediliyor: ${position} - Maç ID: ${match.id}`);
      console.log(`[MatchDetails] Mevcut missingGroups:`, missingGroups);
      console.log(`[MatchDetails] Mevcut acceptedPosition:`, acceptedPosition);
      console.log(`[MatchDetails] Mevcut shownAcceptedPositions:`, Array.from(shownAcceptedPositions));
      
      // Önce local state'i güncelle (anında UI güncellemesi için)
      const updatedGroups: string[] = [...missingGroups];
      
      // Pozisyonu bul ve sayısını artır
      const existingGroupIndex = updatedGroups.findIndex(g => g.startsWith(position + ':'));
      if (existingGroupIndex !== -1) {
        const [pos, count] = updatedGroups[existingGroupIndex].split(':');
        const newCount = parseInt(count, 10) + 1;
        updatedGroups[existingGroupIndex] = `${pos}:${newCount}`;
        console.log(`[MatchDetails] Pozisyon ${position} bulundu, sayı ${count} → ${newCount} olarak güncellendi`);
      } else {
        // Pozisyon missing_groups'da yoksa ekle
        updatedGroups.push(`${position}:1`);
        console.log(`[MatchDetails] Pozisyon ${position} bulunamadı, yeni eklendi: ${position}:1`);
      }

      console.log('[MatchDetails] Local missing_groups güncellendi:', updatedGroups);
      console.log('[MatchDetails] Pozisyon iptal edildi, sayı artırıldı:', position);
      
      // Local state'i hemen güncelle
      setMissingGroups(updatedGroups);
      
      // State'leri temizle
      setAcceptedPosition(null);
      setShownAcceptedPositions(prev => {
        const newSet = new Set(prev);
        newSet.delete(position);
        return newSet;
      });
      
      // İptal edilen pozisyonu kaydet
      setCancelledPositions(prev => new Set([...prev, position]));
      
      console.log(`[MatchDetails] State'ler temizlendi - acceptedPosition: null, shownAcceptedPositions: ${Array.from(shownAcceptedPositions).filter(p => p !== position).join(', ')}`);
      console.log(`[MatchDetails] İptal edilen pozisyon kaydedildi: ${position}`);

      // Şimdi database'i güncelle
      setIsCancellingPosition(true); // Realtime fallback'i durdur
      
      console.log(`[MatchDetails] Database güncelleniyor:`, updatedGroups);
      const { error: updateMatchError } = await supabase
        .from('match')
        .update({ missing_groups: updatedGroups })
        .eq('id', match.id);

      if (updateMatchError) {
        console.error('[MatchDetails] Match update hatası:', updateMatchError);
        throw updateMatchError;
      }

      // currentUserId'yi al
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserIdFromAuth = user?.id || null;
      
      if (!currentUserIdFromAuth) {
        Alert.alert("Hata", "Kullanıcı bilgisi bulunamadı");
        setIsLoading(false);
        return;
      }

      // Bildirimi sil
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('type', 'join_request')
        .eq('sender_id', currentUserIdFromAuth)
        .eq('match_id', match.id)
        .eq('position', position);

      if (deleteError) {
        console.error('[MatchDetails] Kabul edilen pozisyon silme hatası:', deleteError);
        throw deleteError;
      }
      
      console.log(`[MatchDetails] Kabul edilen pozisyon başarıyla iptal edildi: ${position}`);
      console.log(`[MatchDetails] missing_groups güncellendi:`, updatedGroups);

      Alert.alert(
        "İptal Edildi",
        `${getPositionName(position)} pozisyonundaki katılımınız iptal edildi. Yeni pozisyon seçebilirsiniz.`,
        [{ text: "Tamam" }]
      );

      // 15 saniye sonra fallback'i tekrar aktif et
      setTimeout(() => {
        setIsCancellingPosition(false);
        console.log(`[MatchDetails] Realtime fallback tekrar aktif edildi`);
      }, 15000);

    } catch (error) {
      console.error('[MatchDetails] Kabul edilen pozisyon iptal etme hatası:', error);
      Alert.alert("Hata", "Pozisyon iptal edilemedi. Lütfen tekrar deneyin.");
      setIsCancellingPosition(false);
    } finally {
      setIsLoading(false);
    }
  };

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
        <View className="flex-row mb-3 justify-center items-center bg-green-100 border-2 border-green-300 rounded-lg py-3 px-2">
          <Ionicons name="accessibility-outline" size={20} color="green" />
          <Text className="text-xl font-bold text-green-700 ml-3"> {t('home.matchSummary')} </Text>
        </View>

        <Text className="text-xl text-green-700 font-semibold text-center mt-1 mb-2">{match.title}</Text>

        <View className="flex-row ">
          <View className="w-1/2 text-gray-700 text-md flex-row justify-center items-center">
            <Ionicons name="calendar-outline" size={18} color="black" />
            <Text className="pl-2 font-semibold">{match.formattedDate}</Text>
          </View>
          <View className=" w-1/2 text-gray-700 text-md flex-row justify-center items-center pt-1">
            <Ionicons name="time-outline" size={18} color="black" />
            <Text className="pl-2 font-semibold">{match.startFormatted} - {match.endFormatted}</Text>
          </View>
        </View>

        <View className="flex-row ">
          <View className="w-3/5 text-gray-700 text-md flex-row justify-center items-center pt-1">
            <Ionicons name="location" size={18} color="black" />
            <Text className="pl-2 font-semibold">{(Array.isArray(match.pitches) ? match.pitches[0]?.name : match.pitches?.name) ?? 'Bilinmiyor'}</Text>
          </View>
          <View className="w-2/5 text-gray-700 text-md flex-row justify-center items-center pt-1">
            <Ionicons name="wallet-outline" size={18} color="black" />
            <Text className="pl-2 font-semibold text-green-700">{match.prices} ₺</Text>
          </View>
        </View>

        <View>
          <Text className="text-xl font-semibold text-green-700 text-center mt-3">
            {t('home.missingSquads')}
          </Text>
          <Text className="text-base font-semibold text-center mb-2">
            ( Kaleci: <Text className="text-red-500 font-bold">K</Text>, Defans: <Text className="text-blue-700 font-bold">D</Text>, Orta Saha: <Text className="text-green-700 font-bold">O</Text>, Forvet: <Text className="text-yellow-600 font-bold">F</Text> )
          </Text>
        </View>

        {/* Eksik Kadrolar */}
        <View className="flex-row max-w-full items-center justify-center flex-wrap">
          {missingGroups?.length > 0 && missingGroups.map((group, index) => {
            const [position, count] = group.split(':');
            const isSent = sentRequests.includes(position);
            const isOwner = currentUserId === match.create_user;
            const hasAnyRequest = sentRequests.length > 0;
            const hasAcceptedPosition = acceptedPosition || shownAcceptedPositions.size > 0;
            const isAcceptedPosition = acceptedPosition === position || shownAcceptedPositions.has(position);
            
            return (
              <View key={index} className="flex-row items-center mx-1 mb-2">
                <TouchableOpacity
                  className={`flex-row items-center border-solid border-2 rounded-full p-1.5 ${
                    isSent ? 'border-green-500 bg-green-100' : 
                    isAcceptedPosition ? 'border-blue-500 bg-blue-100' :
                    (hasAnyRequest || hasAcceptedPosition) ? 'border-gray-300 bg-gray-100' : 'border-gray-500'
                  }`}
                  onPress={() => !isOwner && handlePositionRequest(position)}
                  disabled={isOwner || isLoading}
                >
                  <View className={`rounded-full py-1.5 px-1.5 ${position === 'K' ? 'bg-red-500'
                    : position === 'D' ? 'bg-blue-700'
                      : position === 'O' ? 'bg-green-700'
                        : 'bg-yellow-600'}`}>
                    <Text className="text-white font-bold textlg px-2">{position}</Text>
                  </View>
                  <Text className="ml-1 font-semibold pr-1 text-lg">x {count}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Kadro tamamsa göster */}
        {(!missingGroups || missingGroups.length === 0) && (
          <View className="mt-2 mb-2">
            <Animated.Text 
              className="text-white p-2 px-3 bg-green-600 font-bold text-sm rounded-md text-center mx-auto"
              style={{ opacity: fadeAnim }}
            >
              Maç kadrosu tamamlanmıştır! 🎉
            </Animated.Text>
          </View>
        )}
        
        {/* Kabul Edilen İstek için Başarı Mesajı */}
        {acceptedPosition && (
          <View className="mt-3 mb-1">
            <View className="bg-green-200 border border-green-400 rounded-lg p-2">
              <Text className="text-green-800 text-center font-bold text-lg">
                🎉 {getPositionName(acceptedPosition)} olarak maça katılım sağladınız!
              </Text>
            </View>
          </View>
        )}
        

        {/* Gönderilen İstekler için Durum Mesajları */}
        {sentRequests.length > 0 && !acceptedPosition && (
          <View className="mt-2">
            {sentRequests.map((position, index) => (
              <View key={index} className="bg-green-100 border border-green-300 rounded-lg p-2">
                <Text className="text-green-700 text-center font-semibold">
                  {getPositionName(position)} olarak maça katılma istediğin gönderildi.
                </Text>
              </View>
            ))}
          </View>
        )}
        {/* Eksik Kadrolar */}

        {match.users && (
          <View className="flex-row max-w-full items-center justify-center my-4">
            <Text className="font-semibold">{t('home.matchCreatedBy')} </Text>
            <TouchableOpacity onPress={() => {
              if (onOpenProfilePreview) {
                onOpenProfilePreview(match.create_user);
              } else {
                router.push({ pathname: "./", params: { userId: match.create_user }});
              }
            }}>
              <Text className="text-green-700 font-semibold">{(Array.isArray(match.users) ? match.users[0]?.name : match.users?.name) ?? 'Bilinmiyor'} {(Array.isArray(match.users) ? match.users[0]?.surname : match.users?.surname) ?? ''}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Maç ayırıcı çizgisi - Futbol teması */}
        <View className="flex-row items-center justify-center px-1 mt-1 mb-4">
          <View className="flex-1 h-0.5 bg-green-500"></View>
          <View className="mx-4 flex-row items-center">
            <View className="w-2 h-2 bg-green-500 rounded-full mx-1"></View>
            <View className="w-1 h-1 bg-green-400 rounded-full mx-0.5"></View>
            <View className="w-2 h-2 bg-green-500 rounded-full mx-1"></View>
            <View className="w-1 h-1 bg-green-400 rounded-full mx-0.5"></View>
            <View className="w-2 h-2 bg-green-500 rounded-full mx-1"></View>
          </View>
          <View className="flex-1 h-0.5 bg-green-500"></View>
        </View>

        {/* Halı saha özeti - Dropdown */}
        <TouchableOpacity 
          className="flex-row mb-3 justify-center items-center bg-green-100 border-2 border-green-300 rounded-lg py-3 px-2"
          onPress={() => setIsPitchSummaryExpanded(!isPitchSummaryExpanded)}
          activeOpacity={0.8}
        >
          <Ionicons name="accessibility-outline" size={20} color="green" />
          <Text className="text-xl font-bold text-green-700 ml-3"> {t('home.pitchSummary')} </Text>
          <Ionicons 
            name={isPitchSummaryExpanded ? "chevron-up" : "chevron-down"} 
            size={24} 
            color="green" 
            className="ml-3" 
          />
        </TouchableOpacity>

        {/* Dropdown içeriği */}
        {isPitchSummaryExpanded && (
          <View style={{ minHeight: 200 }}>
            {(() => {
              const pitch = Array.isArray(match.pitches) ? match.pitches[0] : match.pitches;
              return pitch?.latitude && pitch?.longitude ? (
                <View className="w-full h-48 rounded-lg overflow-hidden my-2">
                  <MapView
                    style={{ width: "100%", height: "100%" }}
                    initialRegion={{
                      latitude: pitch.latitude,
                      longitude: pitch.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                  >
                    <Marker
                      coordinate={{
                        latitude: pitch.latitude,
                        longitude: pitch.longitude,
                      }}
                      title={pitch.name ?? 'Bilinmiyor'}
                    />
                  </MapView>
                </View>
              ) : null;
            })()}

            <View className="">
              <Text className="h-7 text-xl font-semibold text-green-700 text-center my-2">{(Array.isArray(match.pitches) ? match.pitches[0]?.name : match.pitches?.name) ?? 'Bilinmiyor'}</Text>
            </View>

            <View className="">
              <Text className="h-7 text-lg font-semibold text-green-700 text-center my-2">{t('home.openAddress')}</Text>
            </View>
            <View className=" text-gray-700 text-md flex-row justify-center items-center pt-1">
              <Ionicons name="location" size={18} color="black" />
              <Text className="pl-2 font-semibold text-gray-700">{(Array.isArray(match.pitches) ? match.pitches[0]?.address : match.pitches?.address) ?? 'Adres bilgisi yok'}</Text>
            </View>

            <View className="">
              <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-3 my-2">{t('home.pitchPrice')}</Text>
            </View>
            <View className=" text-gray-700 text-md flex-row justify-center items-center pt-1">
              <Ionicons name="wallet-outline" size={18} color="green" />
              <Text className="pl-2 font-semibold text-gray-700">{(Array.isArray(match.pitches) ? match.pitches[0]?.price : match.pitches?.price) ?? 'Fiyat bilgisi yok'} ₺</Text>
            </View>

            <View>
              <Text className="h-7 text-lg font-semibold text-green-700 text-center mt-4">{t('home.pitchFeatures')}</Text>
            </View>
            <View className="flex-row flex-wrap justify-center items-center mt-3">
              {featuresArray.map((feature, index) => (
                <View key={index} className="w-1/2 mb-1">
                  <View className="flex-row p-2 bg-green-700 rounded mr-1 items-center justify-center">
                    <Ionicons name="checkmark-circle-outline" size={16} color="white" className="" />
                    <Text className="text-white pl-1">{feature}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

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