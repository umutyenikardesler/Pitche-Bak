import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Dimensions, Modal, TouchableOpacity, DeviceEventEmitter, Platform, Animated, BackHandler } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { supabase } from '@/services/supabase';
import haversine from 'haversine';
import * as Location from 'expo-location';
import '@/global.css';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGuestAuthAlert } from '@/contexts/GuestAuthModalContext';

import IndexCondition from '@/components/index/IndexCondition';
import MyMatches from '@/components/index/MyMatches';
import OtherMatches from '@/components/index/OtherMatches';
import MatchDetails from '@/components/index/MatchDetails';
import ProfilePreview from '@/components/index/ProfilePreview';
import { Match } from '@/components/index/types';

export default function Index() {
  const { isGuest } = useAuth();
  const { showGuestAuthAlert } = useGuestAuthAlert();
  // Misafir landing artık /guest-landing route'unda; burada hep doğrudan içerik gösterilir.
  const [futureMatches, setFutureMatches] = useState<Match[]>([]);
  const [otherMatches, setOtherMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMatchCount, setTotalMatchCount] = useState(0);
  const [myMatchesHeight, setMyMatchesHeight] = useState(0); // Yüksekliği state olarak tut
  const router = useRouter();
  const navigation = useNavigation();
  const screenWidth = Dimensions.get('window').width;
  // Detay ekranı için yatay animasyon değeri (0: ekranda, +width: sağa çıkmış)
  const [detailTranslateX] = useState(new Animated.Value(0));

  // En son profil resmini çek
  const fetchLatestProfileImage = async (userId: string) => {
    console.log("fetchLatestProfileImage çağrıldı, userId:", userId);

    if (!userId) {
      console.error("userId yok, fetchLatestProfileImage'den çıkılıyor.");
      return null;
    }

    try {
      // Ana kullanıcı klasörünü listele
      const { data: userFolders, error: userError } = await supabase.storage
        .from("pictures")
        .list(`${userId}/`, {
          limit: 100,
        });

      if (userError) {
        console.error("Kullanıcı klasörleri listelenemedi:", userError);
        return null;
      }

      if (!userFolders || userFolders.length === 0) {
        console.log("Kullanıcı klasörü bulunamadı.");
        return null;
      }

      console.log("Kullanıcı klasörleri:", userFolders.map(f => f.name));

      // Tüm profile resimlerini topla
      let allProfileImages: Array<{ path: string; timestamp: number; name: string }> = [];

      // 1. Yeni klasör yapısındaki resimleri topla (year/month)
      for (const yearFolder of userFolders) {
        if (yearFolder.name && /^\d{4}$/.test(yearFolder.name)) {
          const { data: monthFolders } = await supabase.storage
            .from("pictures")
            .list(`${userId}/${yearFolder.name}/`, {
              limit: 100,
            });

          if (monthFolders) {
            for (const monthFolder of monthFolders) {
              if (monthFolder.name && /^\d{2}$/.test(monthFolder.name)) {
                const { data: files } = await supabase.storage
                  .from("pictures")
                  .list(`${userId}/${yearFolder.name}/${monthFolder.name}/`, {
                    limit: 100,
                  });

                if (files) {
                  const profileFiles = files
                    .filter(file => file.name.startsWith("profile_"))
                    .map(file => {
                      // Hem yeni format (profile_2025-08-31_17:08:46.jpg) hem eski format (profile_2025-08-31_16-37-08.jpg) destekle
                      const dateTimeStr = file.name.replace("profile_", "").replace(".jpg", "");
                      
                      let timestamp: number;
                      
                      if (dateTimeStr.includes(':')) {
                        // Yeni format: profile_2025-08-31_17:08:46.jpg
                        const formattedDateTime = dateTimeStr.replace(/_/g, ' ');
                        const [datePart, timePart] = formattedDateTime.split(' ');
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes, seconds] = timePart.split(':').map(Number);
                        
                        const date = new Date(year, month - 1, day, hours, minutes, seconds);
                        timestamp = date.getTime();
                      } else {
                        // Eski format: profile_2025-08-31_16-37-08.jpg
                        const formattedDateTime = dateTimeStr.replace(/_/g, ' ');
                        const [datePart, timePart] = formattedDateTime.split(' ');
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes, seconds] = timePart.split('-').map(Number);
                        
                        const date = new Date(year, month - 1, day, hours, minutes, seconds);
                        timestamp = date.getTime();
                      }
                      
                      if (isNaN(timestamp)) {
                        return null;
                      }
                      
                      return {
                        path: `${userId}/${yearFolder.name}/${monthFolder.name}/${file.name}`,
                        timestamp,
                        name: file.name
                      };
                    })
                    .filter((item): item is { path: string; timestamp: number; name: string } => item !== null);

                  allProfileImages.push(...profileFiles);
                }
              }
            }
          }
        }
      }

      if (allProfileImages.length === 0) {
        console.log("Hiç profile resmi bulunamadı.");
        return null;
      }

      // Timestamp'e göre sırala (en yeni en üstte)
      allProfileImages.sort((a, b) => b.timestamp - a.timestamp);
      
      console.log("Tarih/saat sırasına göre sıralanmış resimler:", allProfileImages.map(img => ({
        name: img.name,
        tarih: new Date(img.timestamp).toLocaleString("tr-TR"),
        path: img.path
      })));

      // En son yüklenen resmi al
      const latestImage = allProfileImages[0];
      console.log("En son yüklenen resim:", latestImage.name, "Tarih:", new Date(latestImage.timestamp).toLocaleString("tr-TR"));

      // Public URL al
      const { data: publicURLData } = supabase.storage
        .from("pictures")
        .getPublicUrl(latestImage.path);

      return publicURLData.publicUrl;

    } catch (error) {
      console.error("fetchLatestProfileImage'de hata:", error);
      return null;
    }
  };

  // Dinamik yükseklik hesaplaması - Her render'da yeniden hesaplanır
  const { height } = Dimensions.get('window');
  const itemHeight = 80; // Sabit maç yüksekliği (px)
  const headerHeight = 20; // "SENİ BEKLEYEN MAÇLAR" başlığı yüksekliği
  
  const futureMatchesLenRef = useRef<number>(0);
  useEffect(() => {
    futureMatchesLenRef.current = futureMatches.length;
  }, [futureMatches.length]);

  // Yükseklik hesaplama fonksiyonu (stabil, len parametresi ile)
  const calculateHeightForLen = useCallback((len: number) => {
    const webExtraHeight = Platform.OS === 'web' ? 15 : 0;
    const calculatedHeight = (() => {
      if (len === 0) {
        // Android için daha fazla yükseklik gerekiyor
        const emptyStateHeight = Platform.OS === 'android' ? 100 : 90;
        return headerHeight + emptyStateHeight + 16; // Boş durum için başlık + buton + boşluk + mb-8 (32px)
      }
      if (len === 1) return headerHeight + itemHeight + 22; // 1 maç + padding
      if (len === 2) return headerHeight + (itemHeight * 2) + 27 + webExtraHeight; // 2 maç + padding (+web)
      // 3 veya daha fazla maç varsa 2 maç + daha fazla padding + header
      return headerHeight + (itemHeight * 2) + 30 + webExtraHeight; // 3+ maç: alt boşluğu azalt
    })();
    
    console.log('Yükseklik hesaplandı:', calculatedHeight, 'Maç sayısı:', len, 'Platform:', Platform.OS);
    // Aynı değeri tekrar set etmeyelim (focus dönüşlerinde effect-loop yapmasın)
    setMyMatchesHeight((prev) => (prev === calculatedHeight ? prev : calculatedHeight));
  }, [headerHeight, itemHeight]);

  // Dimensions değişikliklerini dinle
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      // Ekran boyutu değiştiğinde yükseklikleri yeniden hesapla
      calculateHeightForLen(futureMatchesLenRef.current);
    });

    return () => subscription?.remove();
  }, [calculateHeightForLen]);

  // State'leri ekleyin
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // URL parametrelerini dinleyin
  const params = useLocalSearchParams();
  const userId = params.userId as string | undefined;
  // Landing ekranından misafir olarak geldiğimizde (guest=1), parametreyi tek seferlik temizle.
  const guestParam = params.guest as string | undefined;
  useEffect(() => {
    if (guestParam === "1") {
      router.setParams({ guest: undefined });
    }
  }, [guestParam, router]);

  useEffect(() => {
    if (userId && userId !== 'undefined') {
      setViewingUserId(userId);
      setProfileModalVisible(true);
    } else {
      setViewingUserId(null);
      setProfileModalVisible(false);
    }
  }, [userId]);

  // Modal kapatma fonksiyonu
  const closeProfileModal = useCallback(() => {
    // Önce state'leri sıfırla
    setViewingUserId(null);
    setProfileModalVisible(false);
    // URL parametrelerini temizle
    router.setParams({ userId: undefined });
  }, [router]);

  const handleCloseDetail = () => {
    // Maç detayını daha belirgin bir animasyonla sağa kaydırarak kapat
    Animated.timing(detailTranslateX, {
      toValue: screenWidth,
      duration: 350, // biraz daha yavaş ve fark edilir
      useNativeDriver: true,
    }).start(() => {
      setSelectedMatch(null);
      // Sonraki açılış için konumu sıfırla
      detailTranslateX.setValue(0);
    });
  };

  // Root index ekranından geri (Android) Landing'e dönmesin.
  // Detay/Profil modalı açıksa önce onları kapat.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (selectedMatch) {
          handleCloseDetail();
          return true;
        }
        if (profileModalVisible) {
          closeProfileModal();
          return true;
        }
        if (!isGuest) {
          BackHandler.exitApp();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [selectedMatch, profileModalVisible, closeProfileModal, isGuest])
  );

  // CustomHeader başlık tıklaması ile modal'ları kapat
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('closeModals', () => {
      console.log('closeModals event alındı, modal\'lar kapatılıyor');
      // MatchDetails modal'ını kapat
      if (selectedMatch) {
        handleCloseDetail();
      }
      // Profile modal'ını kapat
      if (profileModalVisible) {
        closeProfileModal();
      }
    });

    return () => subscription.remove();
  }, [selectedMatch, profileModalVisible, handleCloseDetail, closeProfileModal]);

  const fetchMatches = useCallback(async () => {
    setRefreshing(true);
    // Türkiye saati için düzeltme (UTC+3)
    const now = new Date();
    const turkeyOffset = 3; // UTC+3 için offset
    const utcNow = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    const turkeyNow = new Date(utcNow.getTime() + (turkeyOffset * 3600000));
    
    // Bugünün tarihini al (Türkiye saati) - toISOString yerine toLocaleDateString kullan
    const today = turkeyNow.toLocaleDateString('en-CA'); // YYYY-MM-DD formatında
    const currentHours = turkeyNow.getHours();
    const currentMinutes = turkeyNow.getMinutes();
    
    console.log('Türkiye saati (UTC):', turkeyNow.toISOString());
    console.log('Türkiye saati (yerel):', turkeyNow.toString());
    console.log('Bugünün tarihi:', today);
    console.log('Şu anki saat:', currentHours + ':' + currentMinutes);
    console.log('Şu anki zaman (dakika):', currentHours * 60 + currentMinutes);

    // Kullanıcının konumunu al (varsa) - en yakın maçları hesaplamak için
    let userLat: number | null = null;
    let userLon: number | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const { coords } = await Location.getCurrentPositionAsync({});
        userLat = coords.latitude;
        userLon = coords.longitude;
      }
    } catch (e) {
      console.log('Konum alınamadı veya izin verilmedi:', e);
    }

    const { data: authData } = await supabase.auth.getUser();
    const loggedUserId = authData?.user?.id ?? null;
    const isGuestUser = !loggedUserId;
    let acceptedJoinMatchIds: string[] = [];
    let acceptedJoinSet = new Set<string>();

    if (!isGuestUser && loggedUserId) {
      // Bu kullanıcının "kabul edildiniz" join_request bildirimlerinden maçları topla
      // (SENİ BEKLEYEN MAÇLAR listesinde sadece kendi oluşturduğu maçlar değil, kabul aldığı maçlar da görünmeli)
      try {
        const { data: acceptedRows, error: acceptedErr } = await supabase
          .from("notifications")
          .select("match_id")
          .eq("type", "join_request")
          .eq("user_id", loggedUserId)
          .not("match_id", "is", null)
          .ilike("message", "%kabul edildiniz%");

        if (acceptedErr) {
          console.error("[Index] accepted join_request fetch error:", acceptedErr);
        } else {
          acceptedJoinMatchIds = (acceptedRows || [])
            .map((r: any) => r?.match_id)
            .filter((id: any) => typeof id === "string" && id);
        }
      } catch (e) {
        console.error("[Index] accepted join_request exception:", e);
      }

      acceptedJoinSet = new Set<string>(acceptedJoinMatchIds);

      // Tüm maçları say (kondisyon için) - sadece giriş yapmış kullanıcı
      const { data: allMatchData, error: allMatchError } = await supabase
        .from("match")
        .select(`id`)
        .eq("create_user", loggedUserId);

      if (!allMatchError) {
        setTotalMatchCount(allMatchData?.length ?? 0);
      }

      // Kendi maçlarını çek - sadece giriş yapmış kullanıcı
      const { data: matchData, error: matchError } = await supabase
        .from("match")
        .select(`
          id, title, time, date, prices, share_url, share_code, share_short_url, missing_groups, create_user, match_format,
          pitches (id, name, address, price, phone, features, district_id, latitude, longitude, districts (name)),
          users (id, name, surname, profile_image)
        `)
        .eq("create_user", loggedUserId)
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      // Katılım kabulü aldığım maçları çek (başkasının maçı) - sadece giriş yapmış kullanıcı
      let acceptedMatchData: any[] = [];
      if (acceptedJoinMatchIds.length > 0) {
        const { data: accData, error: accErr } = await supabase
          .from("match")
          .select(`
            id, title, time, date, prices, share_url, share_code, share_short_url, missing_groups, create_user, match_format,
            pitches (id, name, address, price, phone, features, district_id, latitude, longitude, districts (name)),
            users (id, name, surname, profile_image)
          `)
          .in("id", acceptedJoinMatchIds)
          .neq("create_user", loggedUserId)
          .order("date", { ascending: true })
          .order("time", { ascending: true });

        if (accErr) {
          console.error("[Index] accepted matches fetch error:", accErr);
        } else if (accData) {
          acceptedMatchData = accData as any[];
        }
      }

      if ((!matchError && matchData) || acceptedMatchData.length > 0) {
        const merged = [
          ...(matchData || []),
          ...acceptedMatchData,
        ].filter(Boolean);

        // Dedup: aynı match id tek kez
        const byId = new Map<string, any>();
        merged.forEach((m: any) => {
          if (m?.id) byId.set(String(m.id), m);
        });

        const filteredMatches = Array.from(byId.values()).filter((item) => {
        // Maç tarihini Date objesine çevir
        const matchDate = new Date(item.date);
        const matchDateStr = matchDate.toISOString().split('T')[0];
        
        // Eğer maç bugünden sonraki bir tarihte ise direkt göster
        if (matchDateStr > today) return true;
        
        // Eğer maç bugünden önceki bir tarihte ise kesinlikle gösterme
        if (matchDateStr < today) return false;

        // Bugünkü maçlar için saat kontrolü: KENDİ MAÇLARIN İÇİN
        // Maç tamamen bitmediyse göster (bitiş saatine kadar listede kalsın)
        const [matchHours, matchMinutes] = item.time.split(":").map(Number);
        const matchEndHour = matchHours + 1;

        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        const matchEndTimeInMinutes = matchEndHour * 60 + matchMinutes;

        // Maçın bitiş saati şu anki saatten SONRA olmalı
        return matchEndTimeInMinutes > currentTimeInMinutes;
      });

      // Profil resimlerini güncelle
      const updatedMatches = await Promise.all(
        filteredMatches?.map(async (item) => {
          let updatedProfileImage = null;
          
          // Güvenli şekilde profil resmini al
          if (Array.isArray(item.users) && item.users[0]?.id) {
            updatedProfileImage = await fetchLatestProfileImage(item.users[0].id);
          } else if (item.users && typeof item.users === 'object' && 'id' in item.users) {
            updatedProfileImage = await fetchLatestProfileImage((item.users as any).id);
          }
          
          return {
            ...item,
            users: Array.isArray(item.users) 
              ? item.users.map((user: any) => ({ ...user, profile_image: updatedProfileImage }))
              : { ...(item.users as any), profile_image: updatedProfileImage },
            formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
            startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
            endFormatted: `${parseInt(item.time.split(":")[0], 10) + 1}:${item.time.split(":")[1]}`,
          };
        }) || []
      );

        // Sıralama: tarih/saat (yakın -> uzak)
        const sorted = [...updatedMatches].sort((a: any, b: any) => {
          const da = String(a.date || "").localeCompare(String(b.date || ""));
          if (da !== 0) return da;
          return String(a.time || "").localeCompare(String(b.time || ""));
        });

        setFutureMatches(sorted);
      }
    }

    // Diğer maçlar (misafir: tüm maçlar, giriş yapmış: kendi maçları hariç)
    let otherQuery = supabase
      .from("match")
      .select(`
        id, title, time, date, prices, share_url, share_code, share_short_url, missing_groups, create_user, match_format,
        pitches (id, name, price, phone, address, features, district_id, latitude, longitude, districts (name)),
        users (id, name, surname, profile_image)
      `)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (!isGuestUser && loggedUserId) {
      otherQuery = otherQuery.neq("create_user", loggedUserId);
    }

    const { data: otherMatchData, error: otherMatchError } = await otherQuery;

    if (!otherMatchError) {
      const filteredOtherMatches = otherMatchData?.filter((item) => {
        // Eğer bu kullanıcı bu maça zaten kabul aldıysa "Kadrosu Eksik Maçlar" altında görünmesin
        if (!isGuestUser && loggedUserId) {
          if (acceptedJoinSet.has(String(item.id))) return false;
        }
        // Maç tarihini Date objesine çevir
        const matchDate = new Date(item.date);
        const matchDateStr = matchDate.toISOString().split('T')[0];
        
        // Eğer maç bugünden sonraki bir tarihte ise direkt göster
        if (matchDateStr > today) return true;
        
        // Eğer maç bugünden önceki bir tarihte ise kesinlikle gösterme
        if (matchDateStr < today) return false;

        // Bugünkü maçlar için saat kontrolü: sadece HENÜZ BAŞLAMAMIŞ maçları göster
        const [matchHours, matchMinutes] = item.time.split(":").map(Number);

        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        const matchStartTimeInMinutes = matchHours * 60 + matchMinutes;

        // Maçın başlangıç saati şu anki saatten SONRA olmalı
        return matchStartTimeInMinutes > currentTimeInMinutes;
      });

      // Diğer maçlar için de profil resimlerini güncelle + mesafeyi hesapla
      // Misafir kullanıcılar Storage'a erişemez (401 -> JSON parse hatası), DB'deki resmi kullan
      const updatedOtherMatches = await Promise.all(
        filteredOtherMatches?.map(async (item) => {
          let updatedProfileImage: string | null = null;
          const originalProfileImage = Array.isArray(item.users) ? item.users[0]?.profile_image : (item.users as any)?.profile_image;
          
          // Sadece giriş yapmış kullanıcılar için Storage'dan güncel resim al (misafir 401 alır)
          if (!isGuestUser) {
            if (Array.isArray(item.users) && item.users[0]?.id) {
              updatedProfileImage = await fetchLatestProfileImage(item.users[0].id);
            } else if (item.users && typeof item.users === 'object' && 'id' in item.users) {
              updatedProfileImage = await fetchLatestProfileImage((item.users as any).id);
            }
          }
          // fetchLatestProfileImage null dönerse (misafir vb.) DB'deki profile_image kullan
          const finalProfileImage = updatedProfileImage ?? originalProfileImage ?? null;

          // Maç sahasına olan mesafeyi hesapla (varsa)
          let distance: number | undefined = undefined;
          if (userLat != null && userLon != null) {
            const pitch = Array.isArray(item.pitches) ? item.pitches[0] : item.pitches;
            if (pitch?.latitude && pitch?.longitude) {
              distance = haversine(
                { latitude: userLat, longitude: userLon },
                { latitude: pitch.latitude, longitude: pitch.longitude },
                { unit: 'km' }
              );
            }
          }
          
          return {
            ...item,
            users: Array.isArray(item.users) 
              ? item.users.map(user => ({ ...user, profile_image: finalProfileImage }))
              : { ...(item.users as any), profile_image: finalProfileImage },
            formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
            startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
            endFormatted: `${parseInt(item.time.split(":")[0], 10) + 1}:${item.time.split(":")[1]}`,
            distance,
          };
        }) || []
      );

      // Önce mesafeye, sonra tarih ve saate göre sırala
      const sortedOtherMatches = [...updatedOtherMatches].sort((a, b) => {
        const da = a.distance ?? Number.MAX_SAFE_INTEGER;
        const db = b.distance ?? Number.MAX_SAFE_INTEGER;
        if (Math.abs(da - db) > 0.0001) {
          return da - db;
        }

        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) {
          return dateA - dateB;
        }

        return a.time.localeCompare(b.time);
      });

      setOtherMatches(sortedOtherMatches);
    }

    setRefreshing(false);
  }, []);

  // MatchDetails içinde pozisyon iptal/kabul gibi durumlarda Index listesini yenile
  useEffect(() => {
    let timer: any = null;
    const sub = DeviceEventEmitter.addListener('refreshIndexMatches', () => {
      if (timer) {
        try { clearTimeout(timer); } catch (_) {}
      }
      timer = setTimeout(() => {
        fetchMatches();
      }, 250);
    });

    return () => {
      if (timer) {
        try { clearTimeout(timer); } catch (_) {}
      }
      sub.remove();
    };
  }, [fetchMatches]);

  // Bir kullanıcı bir maça kabul edildiğinde, Index'teki "Seni Bekleyen Maçlar" listesi anında güncellensin.
  useEffect(() => {
    let channel: any = null;
    let isCancelled = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const userId = data?.user?.id;
        if (!userId || isCancelled) return;

        channel = supabase
          .channel(`index-join-request-${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "notifications",
              filter: `user_id=eq.${userId}`,
            },
            (payload: any) => {
              const row = payload?.new;
              if (!row) return;
              if (row.type !== "join_request") return;
              if (!row.match_id) return;
              const msg = String(row.message || "");
              if (!msg.toLowerCase().includes("kabul edildiniz")) return;
              fetchMatches();
            }
          )
          .subscribe();
      } catch (e) {
        console.error("[Index] join_request subscription error:", e);
      }
    })();

    return () => {
      isCancelled = true;
      try {
        if (channel) supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, [fetchMatches]);


  const handleSelectMatch = (match: Match) => {
    // Maç detayını anında aç (eski davranış), animasyonu sadece kapanışta kullanıyoruz.
    detailTranslateX.setValue(0);
    setSelectedMatch(match);
  };

  const { t } = useLanguage();
  const handleCreateMatch = () => {
    if (isGuest) {
      showGuestAuthAlert(t('auth.guestCreateMatch'));
      return;
    }
    router.push("/create");
  };

  // Detay ekranı için soldan sağa swipe-back
  // Android'de dikey scroll'u engellememesi için sadece yatay harekette aktif olacak şekilde sınırla
  const swipeGesture = Gesture.Pan()
    .activeOffsetX(20) // en az 20px yatay hareket olmalı
    .failOffsetY([-10, 10]) // dikeyde ±10px'den fazla hareket olursa gesture iptal (içerideki ScrollView'a geçer)
    .onEnd((event) => {
      if (event.translationX > 100 && Math.abs(event.translationY) < 80) {
        // Eşik aşıldığında maçı animasyonla kapat
        runOnJS(handleCloseDetail)();
      }
    });


  useEffect(() => {
    // Component mount olduğunda yükseklikleri ayarla
    const timer = setTimeout(() => {
      calculateHeightForLen(futureMatchesLenRef.current);
    }, 200);
    
    return () => clearTimeout(timer);
  }, [calculateHeightForLen]);

  // futureMatches sayısı değiştiğinde yüksekliği güncelle
  useEffect(() => {
    calculateHeightForLen(futureMatches.length);
  }, [futureMatches.length, calculateHeightForLen]);

  // Tab değişimlerini dinle - useFocusEffect ile
  useFocusEffect(
    useCallback(() => {
      console.log('Index tab\'ına odaklanıldı - useFocusEffect');
      
      // Tab'a her dönüldüğünde maç verilerini güncelle (pull to refresh gibi)
      // Loading göstergesi için refreshing'i true yap ve state'leri sıfırla
      setRefreshing(true);
      setFutureMatches([]);
      setOtherMatches([]);
      setMyMatchesHeight(0);
      // Eğer futureMatches zaten boşsa bile, MyMatches alanı çökmemeli.
      // Boş state yüksekliğini hemen hesapla (aksi halde "Seni Bekleyen Maçlar" header kaybolabiliyor).
      setTimeout(() => {
        calculateHeightForLen(0);
      }, 0);
      
      // Verileri yükle
      fetchMatches();
      
      return () => { };
    }, [fetchMatches, calculateHeightForLen])
  );

  useEffect(() => {
    const checkTimeAndRefresh = () => {
      const now = new Date();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      
      // Saat başı kontrolü (00:00, 01:00, 02:00 vb.)
      if (minutes === 0 && seconds === 0) {
        fetchMatches();
      }
    };
  
    // Her dakika kontrol etmek için interval
    const interval = setInterval(checkTimeAndRefresh, 60000); // 1 dakika
    
    // İlk yüklemede de kontrol et
    checkTimeAndRefresh();
    
    // Temizleme fonksiyonu
    return () => clearInterval(interval);
  }, [fetchMatches]);

  // Misafir landing artık ayrı bir route: /landing

  return (
    <View className="flex-1">
      {profileModalVisible && (
        <Modal
          visible={profileModalVisible}
          animationType="slide"
          onRequestClose={closeProfileModal}
          transparent={true}
        >
          <ProfilePreview
            userId={viewingUserId || ''}
            onClose={closeProfileModal}
            isVisible={profileModalVisible}
          />
        </Modal>
      )}
      {selectedMatch ? (
        <GestureDetector gesture={swipeGesture}>
          <Animated.View style={{ flex: 1, transform: [{ translateX: detailTranslateX }] }}>
            <MatchDetails 
              match={selectedMatch} 
              onClose={handleCloseDetail} 
              onOpenProfilePreview={(userId) => {
                setViewingUserId(userId);
                setProfileModalVisible(true);
              }}
            />
          </Animated.View>
        </GestureDetector>
      ) : isGuest ? (
        <View className="flex-1">
          {/* OtherMatches - misafir için */}
          <View style={{ flex: 1 }}>
            <OtherMatches
              matches={otherMatches}
              refreshing={refreshing}
              onRefresh={fetchMatches}
              onSelectMatch={handleSelectMatch}
              onCreateMatch={handleCreateMatch}
              isGuest={isGuest}
            />
          </View>
        </View>
      ) : (
        <View className="flex-1">
          <IndexCondition totalMatchCount={totalMatchCount} />

          {/* MyMatches - sadece giriş yapmış kullanıcı için */}
          <View 
            style={{
              height: myMatchesHeight === 0 ? undefined : myMatchesHeight,
              overflow: Platform.OS === 'web' && futureMatches.length > 0 ? 'hidden' : undefined,
            }}>
            <MyMatches
              matches={futureMatches}
              refreshing={refreshing}
              onRefresh={fetchMatches}
              onSelectMatch={handleSelectMatch}
              onCreateMatch={handleCreateMatch}
            />
          </View>

          {/* OtherMatches - giriş yapmış kullanıcı için */}
          <View style={{ flex: 1 }}>
            <OtherMatches
              matches={otherMatches}
              refreshing={refreshing}
              onRefresh={fetchMatches}
              onSelectMatch={handleSelectMatch}
              onCreateMatch={handleCreateMatch}
              isGuest={isGuest}
            />
          </View>
        </View>
      )}
    </View>
  );
}