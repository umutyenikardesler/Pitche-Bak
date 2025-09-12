import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Dimensions, Modal, TouchableOpacity, DeviceEventEmitter, Platform } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from '@/services/supabase';
import '@/global.css';

import IndexCondition from '@/components/index/IndexCondition';
import MyMatches from '@/components/index/MyMatches';
import OtherMatches from '@/components/index/OtherMatches';
import MatchDetails from '@/components/index/MatchDetails';
import ProfilePreview from '@/components/index/ProfilePreview';
import { Match } from '@/components/index/types';

export default function Index() {
  const [futureMatches, setFutureMatches] = useState<Match[]>([]);
  const [otherMatches, setOtherMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMatchCount, setTotalMatchCount] = useState(0);
  const [myMatchesHeight, setMyMatchesHeight] = useState(0); // Yüksekliği state olarak tut
  const router = useRouter();

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
  
  // Yükseklik hesaplama fonksiyonu
  const calculateHeight = useCallback(() => {
    const calculatedHeight = (() => {
      if (futureMatches.length === 0) {
        // Android için daha fazla yükseklik gerekiyor
        const emptyStateHeight = Platform.OS === 'android' ? 100 : 90;
        return headerHeight + emptyStateHeight + 16; // Boş durum için başlık + buton + boşluk + mb-8 (32px)
      }
      if (futureMatches.length === 1) return headerHeight + itemHeight + 22; // 1 maç + padding
      if (futureMatches.length === 2) return headerHeight + (itemHeight * 2) + 25; // 2 maç + padding
      // 3 veya daha fazla maç varsa 2 maç + daha fazla padding + header
      return headerHeight + (itemHeight * 2) + 30; // 80px padding ekledik
    })();
    
    console.log('Yükseklik hesaplandı:', calculatedHeight, 'Maç sayısı:', futureMatches.length, 'Platform:', Platform.OS);
    setMyMatchesHeight(calculatedHeight);
  }, [futureMatches.length, headerHeight, itemHeight]);

  // Dimensions değişikliklerini dinle
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      // Ekran boyutu değiştiğinde yükseklikleri yeniden hesapla
      calculateHeight();
    });

    return () => subscription?.remove();
  }, [calculateHeight]);

  // State'leri ekleyin
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);

  // URL parametrelerini dinleyin
  const params = useLocalSearchParams();
  const userId = params.userId as string | undefined;

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
    setSelectedMatch(null);
  };

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

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user.id) {
      console.error("Kullanıcı kimlik doğrulama hatası:", authError);
      setRefreshing(false);
      return;
    }

    const loggedUserId = authData.user.id;

    // Tüm maçları say (kondisyon için)
    const { data: allMatchData, error: allMatchError } = await supabase
      .from("match")
      .select(`id`)
      .eq("create_user", loggedUserId);

    if (!allMatchError) {
      setTotalMatchCount(allMatchData.length);
    }

    // Tüm maçları çek (tarih filtrelemesi yapmadan)
    const { data: matchData, error: matchError } = await supabase
      .from("match")
      .select(`
        id, title, time, date, prices, missing_groups, create_user,
        pitches (name, address, price, features, district_id, latitude, longitude, districts (name)),
        users (id, name, surname, profile_image)
      `)
      .eq("create_user", loggedUserId)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (!matchError) {
      const filteredMatches = matchData?.filter((item) => {
        // Maç tarihini Date objesine çevir
        const matchDate = new Date(item.date);
        const matchDateStr = matchDate.toISOString().split('T')[0];
        
        // Eğer maç bugünden sonraki bir tarihte ise direkt göster
        if (matchDateStr > today) return true;
        
        // Eğer maç bugünden önceki bir tarihte ise kesinlikle gösterme
        if (matchDateStr < today) return false;

        // Bugünkü maçlar için saat kontrolü
        const [matchHours, matchMinutes] = item.time.split(":").map(Number);
        const matchEndHour = matchHours + 1;
        
        // Şu anki zamanı dakika cinsinden hesapla
        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        const matchEndTimeInMinutes = matchEndHour * 60 + matchMinutes;
        
        // Maç bitiş saati şu anki saatten sonra olmalı
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
              ? item.users.map(user => ({ ...user, profile_image: updatedProfileImage }))
              : { ...(item.users as any), profile_image: updatedProfileImage },
            formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
            startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
            endFormatted: `${parseInt(item.time.split(":")[0], 10) + 1}:${item.time.split(":")[1]}`,
          };
        }) || []
      );

      setFutureMatches(updatedMatches);
      
      // Debug: Filtrelenen maçları göster
      console.log('Filtrelenen maçlar:');
      updatedMatches.forEach(match => {
        const [matchHours, matchMinutes] = match.time.split(":").map(Number);
        const matchEndHour = matchHours + 1;
        const matchEndTimeInMinutes = matchEndHour * 60 + matchMinutes;
        console.log(`- ${match.date} ${match.time} (bitiş: ${matchEndHour}:${matchMinutes}) - EndTime: ${matchEndTimeInMinutes} > Current: ${currentHours * 60 + currentMinutes}`);
      });
      
      // Maç verisi değiştiğinde yüksekliği güncelleniyor - useEffect ile otomatik
      console.log('Maç verisi yüklendi, maç sayısı:', updatedMatches.length);
    }

    // Diğer kullanıcıların tüm maçları (tarih filtrelemesi yapmadan)
    const { data: otherMatchData, error: otherMatchError } = await supabase
      .from("match")
      .select(`
        id, title, time, date, prices, missing_groups, create_user,
        pitches (name, price, address, features, district_id, latitude, longitude, districts (name)),
        users (id, name, surname, profile_image)
      `)
      .neq("create_user", loggedUserId)
      .order("date", { ascending: true })
      .order("time", { ascending: true });

    if (!otherMatchError) {
      const filteredOtherMatches = otherMatchData?.filter((item) => {
        // Maç tarihini Date objesine çevir
        const matchDate = new Date(item.date);
        const matchDateStr = matchDate.toISOString().split('T')[0];
        
        // Eğer maç bugünden sonraki bir tarihte ise direkt göster
        if (matchDateStr > today) return true;
        
        // Eğer maç bugünden önceki bir tarihte ise kesinlikle gösterme
        if (matchDateStr < today) return false;

        // Bugünkü maçlar için saat kontrolü
        const [matchHours, matchMinutes] = item.time.split(":").map(Number);
        const matchEndHour = matchHours + 1;
        
        // Şu anki zamanı dakika cinsinden hesapla
        const currentTimeInMinutes = currentHours * 60 + currentMinutes;
        const matchEndTimeInMinutes = matchEndHour * 60 + matchMinutes;
        
        // Maç bitiş saati şu anki saatten sonra olmalı
        return matchEndTimeInMinutes > currentTimeInMinutes;
      });

      // Diğer maçlar için de profil resimlerini güncelle
      const updatedOtherMatches = await Promise.all(
        filteredOtherMatches?.map(async (item) => {
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
              ? item.users.map(user => ({ ...user, profile_image: updatedProfileImage }))
              : { ...(item.users as any), profile_image: updatedProfileImage },
            formattedDate: new Date(item.date).toLocaleDateString("tr-TR"),
            startFormatted: `${item.time.split(":")[0]}:${item.time.split(":")[1]}`,
            endFormatted: `${parseInt(item.time.split(":")[0], 10) + 1}:${item.time.split(":")[1]}`,
          };
        }) || []
      );

      setOtherMatches(updatedOtherMatches);
    }

    setRefreshing(false);
  }, []);


  const handleSelectMatch = (match: Match) => {
    setSelectedMatch(match);
  };

  const handleCreateMatch = () => {
    router.push("/create");
  };

  const swipeGesture = Gesture.Pan().onUpdate((event) => {
    if (event.translationX > 100) {
      runOnJS(handleCloseDetail)();
    }
  });

  useEffect(() => {
    // Component mount olduğunda yükseklikleri ayarla
    const timer = setTimeout(() => {
      calculateHeight();
    }, 200);
    
    return () => clearTimeout(timer);
  }, [calculateHeight]);

  // futureMatches değiştiğinde yüksekliği otomatik güncelle
  useEffect(() => {
    if (futureMatches.length > 0 || myMatchesHeight === 0) {
      console.log('futureMatches değişti, yükseklik güncelleniyor...');
      calculateHeight();
    }
  }, [futureMatches.length, calculateHeight]);

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
      
      // Verileri yükle
      fetchMatches();
      
      return () => { };
    }, [fetchMatches])
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
          <MatchDetails 
            match={selectedMatch} 
            onClose={handleCloseDetail} 
            onOpenProfilePreview={(userId) => {
              setViewingUserId(userId);
              setProfileModalVisible(true);
            }}
          />
        </GestureDetector>
      ) : (
        <View className="flex-1">
          <IndexCondition totalMatchCount={totalMatchCount} />

          {/* MyMatches için dinamik yükseklik */}
          <View 
            style={{ height: futureMatches.length === 0 ? undefined : myMatchesHeight }}>
            <MyMatches
              matches={futureMatches}
              refreshing={refreshing}
              onRefresh={fetchMatches}
              onSelectMatch={handleSelectMatch}
              onCreateMatch={handleCreateMatch}
            />
          </View>

          {/* OtherMatches kalan alanı doldursun */}
          <View style={{ flex: 1 }}>
            <OtherMatches
              matches={otherMatches}
              refreshing={refreshing}
              onRefresh={fetchMatches}
              onSelectMatch={handleSelectMatch}
              onCreateMatch={handleCreateMatch}
            />
          </View>
        </View>
      )}
    </View>
  );
}