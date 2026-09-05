// components/index/ProfilePreview.tsx
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";
import { blockUser } from "@/services/blocks";
import { createNotification } from "@/services/triggerPushNotification";
import {
  fetchFollowList,
  fetchFollowCounts as fetchFollowCountsFromDb,
  type FollowUser,
} from "@/services/follows";
import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "expo-router";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import "@/global.css";
import ProfileStatus from "@/components/profile/ProfileStatus";
import ProfileCondition from "@/components/profile/ProfileCondition";
import ProfileMatches from "@/components/profile/ProfileMatches";

interface UserData {
  id: string;
  name: string;
  surname: string;
  email: string;
  profile_image: string;
  age: number;
  height: number;
  weight: number;
  description: string;
  match_count: number;
}

interface ProfilePreviewProps {
  isVisible: boolean;
  onClose: () => void;
  userId: string;
}

/**
 * "Mesaj At" ve "Engelle" butonlarının ortak genişliği. Yazı uzunlukları farklı
 * olduğu için içerik kadar bırakılırsa butonlar farklı genişlikte oluyor;
 * eşit görünmeleri için genişlik açıkça sabitleniyor.
 */
const ACTION_BUTTON_WIDTH = 70;

export default function ProfilePreview({
  isVisible,
  onClose,
  userId,
}: ProfilePreviewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { colors, isDark } = useAppTheme();

  /**
   * Modal içindeki kartların belirginleşmesi için 1px marka yeşili kenarlık ve
   * dışa vuran yeşil ışıltı. Hap menü ve mesaj sekmeleriyle aynı değerler.
   * Not: RN'de bir görünüm tek gölge taşıyabildiği için kartlardaki `shadow-lg`
   * sınıfı kaldırıldı; yoksa ışıltı yerine gri gölge kazanıyordu.
   */
  const glowCardStyle = {
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  } as const;
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStatus, setFollowStatus] = useState<
    "pending" | "accepted" | null
  >(null);
  const [isFollowedByProfileUser, setIsFollowedByProfileUser] = useState(false);
  const [wasRejected, setWasRejected] = useState(false); // Reddedilen istek kontrolü

  // Yeni state'ler ekleyelim
  const [matchCount, setMatchCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Kullanıcının maç sayısını çek
  const fetchMatchCount = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("match")
        .select("id")
        .eq("create_user", userId);

      if (!error) {
        setMatchCount(data.length);
      }
    } catch (error) {
      console.error("Maç sayısı çekilirken hata:", error);
    }
  };

  // Takipçi ve takip sayılarını çek. Sorgusu başarısız olan tarafın sayacı olduğu gibi bırakılır.
  const fetchFollowCounts = async (userId: string) => {
    const { followers, following } = await fetchFollowCountsFromDb(userId);
    if (followers !== null) setFollowerCount(followers);
    if (following !== null) setFollowingCount(following);
  };


  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      // Takip durumunu kontrol et
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      if (user) {
        // Sizin karşı tarafı takip durumunuz
        const { data: followData } = await supabase
          .from("follow_requests")
          .select("*")
          .eq("follower_id", user.id)
          .eq("following_id", userId)
          .single();

        // Karşı taraf sizi takip ediyor mu?
        const { data: reverseFollowData } = await supabase
          .from("follow_requests")
          .select("*")
          .eq("follower_id", userId)
          .eq("following_id", user.id)
          .single();

        setIsFollowing(!!followData);
        setFollowStatus(followData?.status || null);
        setIsFollowedByProfileUser(!!reverseFollowData);
        
        // Reddedilen istek kontrolü - notifications tablosundan kontrol et
        if (!followData) {
          const { data: rejectedNotification, error: rejectedError } = await supabase
            .from("notifications")
            .select("id, message")
            .eq("user_id", user.id)
            .eq("sender_id", userId)
            .eq("type", "follow_request")
            .like("message", "%takip isteğinizi reddetti%")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          setWasRejected(!!rejectedNotification && !rejectedError);
        } else {
          setWasRejected(false);
        }
      }

      setUserData(data);

      // Maç ve takip sayılarını çek
      await fetchMatchCount(userId);
      await fetchFollowCounts(userId);

      setLoading(false);
    } catch (error) {
      setUserData(null);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUserData(null);
      setLoading(true);
      return;
    }
    // Modal açıldığında veya userId değiştiğinde verileri yenile
    if (isVisible) {
      fetchData();
    }
  }, [userId, isVisible, fetchData]);

  // Real-time subscription: follow_requests tablosundaki değişiklikleri dinle
  useEffect(() => {
    if (!isVisible || !userId) return;

    let mounted = true;
    let channel: any = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      channel = supabase
        .channel(`follow-requests-${user.id}-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'follow_requests',
            filter: `follower_id=eq.${user.id} AND following_id=eq.${userId}`
          },
          () => {
            // Takip isteği silindiğinde verileri yenile
            if (mounted) fetchData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'follow_requests',
            filter: `follower_id=eq.${user.id} AND following_id=eq.${userId}`
          },
          () => {
            // Yeni takip isteği oluşturulduğunda verileri yenile
            if (mounted) fetchData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'follow_requests',
            filter: `follower_id=eq.${user.id} AND following_id=eq.${userId}`
          },
          () => {
            // Takip isteği güncellendiğinde verileri yenile
            if (mounted) fetchData();
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [isVisible, userId, fetchData]);

  const handleClose = () => {
    // Önce state'leri sıfırla
    setUserData(null);
    setLoading(true);
    setIsFollowing(false);
    setFollowStatus(null);
    setWasRejected(false);
    setMatchCount(0);
    setFollowerCount(0);
    setFollowingCount(0);
    setListModalVisible(false);
    setCurrentList([]);
    // Sonra modal'ı kapat
    onClose();
  };

  /**
   * Bu kullanıcıyla olan sohbeti açar. Buton yalnızca takip ilişkisi kabul
   * edilmişken gösteriliyor (aşağıdaki butonlara bkz.), o yüzden burada ayrıca
   * takip kontrolü yapılmıyor.
   * Modal açıkken gezinmemek için önce kapatılıyor (dosyadaki mevcut desen).
   */
  const handleMessage = () => {
    const fullName = `${userData?.name ?? ""} ${userData?.surname ?? ""}`.trim();
    handleClose();
    router.push({
      pathname: "/message/chat",
      params: { to: userId, ...(fullName ? { name: fullName } : {}) },
    });
  };

  const handleFollow = async () => {
    try {
      const turkiyeNow = new Date(Date.now() + 3 * 60 * 60 * 1000); // UTC+3
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const msg = `${t("profile.userSessionNotFound")}\n\nGiriş yaptıktan sonra takip edebilirsiniz.`;
        Alert.alert(t("general.error"), msg, [
          {
            text: "Giriş Yap",
            onPress: () => {
              try {
                handleClose();
              } catch {}
              const from = pathname || "/(tabs)?guest=1";
              router.push(`/auth?from=${encodeURIComponent(from)}` as any);
            },
          },
          { text: t("general.cancel"), style: "cancel" },
        ]);
        return;
      }

      // Kendi kullanıcı bilgini çek
      const { data: senderData, error: senderError } = await supabase
        .from("users")
        .select("name, surname")
        .eq("id", user.id)
        .single();

      if (senderError) {
        Alert.alert(t("general.error"), t("profile.ownUserDataNotFound"));
        return;
      }

      // Önce mevcut bir takip isteği var mı kontrol et
      const { data: existingFollow, error: existingError } = await supabase
        .from("follow_requests")
        .select("*")
        .eq("follower_id", user.id)
        .eq("following_id", userId)
        .single();

      if (existingError && existingError.code !== "PGRST116") {
        // PGRST116: No rows found
        throw existingError;
      }

      if (existingFollow) {
        // Eğer zaten varsa önce sil
        await supabase
          .from("follow_requests")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);
      }

      // Takip isteği oluştur
      const { error: insertError } = await supabase
        .from("follow_requests")
        .insert([
          {
            follower_id: user.id,
            following_id: userId,
            status: "pending",
            created_at: turkiyeNow.toISOString(), // <-- Türkiye saatiyle kaydet
            updated_at: turkiyeNow.toISOString(), // <-- Türkiye saatiyle kaydet
          },
        ]);

      if (insertError) {
        if (insertError.code === "23505") {
          // unique violation
          Alert.alert(
            t("general.error"),
            t("profile.alreadyFollowingOrRequested")
          );
          return;
        }
        throw insertError;
      }

      // Bildirim oluştur.
      // `createNotification` kullanılmalı: doğrudan insert edildiğinde satır oluşuyor
      // (uygulama içi bildirim görünüyor) ama push tetikleyicisi çalışmıyordu.
      const { error: notificationError } = await createNotification({
        user_id: userId,
        sender_id: user.id,
        type: "follow_request",
        message: `${senderData?.name} ${senderData?.surname} ${t("notifications.sentFollowRequest")}`,
        is_read: false,
        created_at: turkiyeNow.toISOString(), // <-- Türkiye saatiyle kaydet
      });

      if (notificationError) {
        console.error("Bildirim oluşturma hatası:", notificationError);
      }

      setIsFollowing(true);
      setFollowStatus("pending");
      setWasRejected(false); // Yeni istek gönderildiğinde reddedilme durumunu sıfırla
      Alert.alert(t("general.success"), t("profile.followRequestSentSuccess"));
      fetchData();
    } catch (error) {
      console.error("Takip isteği gönderilirken hata:", error);
      Alert.alert(t("general.error"), t("profile.followRequestError"));
    }
  };

  // Takipten çıkma fonksiyonu
  const handleBlockUser = async () => {
    Alert.alert(
      t("profile.blockUser"),
      t("profile.blockConfirm"),
      [
        { text: t("general.cancel"), style: "cancel" },
        {
          text: t("profile.blockUser"),
          style: "destructive",
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              const { error } = await blockUser(user.id, userId);
              if (!error) {
                Alert.alert(t("general.success"), t("chat.blocked"));
                handleClose();
              }
            } catch (e) {
              console.error("Block error:", e);
              Alert.alert(t("general.error"), t("profile.blockError"));
            }
          },
        },
      ]
    );
  };

  const handleUnfollow = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert(t("general.error"), t("profile.userSessionNotFound"));
        return;
      }
      // Takip isteğini sil
      const { error: deleteError } = await supabase
        .from("follow_requests")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", userId);
      if (deleteError) {
        throw deleteError;
      }
      setIsFollowing(false);
      setFollowStatus(null);
      Alert.alert(t("general.success"), t("profile.unfollowed"));
      fetchData();
    } catch (error) {
      console.error("Takipten çıkılırken hata:", error);
      Alert.alert(t("general.error"), t("profile.unfollowError"));
    }
  };

  // State'ler ekleyelim
  const [listModalVisible, setListModalVisible] = useState(false);
  const [activeListType, setActiveListType] = useState<
    "followers" | "following"
  >("followers");
  const [currentList, setCurrentList] = useState<FollowUser[]>([]);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  // Takipçi listesini aç
  const handlePressFollowers = async () => {
    const followers = await fetchFollowList(userId, "followers");
    if (followers.length === 0) {
      Alert.alert(t("profile.followers"), t("profile.noFollowersYet"));
      return;
    }

    setCurrentList(followers);
    setActiveListType("followers");
    setListModalVisible(true);
  };

  // Takip edilen listesini aç
  const handlePressFollowing = async () => {
    const following = await fetchFollowList(userId, "following");
    if (following.length === 0) {
      Alert.alert(t("profile.following"), t("profile.notFollowingAnyoneYet"));
      return;
    }

    setCurrentList(following);
    setActiveListType("following");
    setListModalVisible(true);
  };

  // Liste modal'ını kapat
  const closeListModal = () => {
    setListModalVisible(false);
    setCurrentList([]);
  };

  return (
    <>
      {/* Ana ProfilePreview Modal */}
      <Modal
        visible={isVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={handleClose}
      >
        <View className="flex-1 bg-black/60 justify-center items-center">
          {/* Boş alana tıklayınca kapatma */}
          <TouchableOpacity
            className="absolute inset-0"
            onPress={handleClose}
            activeOpacity={1}
          />
          
          <View className="rounded-2xl w-11/12 h-3/4 overflow-hidden" style={{ position: "relative" }}>
            {/* Sağ üst: kapatma butonu (alt siyah alana basma sorununa fallback) */}
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                zIndex: 100,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "#ef4444",
                alignItems: "center",
                justifyContent: "center",
              }}
              accessibilityRole="button"
              accessibilityLabel="Close profile modal"
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={20} color="#ffffff" />
            </TouchableOpacity>
            <ScrollView
              className="flex-1"
              scrollEnabled={!listModalVisible}
              nestedScrollEnabled={true}
              contentContainerStyle={{ flexGrow: 1, minHeight: '100%' }}
            >
              <View style={{ flex: 1 }}>
                <View className="pt-8" style={{ flex: 1 }}>
                <TouchableOpacity 
                  activeOpacity={1}
                  onPress={(e) => e.stopPropagation()}
                >
                <View
                  className="flex flex-row rounded-lg px-2 py-1 mb-2 mt-3"
                  style={{ backgroundColor: colors.surface, ...glowCardStyle }}
                >
                  {/* Profil Resmi */}
                  <View className="w-1/5">
                    <TouchableOpacity
                      onPress={() => setImageModalVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={
                          userData?.profile_image
                            ? { uri: userData.profile_image }
                            : require("@/assets/images/ball.png")
                        }
                        className="rounded-full my-3 mx-1"
                        style={{ width: 80, height: 80, resizeMode: "contain" }}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Bilgiler */}
                  <View className="flex-1 ml-6 px-1">
                    <Text className="font-semibold text-lg text-green-700 mt-1">
                      {userData?.name || t("profile.noName")}{" "}
                      {userData?.surname || ""}
                    </Text>

                    {/* Etiketler tema rengini kullanmalı: renk verilmediğinde
                        varsayılan siyaha düşüyor ve koyu modda okunmuyordu. */}
                    <View className="flex-row flex-wrap justify-between mb-1">
                      <Text className="text-wrap font-semibold" style={{ lineHeight: 20, color: colors.text }}>
                        {t("profile.age")}:
                      </Text>
                      <Text className="text-green-600 font-semibold" style={{ lineHeight: 20 }}>
                        {" "}
                        {userData?.age || "-"}{" "}
                      </Text>
                      <Text className="font-semibold" style={{ lineHeight: 20, color: colors.text }}>
                        {t("profile.height")}:
                      </Text>
                      <Text className="text-green-600 font-semibold" style={{ lineHeight: 20 }}>
                        {" "}
                        {userData?.height || "-"} {t("units.cm")} {" "}
                      </Text>
                      <Text className="font-semibold" style={{ lineHeight: 20, color: colors.text }}>
                        {t("profile.weight")}:
                      </Text>
                      <Text className="text-green-600 font-semibold" style={{ lineHeight: 20 }}>
                        {" "}
                        {userData?.weight || "-"} {t("units.kg")} {" "}
                      </Text>
                      <Text className="text-wrap font-semibold mb-1" style={{ lineHeight: 20, color: colors.text }}>
                        <Text className="font-semibold" style={{ lineHeight: 20, color: colors.text }}>
                          {t("profile.position")}:
                        </Text>
                        <Text className="text-green-600 font-semibold mb-1" style={{ lineHeight: 20 }}>
                          {" "}
                          {userData?.description ||
                            t("profile.noDescription")}{" "}
                        </Text>
                      </Text>
                    </View>

                    {/* Takip Et / Takip İsteğini Geri Çek Butonu */}
                    {isFollowing && followStatus === "accepted" ? (
                      // Takip ediliyorsa üç buton: [Takip ediyorsun] [Mesaj] [Engelle].
                      // Yan butonlar `flex-1` ile eşit paylaşıyor; ortadaki sabit
                      // genişlikte olduğu için tam ortada duruyor.
                      <View className="flex-row gap-2" style={{ alignItems: "center" }}>
                        <TouchableOpacity
                          className="flex-1 bg-green-700 px-1 py-2 rounded"
                          style={{ minWidth: 0 }}
                          onPress={handleUnfollow}
                        >
                          {/* adjustsFontSizeToFit: dar ekranlarda yazı kesilmek
                              yerine bir tık küçülüp tam sığsın. */}
                          <Text
                            className="text-center font-bold text-white"
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={{ flexShrink: 1, fontSize: 11.5 }}
                          >
                            {t("profilePreview.youAreFollowing")}
                          </Text>
                        </TouchableOpacity>
                        {currentUserId && currentUserId !== userId && (
                          <TouchableOpacity
                            className="bg-green-700 py-2 rounded"
                            style={{ width: ACTION_BUTTON_WIDTH }}
                            onPress={handleMessage}
                          >
                            <Text
                              className="text-center font-bold text-white"
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                              style={{ fontSize: 11.5 }}
                            >
                              {t("profilePreview.message")}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {currentUserId && currentUserId !== userId && (
                          <TouchableOpacity
                            className="py-2 rounded border border-red-500"
                            style={{ width: ACTION_BUTTON_WIDTH }}
                            onPress={handleBlockUser}
                          >
                            <Text
                              className="text-center font-bold text-red-600"
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                              style={{ fontSize: 11.5 }}
                            >
                              {t("profilePreview.block")}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <View className="flex-row gap-2" style={{ alignItems: "center" }}>
                        <TouchableOpacity
                          onPress={handleFollow}
                          className={`flex-1 px-2 py-2 rounded ${
                            isFollowing ? "bg-gray-400" : "bg-green-700"
                          }`}
                          disabled={isFollowing}
                          style={{ minWidth: 0 }}
                        >
                          <Text
                            className="font-bold text-white text-center"
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                            style={{ flexShrink: 1, fontSize: 11.5 }}
                          >
                            {isFollowing
                              ? t("profilePreview.followRequestPending")
                              : wasRejected
                              ? "Takip Et"
                              : t("profile.follow")}
                          </Text>
                        </TouchableOpacity>
                        {currentUserId && currentUserId !== userId && (
                          <TouchableOpacity
                            className="py-2 rounded border border-red-500"
                            style={{ width: ACTION_BUTTON_WIDTH }}
                            onPress={handleBlockUser}
                          >
                            <Text
                              className="text-center font-bold text-red-600"
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.8}
                              style={{ fontSize: 11.5 }}
                            >
                              {t("profilePreview.block")}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {isFollowing && followStatus === "accepted" && (
                  <View className="rounded-lg p-4" style={{ backgroundColor: colors.surface, ...glowCardStyle }}>
                    {/* ProfileStatus bileşeni - gerçek verilerle */}
                    <ProfileStatus
                      matchCount={matchCount}
                      followerCount={followerCount}
                      followingCount={followingCount}
                      onPressFollowers={handlePressFollowers}
                      onPressFollowing={handlePressFollowing}
                    />

                    {/* ProfileCondition bileşeni - gerçek maç sayısıyla */}
                    <ProfileCondition matchCount={matchCount} />

                    {/* ProfileMatches bileşeni */}
                    {userData && <ProfileMatches userData={userData} mode="modal" />}
                  </View>
                )}
                </TouchableOpacity>
                </View>
              </View>
              
              {/* Takipçi/Takip Edilen Listesi Modal - Ana modal içinde */}
              {listModalVisible && (
                  <View className="absolute -inset-4 bg-black/60 justify-center items-center z-50">
                    {/* Boş alana tıklayınca kapatma */}
                    <TouchableOpacity
                      className="absolute inset-0"
                      onPress={closeListModal}
                      activeOpacity={1}
                    />

                    {/* Modal içeriği */}
                    <View
                      className="rounded-xl w-10/12 max-h-2/3 shadow-2xl border-2 border-green-700"
                      style={{ backgroundColor: colors.surface }}
                    >
                      {/* Header. Açık yeşil şerit koyu modda yabancı duruyor;
                          orada yüzey rengine düşülüyor. */}
                      <View
                        className="flex-row justify-between items-center p-4 border-b rounded-t-xl"
                        style={{
                          backgroundColor: isDark ? colors.surfaceAlt : "#bbf7d0",
                          borderBottomColor: colors.border,
                        }}
                      >
                        <Text className="text-xl font-bold" style={{ color: colors.primary }}>
                          {activeListType === "followers"
                            ? t("profile.followers")
                            : t("profile.following")}
                        </Text>
                        <TouchableOpacity
                          onPress={closeListModal}
                          className="bg-green-700 px-3 py-1 rounded-full"
                        >
                          <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                      </View>

                      {/* Liste - ScrollView kullanarak */}
                      <ScrollView
                        style={{ maxHeight: 250 }}
                        contentContainerStyle={{ paddingBottom: 10 }}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                        bounces={false}
                      >
                        {currentList.map((item) => (
                          <View
                            key={item.id}
                            className="flex-row items-center p-4 border-b"
                            style={{ borderBottomColor: colors.border }}
                          >
                            <View className="relative">
                              <Image
                                source={
                                  item.profile_image
                                    ? { uri: item.profile_image }
                                    : require("@/assets/images/ball.png")
                                }
                                className="rounded-full border-2 border-green-200"
                                style={{
                                  width: 55,
                                  height: 55,
                                  resizeMode: "cover",
                                }}
                              />
                            </View>
                            <View className="ml-4 flex-1">
                              <Text className="text-lg font-semibold text-green-700">
                                {item.name} {item.surname}
                              </Text>
                              <Text className="text-sm mt-1" style={{ color: colors.textMuted }}>
                                {activeListType === "followers"
                                  ? t("profile.followingYou")
                                  : t("profile.youFollowing")}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                )}

                {/* Profil resmi önizleme - Ana modal içinde */}
                {imageModalVisible && (
                  // Perde: koyu modda beyaz yarı saydam katman ters düşüyordu.
                  <View
                    className="absolute inset-0 z-50"
                    style={{ backgroundColor: isDark ? colors.overlay : "rgba(255,255,255,0.6)" }}
                  >
                    {/* Boş alana tıklayınca kapatma */}
                    <TouchableOpacity
                      className="absolute inset-0"
                      onPress={() => setImageModalVisible(false)}
                      activeOpacity={1}
                    />
                    {/* Ortalamayı garanti et */}
                    <View className="absolute inset-0 justify-center items-center">
                      <Image
                        source={
                          userData?.profile_image
                            ? { uri: userData.profile_image }
                            : require("@/assets/images/ball.png")
                        }
                        className="rounded-full"
                        style={{
                          width: 280,
                          height: 280,
                          resizeMode: "contain",
                        }}
                      />
                    </View>
                  </View>
                )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
