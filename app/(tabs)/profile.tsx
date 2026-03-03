import { useEffect, useState, useCallback } from "react";
import { Text, View, ScrollView, RefreshControl, Alert, TouchableOpacity, Image, DeviceEventEmitter, Modal } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useLanguage } from "@/contexts/LanguageContext";

import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStatus from "@/components/profile/ProfileStatus";
import ProfileCondition from "@/components/profile/ProfileCondition";
import ProfileMatches from "@/components/profile/ProfileMatches";
import ProfileImageModal from "@/components/modals/ProfileImageModal";
import EditProfileModal from "@/components/modals/EditProfileModal";
import UserListModal from "@/components/modals/UserListModal";
import SettingsModal from "@/components/modals/SettingsModal";


export default function Profile() {
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const { currentLanguage, changeLanguage, t } = useLanguage();

  interface UserDataType {
    id: string;
    name?: string;
    surname?: string;
    profile_image?: string;
    age?: number;
    height?: number;
    weight?: number;
    description?: string;
  }

  interface FollowUser {
    id: string;
    name: string;
    surname: string;
    profile_image?: string;
  }

  const [userData, setUserData] = useState<UserDataType | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [followerCount, setFollowerCount] = useState(0); // takipçi sayısı
  const [followingCount, setFollowingCount] = useState(0); // takip edilen sayısı

  const [followersList, setFollowersList] = useState<FollowUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);
  const [activeListType, setActiveListType] = useState < "followers" | "following" | null > (null);
  const [listModalVisible, setListModalVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  
  // Modal state'ini debug et
  useEffect(() => {
    console.log("Modal state değişti:", {
      modalVisible,
      editModalVisible,
      settingsModalVisible,
      listModalVisible
    });
    
    // Modal state'lerinde çakışma kontrolü
    const activeModals = [modalVisible, editModalVisible, settingsModalVisible, listModalVisible].filter(Boolean);
    if (activeModals.length > 1) {
      console.warn("⚠️ Birden fazla modal açık! Çakışma tespit edildi:", {
        modalVisible,
        editModalVisible,
        settingsModalVisible,
        listModalVisible
      });
    }
  }, [modalVisible, editModalVisible, settingsModalVisible, listModalVisible]);

  // CustomHeader başlık tıklaması ile modal'ları kapat
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('closeModals', () => {
      console.log('closeModals event alındı, profile modal\'ları kapatılıyor');
      // Tüm modal'ları kapat
      setModalVisible(false);
      setEditModalVisible(false);
      setSettingsModalVisible(false);
      setListModalVisible(false);
    });

    return () => subscription.remove();
  }, []);

  const [profileImage, setProfileImage] = useState({ uri: null });
  const [editUserData, setEditUserData] = useState<UserDataType | null>(null);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  const openEditModal = () => {
    console.log("openEditModal çağrıldı!");
    console.log("userData:", userData);
    
    // Önce diğer modal'ları kapat ve state'leri temizle
    setModalVisible(false);
    setSettingsModalVisible(false);
    setListModalVisible(false);
    
    // State'lerin temizlenmesi için daha uzun gecikme
    setTimeout(() => {
      setEditUserData(userData ? { ...userData } : null);
      setEditModalVisible(true);
      console.log("editModalVisible true yapıldı");
    }, 200);
  };

  const closeEditModal = () => {
    console.log("closeEditModal çağrıldı");
    
    // Eğer firstLogin ise ve bilgiler eksikse modalı kapatmaya izin verme
    if (isFirstLogin) {
      const hasMissingFields = !editUserData?.name || !editUserData?.surname || 
        !editUserData?.age || !editUserData?.height || 
        !editUserData?.weight || !editUserData?.description;
      
      if (hasMissingFields) {
        Alert.alert(
          "Bilgileri Tamamlayın",
          "Lütfen tüm profil bilgilerinizi doldurun. Bilgilerinizi tamamlamadan çıkamazsınız."
        );
        return;
      }
    }
    
    setEditModalVisible(false);
    
    // State temizleme için gecikme
    setTimeout(() => {
      setEditUserData(null);
      console.log("EditUserData temizlendi");
    }, 100);
  };

    useEffect(() => {
    // Sadece ilk yüklemede fetchUserData çağır
    if (searchParams.userId) {
      const userId = Array.isArray(searchParams.userId) 
        ? searchParams.userId[0] 
        : searchParams.userId;
      
      if (userId) {
        // İlk yüklemede kullanıcı verilerini çek
    fetchUserData();
        
        // Eski resimleri yeni klasör yapısına taşı (sadece bir kez)
        setTimeout(async () => {
          await migrateOldImagesToNewStructure(userId);
        }, 2000); // 2 saniye sonra çalıştır
      }
    } else {
      // Eğer searchParams.userId yoksa, mevcut kullanıcı verilerini çek
      fetchUserData();
    }

    // Tüm kullanıcılar için migration çalıştır (sadece bir kez)
    setTimeout(async () => {
      await migrateAllUsersImagesToNewFormat();
    }, 5000); // 5 saniye sonra çalıştır
  }, []); // Sadece bir kez çalışsın

  // firstLogin parametresini kontrol et ve modalı aç
  useEffect(() => {
    const firstLoginParam = searchParams.firstLogin;
    const firstLoginValue = Array.isArray(firstLoginParam) 
      ? firstLoginParam[0] 
      : firstLoginParam;
    const isFirstLoginParam = firstLoginValue === 'true';
    
    // URL parametresine göre isFirstLogin state'ini güncelle
    // Eğer URL'de firstLogin yoksa veya false ise, isFirstLogin false olmalı
    setIsFirstLogin(isFirstLoginParam);
    
    if (isFirstLoginParam) {
      console.log("firstLogin parametresi tespit edildi, modal açılacak");
      
      // Kullanıcı verileri yüklendikten sonra modalı aç
      if (userData) {
        const hasMissingFields = !userData.name || !userData.surname || 
          !userData.age || !userData.height || 
          !userData.weight || !userData.description;
        
        if (hasMissingFields) {
          // Kısa bir gecikme ile modalı aç
          setTimeout(() => {
            openEditModal();
          }, 500);
        }
      }
    } else {
      // URL'de firstLogin yoksa, isFirstLogin false olmalı
      setIsFirstLogin(false);
    }
  }, [searchParams.firstLogin, userData]);

  // Profile sayfasına her dönüşte kullanıcı verilerini yenile
  useFocusEffect(
    useCallback(() => {
      console.log("🔄 Profile sayfasına odaklanıldı, veriler yenileniyor...");
      
      if (searchParams.userId) {
        const userId = Array.isArray(searchParams.userId) 
          ? searchParams.userId[0] 
          : searchParams.userId;
        
        if (userId) {
          fetchUserData();
        }
      } else {
        fetchUserData();
      }
    }, [searchParams.userId])
  );



  // Tüm kullanıcıların eski resimlerini yeni formata çevir
  const migrateAllUsersImagesToNewFormat = async () => {
    try {
      // Tüm kullanıcıları al
      const { data: allUsers, error: usersError } = await supabase
        .from("users")
        .select("id");

      if (usersError || !allUsers) {
        console.error("Kullanıcılar alınamadı:", usersError);
        return;
      }

      for (const user of allUsers) {
        try {
          await migrateOldImagesToNewStructure(user.id);
        } catch (userError) {
          console.error(`❌ Kullanıcı ${user.id} için migration hatası:`, userError);
        }
      }
    } catch (error) {
      console.error("Genel migration hatası:", error);
    }
  };

  // Eski resimleri yeni klasör yapısına taşı ve formatını düzelt
  const migrateOldImagesToNewStructure = async (userId: string) => {
    try {
      // Ana klasördeki tüm dosyaları listele
      const { data: allFiles, error: listError } = await supabase.storage
        .from("pictures")
        .list(`${userId}/`, {
          limit: 1000,
        });

      if (listError || !allFiles) {
        console.error("Dosyalar listelenemedi:", listError);
        return;
      }

      // Sadece profile resimlerini filtrele (eski yapıda olanlar)
      const oldProfileImages = allFiles.filter(file => 
        file.name.startsWith("profile_") && 
        !file.name.includes("/") // Klasör yapısında olanlar
      );

      // Year/month klasörlerindeki eski format resimleri de bul
      let yearMonthOldImages: Array<{ name: string; path: string }> = [];
      
      for (const yearFolder of allFiles) {
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
                  const oldFormatFiles = files
                    .filter(file => 
                      file.name.startsWith("profile_") && 
                      file.name.includes('-') && // Eski format: profile_2025-08-31_17-46-16.jpg
                      !file.name.includes(':') // Yeni format değil
                    )
                    .map(file => ({
                      name: file.name,
                      path: `${userId}/${yearFolder.name}/${monthFolder.name}/${file.name}`
                    }));

                  yearMonthOldImages.push(...oldFormatFiles);
                }
              }
            }
          }
        }
      }

      // Tüm eski format resimleri birleştir
      const allOldImages = [
        ...oldProfileImages.map(file => ({ name: file.name, path: `${userId}/${file.name}` })),
        ...yearMonthOldImages
      ];

      if (allOldImages.length === 0) {
        return;
      }

      for (const oldImage of allOldImages) {
        try {
          // Dosya adından timestamp çıkar
          const timestampStr = oldImage.name.replace("profile_", "").replace(".jpg", "");
          let timestamp: number;
          
          if (timestampStr.includes('-')) {
            // Yeni format: profile_2025-08-31_14-30-25.jpg
            const dateTimeStr = timestampStr.replace(/_/g, ' ').replace(/-/g, ':');
            timestamp = new Date(dateTimeStr).getTime();
          } else {
            // Eski format: profile_1756644880709.jpg
            timestamp = parseInt(timestampStr);
          }
          
          if (isNaN(timestamp)) continue;

          // Tarih bilgilerini hesapla
          const date = new Date(timestamp);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');

          // Yeni dosya yolu (yeni format ile)
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          
          const newFileName = `profile_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.jpg`;
          const newPath = `${userId}/${year}/${month}/${newFileName}`;
          const oldPath = oldImage.path || `${userId}/${oldImage.name}`;

          // Dosyayı yeni konuma kopyala
          const { data: fileData } = await supabase.storage
            .from("pictures")
            .download(oldPath);

          if (fileData) {
            // Yeni konuma yükle
            const { error: uploadError } = await supabase.storage
              .from("pictures")
              .upload(newPath, fileData, {
                contentType: 'image/jpeg',
                cacheControl: '3600'
              });

            if (!uploadError) {
              // Eski dosyayı sil
              await supabase.storage
                .from("pictures")
                .remove([oldPath]);
            } else {
              console.error(`❌ Yükleme hatası: ${oldImage.name}`, uploadError);
            }
          }
        } catch (migrateError) {
          console.error(`❌ Taşıma hatası: ${oldImage.name}`, migrateError);
        }
      }
    } catch (error) {
      console.error("Resim taşıma hatası:", error);
    }
  };





  const fetchLatestProfileImage = async (userId: string) => {
    console.log("🔍 fetchLatestProfileImage çağrıldı, userId:", userId);

    if (!userId) {
      console.error("❌ userId yok, fetchLatestProfileImage'den çıkılıyor.");
      return null;
    }

    try {
      // Ana kullanıcı klasörünü listele
      console.log("📁 Kullanıcı klasörü listeleniyor:", `${userId}/`);
      const { data: userFolders, error: userError } = await supabase.storage
        .from("pictures")
        .list(`${userId}/`, {
          limit: 100,
        });

      if (userError) {
        console.error("❌ Kullanıcı klasörleri listelenemedi:", userError);
        return null;
      }

      if (!userFolders || userFolders.length === 0) {
        console.log("❌ Kullanıcı klasörü bulunamadı.");
        return null;
      }

      console.log("✅ Kullanıcı klasörleri bulundu:", userFolders.map(f => f.name));

      // Tüm profile resimlerini topla
      let allProfileImages: Array<{ path: string; timestamp: number; name: string }> = [];

      // 1. Yeni klasör yapısındaki resimleri topla (year/month)
      for (const yearFolder of userFolders) {
        if (yearFolder.name && /^\d{4}$/.test(yearFolder.name)) {
          console.log(`  📁 Yıl klasörü bulundu: ${yearFolder.name}`);
          const { data: monthFolders } = await supabase.storage
            .from("pictures")
            .list(`${userId}/${yearFolder.name}/`, {
              limit: 100,
            });

          if (monthFolders) {
            console.log(`    📁 ${yearFolder.name} klasöründe ${monthFolders.length} ay klasörü bulundu`);
            for (const monthFolder of monthFolders) {
              if (monthFolder.name && /^\d{2}$/.test(monthFolder.name)) {
                console.log(`      📁 Ay klasörü: ${monthFolder.name}`);
                const { data: files } = await supabase.storage
                  .from("pictures")
                  .list(`${userId}/${yearFolder.name}/${monthFolder.name}/`, {
                    limit: 100,
                  });

                if (files) {
                  console.log(`        📁 ${monthFolder.name} klasöründe ${files.length} dosya bulundu`);
                  const profileFiles = files
                    .filter(file => file.name.startsWith("profile_"))
                    .map(file => {
                      // Hem yeni format (profile_2025-08-31_17:08:46.jpg) hem eski format (profile_2025-08-31_16-37-08.jpg) destekle
                      const dateTimeStr = file.name.replace("profile_", "").replace(".jpg", "");
                      
                      let timestamp: number;
                      let date: Date;
                      
                      if (dateTimeStr.includes(':')) {
                        // Yeni format: profile_2025-08-31_17:08:46.jpg
                        const formattedDateTime = dateTimeStr.replace(/_/g, ' ');
                        const [datePart, timePart] = formattedDateTime.split(' ');
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes, seconds] = timePart.split(':').map(Number);
                        
                        date = new Date(year, month - 1, day, hours, minutes, seconds);
                        timestamp = date.getTime();
                        
                        console.log(`          📅 Parsing (Yeni Format): ${file.name}`);
                        console.log(`            -> ${dateTimeStr} -> ${formattedDateTime}`);
                        console.log(`            -> Date: ${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
                        console.log(`            -> Timestamp: ${timestamp} -> ${date.toLocaleString("tr-TR")}`);
                      } else {
                        // Eski format: profile_2025-08-31_16-37-08.jpg
                        const formattedDateTime = dateTimeStr.replace(/_/g, ' ');
                        const [datePart, timePart] = formattedDateTime.split(' ');
                        const [year, month, day] = datePart.split('-').map(Number);
                        const [hours, minutes, seconds] = timePart.split('-').map(Number);
                        
                        date = new Date(year, month - 1, day, hours, minutes, seconds);
                        timestamp = date.getTime();
                        
                        console.log(`          📅 Parsing (Eski Format): ${file.name}`);
                        console.log(`            -> ${dateTimeStr} -> ${formattedDateTime}`);
                        console.log(`            -> Date: ${year}-${month}-${day} ${hours}:${minutes}:${seconds}`);
                        console.log(`            -> Timestamp: ${timestamp} -> ${date.toLocaleString("tr-TR")}`);
                      }
                      
                      // Debug: Timestamp parsing kontrolü
                      if (isNaN(timestamp)) {
                        console.log(`          ⚠️ HATA: Geçersiz timestamp oluştu!`);
                        console.log(`            -> dateTimeStr: "${dateTimeStr}"`);
                        console.log(`            -> Timestamp: ${timestamp}`);
                        return null;
                      }
                      
                      return {
                        path: `${userId}/${yearFolder.name}/${monthFolder.name}/${file.name}`,
                        timestamp,
                        name: file.name
                      };
                    })
                    .filter((item): item is { path: string; timestamp: number; name: string } => item !== null);

                  console.log(`        📸 ${profileFiles.length} profile resmi bulundu`);
                  allProfileImages.push(...profileFiles);
                }
              }
            }
          }
        }
      }



      if (allProfileImages.length === 0) {
        console.log("❌ Hiç profile resmi bulunamadı.");
        return null;
      }

      console.log("📸 Toplam profile resim sayısı:", allProfileImages.length);

      // Timestamp'e göre sırala (en yeni en üstte)
      allProfileImages.sort((a, b) => b.timestamp - a.timestamp);
      
      console.log("📅 Tarih/saat sırasına göre sıralanmış resimler:");
      allProfileImages.forEach((img, index) => {
        console.log(`  ${index + 1}. ${img.name} - ${new Date(img.timestamp).toLocaleString("tr-TR")} - ${img.path}`);
      });

      // En son yüklenen resmi al
      const latestImage = allProfileImages[0];
      console.log("🏆 En son yüklenen resim:", latestImage.name);
      console.log("📅 Tarih:", new Date(latestImage.timestamp).toLocaleString("tr-TR"));
      console.log("🛣️ Yol:", latestImage.path);

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

  // Takip sayılarını çek
  const fetchFollowCounts = async (userId: string) => {
    try {
      const { data: followers, error: followerError } = await supabase
        .from("follow_requests")
        .select("id")
        .eq("following_id", userId)
        .eq("status", "accepted");

      const { data: following, error: followingError } = await supabase
        .from("follow_requests")
        .select("id")
        .eq("follower_id", userId)
        .eq("status", "accepted");

      if (!followerError) setFollowerCount(followers.length);
      if (!followingError) setFollowingCount(following.length);
    } catch (error) {
      console.error("Takip verileri çekilirken hata:", error);
    }
  };

  // Kullanıcı verisini çek
  const fetchUserData = async (): Promise<void> => {
    console.log("fetchUserData çağrıldı"); // Log eklendi

    let userIdToFetch: string | null = null;
    
    if (searchParams.userId) {
      userIdToFetch = Array.isArray(searchParams.userId) 
        ? searchParams.userId[0] 
        : searchParams.userId;
    }
    
    if (!userIdToFetch) {
      userIdToFetch = (await supabase.auth.getUser()).data?.user?.id || null;
    }
    if (!userIdToFetch) {
      console.error("Kullanıcı ID alınamadı!"); // Log eklendi
      return;
    }

    const { data: userInfo, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userIdToFetch)
      .single();

    if (error) {
      console.error("Kullanıcı bilgileri alınamadı:", error); // Log eklendi
      return;
    }

    const latestProfileImage = await fetchLatestProfileImage(userIdToFetch);
    if (latestProfileImage) {
      userInfo.profile_image = latestProfileImage;
      console.log("✅ Profil resmi bulundu:", latestProfileImage);
    } else {
      // Eğer profil resmi yoksa, default resmi kullan
      userInfo.profile_image = null;
      console.log("❌ Profil resmi bulunamadı, default resim kullanılacak");
    }

    console.log("Kullanıcı verisi:", userInfo); // Log eklendi
    setUserData(userInfo);
    fetchUserMatches(userIdToFetch); // ProfileStatus için maç sayısını çek
    await fetchFollowCounts(userIdToFetch);
  };

  // Kullanıcının maçlarını çek (ProfileStatus için)
  const fetchUserMatches = async (userId: string) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("match")
      .select("*, pitches (name, districts (name))")
      .eq("create_user", userId)
      .order("date", { ascending: false })
      .order("time", { ascending: false });

    if (error) {
      console.error("Maçları çekerken hata oluştu:", error);
      setMatches([]);
    } else {
      // Ekstra sıralama güvenliği için istemci tarafında da sırala
      const sortedMatches = [...(data || [])].sort((a: any, b: any) => {
        const dateA = new Date(`${a.date}T${a.time}`).getTime();
        const dateB = new Date(`${b.date}T${b.time}`).getTime();
        return dateB - dateA; // En yakın tarih+saat en üstte
      });

      setMatches(sortedMatches);
    }
  };

  const pickImage = async (fromProfileInfo: boolean = false): Promise<void> => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;
        
        if (!uri) {
          Alert.alert("Hata", "Resim URI'si alınamadı.");
          return;
        }

        // Tarih bazlı klasör yapısı oluştur
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        // Tarih/saat bazlı dosya adı: profile_2025-08-31_17:08:46.jpg (saat kısmında : kullan)
        const fileName = `profile_${year}-${month}-${day}_${hours}:${minutes}:${seconds}.jpg`;
        const filePath = `${userData!.id}/${year}/${month}/${fileName}`;
        
        console.log("📁 Dosya yolu:", filePath);
        console.log("📅 Tarih bilgileri:", { year, month, day, hours, minutes, seconds });
        console.log("🕐 Şu anki zaman:", now.toLocaleString("tr-TR"));
        console.log("🆔 Kullanıcı ID:", userData!.id);

        // React Native için güvenilir dosya yükleme - FileSystem ile
        console.log("Resim URI:", uri);
        
        // Dosya bilgilerini al
        const fileInfo = await FileSystem.getInfoAsync(uri);
        console.log("Dosya bilgileri:", fileInfo);
        
        if (!fileInfo.exists || fileInfo.size === 0) {
          Alert.alert("Hata", "Seçilen dosya bulunamadı veya boş.");
          return;
        }
        
        console.log("Dosya boyutu:", fileInfo.size, "bytes");
        
        // Dosyayı base64 olarak oku
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        
        if (!base64 || base64.length === 0) {
          Alert.alert("Hata", "Dosya okunamadı.");
          return;
        }
        
        console.log("Base64 uzunluğu:", base64.length);
        
        // Base64'ü Uint8Array'e çevir
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log("Uint8Array boyutu:", bytes.length, "bytes");
        
        const fileData = bytes;

        // Supabase'e yükle
        const { error: uploadError } = await supabase.storage
          .from("pictures")
          .upload(filePath, fileData, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          Alert.alert("Hata", "Resim yüklenirken bir hata oluştu: " + uploadError.message);
          return;
        }

        // Public URL al
        const { data: publicURLData } = supabase.storage
          .from("pictures")
          .getPublicUrl(filePath);

        if (!publicURLData.publicUrl) {
          Alert.alert("Hata", "Resim URL'si alınamadı.");
          return;
        }

        // Kullanıcı veritabanını güncelle
        const { error: updateError } = await supabase
          .from("users")
          .update({ profile_image: publicURLData.publicUrl })
          .eq("id", userData!.id);

        if (updateError) {
          console.error("Database update error:", updateError);
          Alert.alert("Hata", "Veritabanı güncellenirken hata oluştu.");
          return;
        }

        // UI'ı güncelle
        setProfileImage({ uri: publicURLData.publicUrl as any });
        
        // En son profil resmini al (storage'dan)
        console.log("fetchLatestProfileImage çağrılıyor, userId:", userData!.id);
        const latestProfileImage = await fetchLatestProfileImage(userData!.id);
        console.log("En son profil resmi alındı:", latestProfileImage);
        console.log("Upload edilen resim URL:", publicURLData.publicUrl);
        
        // Profil resmi state'ini güncelle
        const finalProfileImage = latestProfileImage || publicURLData.publicUrl;
        console.log("🎯 Final profil resmi:", finalProfileImage);
        
        // ProfileImage state'ini güncelle
        setProfileImage({ uri: finalProfileImage as any });
        console.log("✅ setProfileImage güncellendi");
        
        // Eğer ProfileInfo'dan çağrıldıysa sadece gerekli state'leri güncelle
        if (fromProfileInfo) {
          // Sadece profil resmini güncelle, maç listesini yenileme
          setUserData(prevData => {
            const newData = prevData ? {
              ...prevData,
              profile_image: finalProfileImage
            } : null;
            console.log("🔄 setUserData güncellendi:", newData?.profile_image);
            return newData;
          });
          console.log("✅ ProfileInfo'dan resim yüklendi, en son profil resmi güncellendi:", finalProfileImage);
          
          // ProfileImage state'ini de güncelle (güvenlik için)
          setTimeout(() => {
            setProfileImage({ uri: finalProfileImage as any });
            console.log("🔄 ProfileImage state tekrar güncellendi (güvenlik için)");
          }, 100);
        } else {
          // ProfileImageModal'dan çağrıldıysa tüm verileri güncelle
          console.log("🔄 ProfileImageModal'dan çağrıldı, fetchUserData çalıştırılıyor...");
          await fetchUserData();
          
          // fetchUserData'dan sonra profileImage state'ini de güncelle
          const updatedProfileImage = await fetchLatestProfileImage(userData!.id);
          if (updatedProfileImage) {
            setProfileImage({ uri: updatedProfileImage as any });
            console.log("✅ ProfileImageModal sonrası profileImage güncellendi:", updatedProfileImage);
          }
        }
        
        // Eski resimleri yeni klasör yapısına taşı
        setTimeout(async () => {
          await migrateOldImagesToNewStructure(userData!.id);
        }, 500);
        
        // Index sayfasındaki maç listelerini de güncelle (eğer index sayfası açıksa)
        // Bu sayede index sayfasında da yeni profil resmi görünür
        console.log("🔄 Index sayfası için profil resmi güncellendi, maç listeleri yenilenecek");
        
        // Profil resmi güncellendiğinde userData'yı da yenile
        setTimeout(async () => {
          console.log("🔄 Profil resmi güncellendi, userData yenileniyor...");
          await fetchUserData();
        }, 1000);
        
        // Eğer profil resmi silindiyse, hemen userData'yı yenile
        if (!latestProfileImage) {
          console.log("🔄 Profil resmi silindi, userData hemen yenileniyor...");
          setTimeout(async () => {
            await fetchUserData();
          }, 500);
        }
        

        
        Alert.alert("Başarılı", "Resminiz başarıyla yüklendi!");
        console.log("Resim başarıyla yüklendi:", publicURLData.publicUrl);
        
        // Eğer ProfileInfo'dan çağrıldıysa modal açılmasın
        if (!fromProfileInfo) {
          // Modal'ı kapat ve kısa süre sonra tekrar açılabilir hale getir
          console.log("Modal kapatılıyor...");
          setModalVisible(false);
          
          setTimeout(() => {
            console.log("Modal tekrar açılıyor...");
            setModalVisible(true);
          }, 300);
        } else {
          console.log("ProfileInfo'dan resim yüklendi, modal açılmayacak");
        }
      }
    } catch (error: any) {
      console.error("Resim yükleme hatası:", error);
      Alert.alert("Hata", "Resim yüklenirken beklenmeyen bir hata oluştu: " + (error.message || "Bilinmeyen hata"));
    }
  };

  const handleSave = async () => {
    if (!editUserData) return;
    
    // Tüm alanların dolu olduğunu kontrol et
    if (!editUserData.name || !editUserData.surname || !editUserData.age || 
        !editUserData.height || !editUserData.weight || !editUserData.description) {
      Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
      return;
    }
    
    const { error } = await supabase
      .from("users")
      .update({
        name: editUserData.name,
        surname: editUserData.surname,
        age: editUserData.age,
        height: editUserData.height,
        weight: editUserData.weight,
        description: editUserData.description,
      })
      .eq("id", editUserData.id);
    if (!error) {
      // Sadece gerekli state'leri güncelle, fetchUserData çağırma
      setUserData(prevData => prevData ? {
        ...prevData,
        name: editUserData.name,
        surname: editUserData.surname,
        age: editUserData.age,
        height: editUserData.height,
        weight: editUserData.weight,
        description: editUserData.description,
      } : null);
      
      // Eğer firstLogin ise, flag'i temizle ve URL'den parametreyi kaldır
      const wasFirstLogin = isFirstLogin;
      if (isFirstLogin) {
        setIsFirstLogin(false);
        // URL'den firstLogin parametresini kaldır
        router.replace("/(tabs)/profile");
      }
      
      setEditModalVisible(false);
      setEditUserData(null);
      console.log("Profil bilgileri güncellendi, maç listesi yenilenmedi");
      
      if (wasFirstLogin) {
        Alert.alert("Başarılı", "Profil bilgileriniz başarıyla kaydedildi!");
      }
    } else {
      Alert.alert("Hata", "Profil bilgileri kaydedilirken bir hata oluştu.");
    }
  };



  const handleLogout = (): void => {
    // Eğer firstLogin ise ve bilgiler eksikse çıkış yapmayı engelle
    if (isFirstLogin) {
      const hasMissingFields = !userData?.name || !userData?.surname || 
        !userData?.age || !userData?.height || 
        !userData?.weight || !userData?.description;
      
      if (hasMissingFields) {
        Alert.alert(
          "Bilgileri Tamamlayın",
          "Lütfen önce profil bilgilerinizi tamamlayın. Bilgilerinizi tamamlamadan çıkamazsınız."
        );
        // Modalı aç
        if (userData) {
          openEditModal();
        }
        return;
      }
    }
    
    setLogoutModalVisible(true);
  };

  const confirmLogout = async (): Promise<void> => {
    setLogoutModalVisible(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert("Çıkış Yapılamadı", "Bir hata oluştu.");
    } else {
      router.replace("/auth");
    }
  };

  // Takipçi listesini çek (updated_at/created_at'e göre en yeni üstte) ve kullanıcıları sırayla getir
  const fetchFollowersList = async (userId: string) => {
    const { data: frData, error: frErr } = await supabase
      .from("follow_requests")
      .select("follower_id, updated_at, created_at")
      .eq("following_id", userId)
      .eq("status", "accepted")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (frErr || !frData || frData.length === 0) {
      setFollowersList([]);
      return;
    }

    const ids = frData.map((r: any) => r.follower_id);
    const { data: usersData, error: usersErr } = await supabase
      .from("users")
      .select("id, name, surname, profile_image")
      .in("id", ids);

    if (usersErr || !usersData) {
      setFollowersList([]);
      return;
    }

    const byId = new Map((usersData as any[]).map((u: any) => [u.id, u]));
    const ordered = ids
      .map((id: string) => byId.get(id))
      .filter(Boolean)
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        surname: u.surname,
        profile_image: u.profile_image,
      }));

    setFollowersList(ordered);
  };

  // Takip edilen listesini çek (updated_at/created_at'e göre en yeni üstte) ve kullanıcıları sırayla getir
  const fetchFollowingList = async (userId: string) => {
    const { data: frData, error: frErr } = await supabase
      .from("follow_requests")
      .select("following_id, updated_at, created_at")
      .eq("follower_id", userId)
      .eq("status", "accepted")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (frErr || !frData || frData.length === 0) {
      setFollowingList([]);
      return;
    }

    const ids = frData.map((r: any) => r.following_id);
    const { data: usersData, error: usersErr } = await supabase
      .from("users")
      .select("id, name, surname, profile_image")
      .in("id", ids);

    if (usersErr || !usersData) {
      setFollowingList([]);
      return;
    }

    const byId = new Map((usersData as any[]).map((u: any) => [u.id, u]));
    const ordered = ids
      .map((id: string) => byId.get(id))
      .filter(Boolean)
      .map((u: any) => ({
        id: u.id,
        name: u.name,
        surname: u.surname,
        profile_image: u.profile_image,
      }));

    setFollowingList(ordered);
  };

  const openUserListModal = async (type: "followers" | "following") => {
    try {
      console.log("openUserListModal -> tıklandı, type:", type);
      
      // Önce diğer modal'ları kapat
      setModalVisible(false);
      setEditModalVisible(false);
      setSettingsModalVisible(false);
      
      // Önce güvenilir userId'yi belirle
      const authUserId = (await supabase.auth.getUser()).data?.user?.id || null;
      const paramUserIdRaw = searchParams.userId;
      const paramUserId = Array.isArray(paramUserIdRaw) 
        ? paramUserIdRaw[0] 
        : paramUserIdRaw;
      const userIdToFetch: string | null = paramUserId || authUserId || null;

      console.log("openUserListModal -> userIdToFetch:", userIdToFetch);

      if (!userIdToFetch) {
        console.warn("openUserListModal -> Kullanıcı ID alınamadı!");
        return;
      }

      setUserId(userIdToFetch);
      setActiveListType(type);
      
      // Kısa bir gecikme ile list modal'ı aç
      setTimeout(() => {
        setListModalVisible(true);
        console.log("openUserListModal -> listModalVisible TRUE yapıldı");
      }, 100);

      if (type === "followers") {
        await fetchFollowersList(userIdToFetch);
      } else {
        await fetchFollowingList(userIdToFetch);
      }
      console.log("openUserListModal -> veri çekme tamamlandı");
    } catch (e) {
      console.error("openUserListModal -> hata:", e);
    }
  };

  useEffect(() => {
    console.log(
      "listModalVisible:",
      listModalVisible,
      "activeListType:",
      activeListType
    );
  }, [listModalVisible, activeListType]);

  return (
    <ScrollView
      style={{ flex: 1 }}
    >
      <View className="bg-white rounded-lg m-3 p-1 shadow-lg flex-1">
        <View className="flex-1">
          <ProfileInfo
            userData={userData}
            setModalVisible={(visible: boolean) => {
              if (visible) {
                // ProfileImageModal açılırken diğer modal'ları kapat
                setEditModalVisible(false);
                setSettingsModalVisible(false);
                setListModalVisible(false);
                
                // State'lerin temizlenmesi için gecikme
                setTimeout(() => {
                  setModalVisible(visible);
                }, 100);
              } else {
                setModalVisible(visible);
              }
            }}
            setEditModalVisible={openEditModal}
            pickImage={pickImage}
            onImagePicked={() => {
              console.log("ProfileInfo'dan resim yüklendi, modal açılmayacak");
              // Modal açılmasın, sadece resim güncellensin
              // Maç listesi yenilenmesin, sadece profil resmi güncellensin
            }}
          />
          <ProfileStatus
            matchCount={matches.length}
            followerCount={followerCount}
            followingCount={followingCount}
            onPressFollowers={() => openUserListModal("followers")}
            onPressFollowing={() => openUserListModal("following")}
          />

          <ProfileCondition matchCount={matches.length} />

          <ProfileMatches
            userData={userData}
            refreshing={false}
            onRefresh={() => {
              // Maç listesi yenilenmesin
              console.log("Maç listesi yenilenmesi engellendi");
            }}
          />
        </View>
        <View className="flex pb-4">
          <View className="flex-row mx-4">
            <TouchableOpacity
              onPress={() => {
                // Settings modal açılırken diğer modal'ları kapat
                setModalVisible(false);
                setEditModalVisible(false);
                setListModalVisible(false);
                setSettingsModalVisible(true);
              }}
              className="bg-green-600 rounded-lg flex-1 mr-1"
            >
              <Text className="text-white font-semibold text-center p-2.5">
                {t("profile.settings")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              className="bg-green-600 rounded-lg flex-1 ml-1"
            >
              <Text className="text-white font-semibold text-center p-2.5">
                {t("profile.logout")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 🔹 PROFİL FOTOĞRAFI MODALI */}
        <ProfileImageModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          profileImage={userData?.profile_image}
          onPickImage={pickImage}
        />

        {/* 🔹 BİLGİ DÜZENLEME MODALI */}
        <EditProfileModal
          visible={editModalVisible}
          onClose={closeEditModal}
          editUserData={editUserData}
          onSave={handleSave}
          onEditUserDataChange={setEditUserData}
          isFirstLogin={isFirstLogin}
        />

        {/* 🔹 TAKİPÇİ VE TAKİP EDİLEN LİSTESİ MODALI */}
        <UserListModal
          visible={listModalVisible}
          onClose={() => setListModalVisible(false)}
          activeListType={activeListType}
          followersList={followersList}
          followingList={followingList}
          onUnfollow={async (userId: string) => {
            // Listeden kaldır ve yeniden çek
            if (userId) {
              const authUserId = (await supabase.auth.getUser()).data?.user?.id || null;
              const paramUserIdRaw = searchParams.userId;
              const paramUserId = Array.isArray(paramUserIdRaw) 
                ? paramUserIdRaw[0] 
                : paramUserIdRaw;
              const userIdToFetch: string | null = paramUserId || authUserId || null;
              
              if (userIdToFetch) {
                await fetchFollowingList(userIdToFetch);
                // Takip sayısını da güncelle
                await fetchFollowCounts(userIdToFetch);
              }
            }
          }}
        />

        {/* 🔹 AYARLAR MODALI */}
        <SettingsModal
          visible={settingsModalVisible}
          onClose={() => setSettingsModalVisible(false)}
        />

        {/* 🔹 ÇIKIŞ ONAY MODALI */}
        <Modal
          visible={logoutModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLogoutModalVisible(false)}
        >
          <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
            <View className="bg-white rounded-xl p-6 mx-8 w-80">
              <Text className="text-xl font-bold text-center text-gray-800 mb-6">
                Çıkmak istediğinize emin misiniz?
              </Text>
              <View className="flex-row justify-between">
                <TouchableOpacity
                  onPress={() => setLogoutModalVisible(false)}
                  className="flex-1 mr-2 py-3 rounded-lg"
                  style={{ backgroundColor: '#aaa' }}
                >
                  <Text className="text-white font-bold text-center">İptal Et</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmLogout}
                  className="flex-1 ml-2 py-3 rounded-lg"
                  style={{ backgroundColor: 'green' }}
                >
                  <Text className="text-white font-bold text-center">Çıkış Yap</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </ScrollView>
  );
}
