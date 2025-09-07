// components/index/ProfilePreview.tsx
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";
import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
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

interface FollowUser {
  id: string;
  name: string;
  surname: string;
  profile_image?: string;
}

interface ProfilePreviewProps {
  isVisible: boolean;
  onClose: () => void;
  userId: string;
}

export default function ProfilePreview({
  isVisible,
  onClose,
  userId,
}: ProfilePreviewProps) {
  const { t } = useLanguage();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStatus, setFollowStatus] = useState<
    "pending" | "accepted" | null
  >(null);
  const [isFollowedByProfileUser, setIsFollowedByProfileUser] = useState(false);

  // Yeni state'ler ekleyelim
  const [matchCount, setMatchCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  // Takipçi ve takip edilen listeleri için state'ler
  const [followersList, setFollowersList] = useState<FollowUser[]>([]);
  const [followingList, setFollowingList] = useState<FollowUser[]>([]);

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

  // Takipçi ve takip sayılarını çek
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

  // Takipçi listesini çek
  const fetchFollowersList = async (
    userId: string,
    callback?: (followers: FollowUser[]) => void
  ) => {
    try {
      console.log("fetchFollowersList called, userId:", userId);

      // Önce takipçi ID'lerini al
      const { data: followData, error: followError } = await supabase
        .from("follow_requests")
        .select("follower_id, updated_at, created_at")
        .eq("following_id", userId)
        .eq("status", "accepted")
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });

      console.log("Follower IDs:", followData, "Error:", followError);

      if (followError || !followData || followData.length === 0) {
        const emptyList: FollowUser[] = [];
        setFollowersList(emptyList);
        if (callback) callback(emptyList);
        return;
      }

      // Sonra bu ID'lerle kullanıcı bilgilerini al
      const followerIds = followData.map((item: any) => item.follower_id);
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, name, surname, profile_image")
        .in("id", followerIds);

      console.log("User data:", userData, "Error:", userError);

      if (!userError && userData) {
        // user kayıtlarını, follow_requests sırasına göre yeniden sırala
        const userById = new Map(
          (userData as any[]).map((u: any) => [u.id, u])
        );
        const followers = followerIds
          .map((id: string) => userById.get(id))
          .filter(Boolean)
          .map((user: any) => ({
            id: user.id,
            name: user.name,
            surname: user.surname,
            profile_image: user.profile_image,
          }));
        console.log("Processed followers list:", followers);
        setFollowersList(followers);
        if (callback) callback(followers);
      } else {
        const emptyList: FollowUser[] = [];
        setFollowersList(emptyList);
        if (callback) callback(emptyList);
      }
    } catch (error) {
      console.error("Error fetching followers list:", error);
      const emptyList: FollowUser[] = [];
      setFollowersList(emptyList);
      if (callback) callback(emptyList);
    }
  };

  // Takip edilen listesini çek
  const fetchFollowingList = async (
    userId: string,
    callback?: (following: FollowUser[]) => void
  ) => {
    try {
      console.log("fetchFollowingList called, userId:", userId);

      // Önce takip edilen ID'lerini al
      const { data: followData, error: followError } = await supabase
        .from("follow_requests")
        .select("following_id, updated_at, created_at")
        .eq("follower_id", userId)
        .eq("status", "accepted")
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });

      console.log("Following IDs:", followData, "Error:", followError);

      if (followError || !followData || followData.length === 0) {
        const emptyList: FollowUser[] = [];
        setFollowingList(emptyList);
        if (callback) callback(emptyList);
        return;
      }

      // Sonra bu ID'lerle kullanıcı bilgilerini al
      const followingIds = followData.map((item: any) => item.following_id);
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, name, surname, profile_image")
        .in("id", followingIds);

      console.log("User data:", userData, "Error:", userError);

      if (!userError && userData) {
        // user kayıtlarını, follow_requests sırasına göre yeniden sırala
        const userById = new Map(
          (userData as any[]).map((u: any) => [u.id, u])
        );
        const following = followingIds
          .map((id: string) => userById.get(id))
          .filter(Boolean)
          .map((user: any) => ({
            id: user.id,
            name: user.name,
            surname: user.surname,
            profile_image: user.profile_image,
          }));
        console.log("Processed following list:", following);
        setFollowingList(following);
        if (callback) callback(following);
      } else {
        const emptyList: FollowUser[] = [];
        setFollowingList(emptyList);
        if (callback) callback(emptyList);
      }
    } catch (error) {
      console.error("Error fetching following list:", error);
      const emptyList: FollowUser[] = [];
      setFollowingList(emptyList);
      if (callback) callback(emptyList);
    }
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
    fetchData();
  }, [userId, fetchData]);

  const handleClose = () => {
    // Önce state'leri sıfırla
    setUserData(null);
    setLoading(true);
    setIsFollowing(false);
    setFollowStatus(null);
    setMatchCount(0);
    setFollowerCount(0);
    setFollowingCount(0);
    setFollowersList([]);
    setFollowingList([]);
    setListModalVisible(false);
    setCurrentList([]);
    // Sonra modal'ı kapat
    onClose();
  };

  const handleFollow = async () => {
    try {
      const turkiyeNow = new Date(Date.now() + 3 * 60 * 60 * 1000); // UTC+3
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert(t("general.error"), t("profile.userSessionNotFound"));
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

      // Bildirim oluştur
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert([
          {
            user_id: userId,
            sender_id: user.id,
            type: "follow_request",
            message: `${senderData?.name} ${senderData?.surname} ${t("notifications.sentFollowRequest")}`,
            is_read: false,
            created_at: turkiyeNow.toISOString(), // <-- Türkiye saatiyle kaydet
          },
        ]);

      if (notificationError) {
        console.error("Bildirim oluşturma hatası:", notificationError);
      }

      setIsFollowing(true);
      setFollowStatus("pending");
      Alert.alert(t("general.success"), t("profile.followRequestSentSuccess"));
      fetchData();
    } catch (error) {
      console.error("Takip isteği gönderilirken hata:", error);
      Alert.alert(t("general.error"), t("profile.followRequestError"));
    }
  };

  // Takipten çıkma fonksiyonu
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
    console.log("handlePressFollowers called");
    await fetchFollowersList(userId, (followers) => {
      if (followers.length === 0) {
        Alert.alert(t("profile.followers"), t("profile.noFollowersYet"));
        return;
      }

      setCurrentList(followers);
      setActiveListType("followers");
      setListModalVisible(true);
    });
  };

  // Takip edilen listesini aç
  const handlePressFollowing = async () => {
    console.log("handlePressFollowing called");
    await fetchFollowingList(userId, (following) => {
      if (following.length === 0) {
        Alert.alert(t("profile.following"), t("profile.notFollowingAnyoneYet"));
        return;
      }

      setCurrentList(following);
      setActiveListType("following");
      setListModalVisible(true);
    });
  };

  // Liste modal'ını kapat
  const closeListModal = () => {
    setListModalVisible(false);
    setCurrentList([]);
  };

  // Kullanıcı öğesi render et
  const renderUserItem = ({ item }: { item: FollowUser }) => (
    <View className="flex-row items-center p-4 border-b border-gray-100 hover:bg-gray-50">
      <View className="relative">
        <Image
          source={
            item.profile_image
              ? { uri: item.profile_image }
              : require("@/assets/images/ball.png")
          }
          className="rounded-full border-2 border-green-200"
          style={{ width: 55, height: 55, resizeMode: "cover" }}
        />
        {/* <View className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></View> */}
      </View>
      <View className="ml-4 flex-1">
        <Text className="text-lg font-semibold text-green-700">
          {item.name} {item.surname}
        </Text>
                                <Text className="text-sm text-gray-500 mt-1">
                          {activeListType === "followers"
                            ? t("profile.followingYou")
                            : t("profile.youFollowing")}
                        </Text>
      </View>
      {/* <Ionicons name="chevron-forward" size={20} color="#16a34a" /> */}
    </View>
  );

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
          
          <View className="bg-white rounded-2xl w-11/12 h-3/4 overflow-hidden">
            <ScrollView
              className="flex-1"
              scrollEnabled={!listModalVisible}
              nestedScrollEnabled={true}
            >
              <View className="pt-8">
                <View className="flex flex-row bg-white rounded-lg shadow-lg px-4 mb-2">
                  {/* Profil Resmi */}
                  <View className="w-1/4 py-2">
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
                        className="rounded-full mx-auto"
                        style={{ width: 90, height: 90, resizeMode: "contain" }}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Bilgiler */}
                  <View className="w-3/4 pl-4">
                    <Text className="font-semibold text-lg text-green-700 my-1">
                      {userData?.name || t("profile.noName")}{" "}
                      {userData?.surname || ""}
                    </Text>

                    <View className="flex-row flex-wrap justify-between mb-1">
                      <Text className="text-wrap font-semibold">
                        {t("profile.age")}:
                      </Text>
                      <Text className="text-green-600 font-semibold">
                        {" "}
                        {userData?.age || "-"}{" "}
                      </Text>
                      <Text className="font-semibold">
                        {t("profile.height")}:
                      </Text>
                      <Text className="text-green-600 font-semibold">
                        {" "}
                        {userData?.height || "-"} {t("units.cm")} {" "}
                      </Text>
                      <Text className="font-semibold">
                        {t("profile.weight")}:
                      </Text>
                      <Text className="text-green-600 font-semibold">
                        {" "}
                        {userData?.weight || "-"} {t("units.kg")} {" "}
                      </Text>
                      <Text className="text-wrap font-semibold mb-1">
                        <Text className="font-semibold">
                          {t("profile.position")}:
                        </Text>
                        <Text className="text-green-600 font-semibold mb-1">
                          {" "}
                          {userData?.description ||
                            t("profile.noDescription")}{" "}
                        </Text>
                      </Text>
                    </View>

                    {/* Takip Et / Takip İsteğini Geri Çek Butonu */}
                    {isFollowing && followStatus === "accepted" ? (
                      <View className="flex-row space-x-2">
                        <TouchableOpacity
                          className="w-full bg-green-700 px-4 py-2 rounded"
                          onPress={handleUnfollow}
                        >
                          <Text className="text-center font-bold text-white">
                            {t("profilePreview.youAreFollowing")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View className="flex-row">
                        <TouchableOpacity
                          onPress={handleFollow}
                          className={`w-full px-4 py-2 rounded ${
                            isFollowing ? "bg-gray-400" : "bg-green-700"
                          }`}
                          disabled={isFollowing}
                        >
                          <Text className="font-bold text-white text-center">
                            {isFollowing
                              ? t("profilePreview.followRequestPending")
                              : t("profile.follow")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>

                {isFollowing && followStatus === "accepted" && (
                  <View className="bg-white rounded-lg shadow-lg p-4">
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
                    {userData && <ProfileMatches userData={userData} />}
                  </View>
                )}

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
                    <View className="bg-white rounded-xl w-10/12 max-h-2/3 shadow-2xl border-2 border-green-700">
                      {/* Header */}
                      <View className="flex-row justify-between items-center p-4 border-b border-gray-200 bg-green-200 rounded-t-xl">
                        <Text className="text-xl font-bold text-green-700">
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
                            className="flex-row items-center p-4 border-b border-gray-100"
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
                              <Text className="text-sm text-gray-500 mt-1">
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
                  <View className="absolute inset-0 bg-white/60 z-50">
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
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
