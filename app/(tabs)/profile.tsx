import { useEffect, useState, useCallback, useRef } from "react";
import { Text, View, ScrollView, Alert, TouchableOpacity, DeviceEventEmitter, Modal } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestAuthAlert } from '@/contexts/GuestAuthModalContext';
import { useAppTheme } from "@/contexts/ThemeContext";
import { useTabBarBottomInset } from "@/hooks/useTabBarBottomInset";

import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStatus from "@/components/profile/ProfileStatus";
import ProfileCondition from "@/components/profile/ProfileCondition";
import ProfileMatches from "@/components/profile/ProfileMatches";
import ProfileImageModal from "@/components/modals/ProfileImageModal";
import EditProfileModal from "@/components/modals/EditProfileModal";
import UserListModal from "@/components/modals/UserListModal";
import SettingsModal from "@/components/modals/SettingsModal";
import {
  fetchLatestProfileImage,
  clearProfileImageCache,
  migrateAllUsersImagesToNewFormat,
  migrateOldImagesToNewStructure,
} from "@/services/profileImages";
import { fetchFollowList, fetchFollowCounts as fetchFollowCountsFromDb, type FollowUser } from "@/services/follows";


export default function Profile() {
  const searchParams = useLocalSearchParams();
  const tabBarInset = useTabBarBottomInset();
  const router = useRouter();
  const { t } = useLanguage();
  const { isGuest } = useAuth();
  const { showGuestAuthAlert } = useGuestAuthAlert();
  const { colors } = useAppTheme();

  useFocusEffect(
    useCallback(() => {
      if (isGuest && !isLoggingOutRef.current) {
        showGuestAuthAlert(t('auth.guestProfile'));
      }
    }, [isGuest, showGuestAuthAlert, t])
  );

  useEffect(() => {
    if (!isGuest) isLoggingOutRef.current = false;
  }, [isGuest]);

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
  const [logoutLoading, setLogoutLoading] = useState(false);
  const isLoggingOutRef = useRef(false);

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




  // Takip sayılarını çek. Sorgusu başarısız olan tarafın sayacı olduğu gibi bırakılır.
  const fetchFollowCounts = async (userId: string) => {
    const { followers, following } = await fetchFollowCountsFromDb(userId);
    if (followers !== null) setFollowerCount(followers);
    if (following !== null) setFollowingCount(following);
  };

  const fetchFollowersList = async (userId: string) => {
    setFollowersList(await fetchFollowList(userId, "followers"));
  };

  const fetchFollowingList = async (userId: string) => {
    setFollowingList(await fetchFollowList(userId, "following"));
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

    let { data: userInfo, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userIdToFetch)
      .single();

    // PGRST116 = satır bulunamadı; trigger atlamış olabilir, fallback olarak oluştur (sadece kendi profili için)
    const isOwnProfile = !searchParams.userId;
    if (error?.code === "PGRST116" && isOwnProfile) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.id === userIdToFetch) {
        const { error: insertErr } = await supabase.from("users").upsert(
          [{
            id: authUser.id,
            email: authUser.email ?? "",
            name: "Yeni Kullanıcı",
            surname: "",
            age: null,
            height: null,
            weight: null,
            description: "",
            created_at: new Date().toISOString(),
          }],
          { onConflict: "id" }
        );
        if (!insertErr) {
          const res = await supabase.from("users").select("*").eq("id", userIdToFetch).single();
          userInfo = res.data as typeof userInfo;
          error = res.error;
        }
      }
    }
    if (error || !userInfo) {
      console.error("Kullanıcı bilgileri alınamadı:", error);
      return;
    }

    // Profil resmi, maçlar ve takip sayıları birbirine bağlı değil; sırayla beklemek
    // yerine paralel çalıştırıyoruz.
    const [latestProfileImage] = await Promise.all([
      fetchLatestProfileImage(userIdToFetch),
      fetchUserMatches(userIdToFetch), // ProfileStatus için maç sayısı
      fetchFollowCounts(userIdToFetch),
    ]);

    // Resim yoksa varsayılan gösterilsin diye null bırakılıyor.
    userInfo.profile_image = latestProfileImage ?? null;
    setUserData(userInfo);
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

        // Yeni resim yüklendi: önbellekteki eski URL geçersiz.
        clearProfileImageCache(userData!.id);

        // En son profil resmini al (storage'dan)
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
          // Dosya yolları değişti; önbellekteki URL artık geçersiz olabilir.
          clearProfileImageCache(userData!.id);
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
    if (logoutLoading) return;
    setLogoutLoading(true);
    isLoggingOutRef.current = true;
    // Modal kapansın; kullanıcı "bekleme" ekranında kalmasın
    setLogoutModalVisible(false);

    try {
      // Hızlı çıkış: önce local session'ı temizle (anında etki)
      try {
        await supabase.auth.signOut({ scope: "local" } as any);
      } catch {
        // Eski sürümlerde scope yoksa fallback
        await supabase.auth.signOut();
      }

      // Çıkış anında index'e uğramadan direkt Landing'e git
      router.replace("/landing" as any);
    } catch (error) {
      isLoggingOutRef.current = false;
      setLogoutLoading(false);
      Alert.alert("Çıkış Yapılamadı", "Bir hata oluştu.");
    }
  };

  // Takipçi listesini çek (updated_at/created_at'e göre en yeni üstte) ve kullanıcıları sırayla getir

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
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: tabBarInset }}
    >
      <View className="rounded-lg m-3 p-1 shadow-lg flex-1" style={{ backgroundColor: colors.surface }}>
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
          <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.overlay }}>
            <View className="rounded-xl p-6 mx-8 w-80" style={{ backgroundColor: colors.surface }}>
              <Text className="text-xl font-bold text-center mb-6" style={{ color: colors.text }}>
                Çıkmak istediğinize emin misiniz?
              </Text>
              <View className="flex-row justify-between">
                <TouchableOpacity
                  onPress={() => (logoutLoading ? null : setLogoutModalVisible(false))}
                  disabled={logoutLoading}
                  className="flex-1 mr-2 py-3 rounded-lg"
                  style={{ backgroundColor: colors.surfaceAlt, opacity: logoutLoading ? 0.6 : 1 }}
                >
                  <Text className="font-bold text-center" style={{ color: colors.text }}>İptal Et</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmLogout}
                  disabled={logoutLoading}
                  className="flex-1 ml-2 py-3 rounded-lg"
                  style={{ backgroundColor: colors.primary, opacity: logoutLoading ? 0.7 : 1 }}
                >
                  <Text className="text-white font-bold text-center">
                    {logoutLoading ? "Çıkış yapılıyor..." : "Çıkış Yap"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </ScrollView>
  );
}
