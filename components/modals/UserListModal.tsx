import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import ProfilePreview from "@/components/index/ProfilePreview";

interface FollowUser {
  id: string;
  name: string;
  surname: string;
  profile_image?: string;
}

interface UserListModalProps {
  visible: boolean;
  onClose: () => void;
  activeListType: "followers" | "following" | null;
  followersList: FollowUser[];
  followingList: FollowUser[];
  onUnfollow?: (userId: string) => void;
}

export default function UserListModal({
  visible,
  onClose,
  activeListType,
  followersList,
  followingList,
  onUnfollow,
}: UserListModalProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profilePreviewVisible, setProfilePreviewVisible] = useState(false);
  const [followingStatusMap, setFollowingStatusMap] = useState<Map<string, "accepted" | "pending" | null>>(new Map());
  
  const currentList = activeListType === "followers" ? followersList : followingList;
  const title = activeListType === "followers" ? "Takipçiler" : "Takip Edilenler";

  // Her kullanıcı için takip durumunu kontrol et
  useEffect(() => {
    const checkFollowingStatus = async () => {
      if (!visible || currentList.length === 0) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const statusMap = new Map<string, "accepted" | "pending" | null>();

      // Tüm kullanıcılar için takip durumunu toplu kontrol et (accepted ve pending)
      const userIds = currentList.map(u => u.id);
      const { data: followData } = await supabase
        .from("follow_requests")
        .select("following_id, status")
        .eq("follower_id", user.id)
        .in("following_id", userIds)
        .in("status", ["accepted", "pending"]);

      if (followData) {
        followData.forEach((item: any) => {
          statusMap.set(item.following_id, item.status === "accepted" ? "accepted" : "pending");
        });
      }

      setFollowingStatusMap(statusMap);
    };

    checkFollowingStatus();
  }, [visible, currentList]);

  const handleUserPress = (userId: string) => {
    setSelectedUserId(userId);
    setProfilePreviewVisible(true);
  };

  const handleCloseProfilePreview = () => {
    setProfilePreviewVisible(false);
    setSelectedUserId(null);
  };

  const handleMessagePress = (userId: string, userName: string, userSurname: string) => {
    onClose();
    setTimeout(() => {
      router.push({
        pathname: '/message/chat',
        params: { 
          to: userId, 
          name: `${userName} ${userSurname}`.trim()
        }
      });
    }, 100);
  };

  const handleFollowPress = async (userId: string) => {
    try {
      const turkiyeNow = new Date(Date.now() + 3 * 60 * 60 * 1000); // UTC+3
      const { data: { user } } = await supabase.auth.getUser();
      
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
            created_at: turkiyeNow.toISOString(),
            updated_at: turkiyeNow.toISOString(),
          },
        ]);

      if (insertError) {
        if (insertError.code === "23505") {
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
            created_at: turkiyeNow.toISOString(),
          },
        ]);

      if (notificationError) {
        console.error("Bildirim oluşturma hatası:", notificationError);
      }

      // Takip durumunu güncelle (pending olarak)
      setFollowingStatusMap(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, "pending");
        return newMap;
      });

      Alert.alert(t("general.success"), t("profile.followRequestSentSuccess"));
    } catch (error) {
      console.error("Takip isteği gönderilirken hata:", error);
      Alert.alert(t("general.error"), t("profile.followRequestError"));
    }
  };

  const handleUnfollow = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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

      // State'ten kaldır
      setFollowingStatusMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });

      // Parent component'e bildir
      if (onUnfollow) {
        onUnfollow(userId);
      }

      Alert.alert(t("general.success"), t("profile.unfollowed"));
    } catch (error) {
      console.error("Takipten çıkılırken hata:", error);
      Alert.alert(t("general.error"), t("profile.unfollowError"));
    }
  };

  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/50 justify-center items-center">
        {/* Boş alana tıklayınca kapatma */}
        <TouchableOpacity
          className="absolute inset-0"
          onPress={onClose}
          activeOpacity={1}
        />

        {/* Modal içeriği */}
        <View className="bg-white rounded-xl w-10/12 max-h-2/3 shadow-2xl">
          {/* Header */}
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200 bg-green-200 rounded-t-xl">
            <Text className="text-xl font-bold text-green-700">
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="bg-green-700 px-3 py-1 rounded-full"
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Liste */}
          <ScrollView
            style={{ maxHeight: 335 }}
            contentContainerStyle={{ paddingBottom: 10 }}
            showsVerticalScrollIndicator
            bounces={false}
          >
            {currentList.length === 0 ? (
              activeListType === "following" ? (
                <View className="py-10 px-4 items-center justify-center">
                  <Text className="text-base text-gray-500 text-center">
                    Şuan hiç Takip ettiğiniz kişi Yok
                  </Text>
                </View>
              ) : (
                <View className="py-10 px-4 items-center justify-center">
                  <Text className="text-base text-gray-500 text-center">
                    Şu an hiç takipçiniz yok
                  </Text>
                </View>
              )
            ) : (
              currentList.map((u) => {
                const followStatus = followingStatusMap.get(u.id) || null;
                const isFollowing = followStatus === "accepted";
                const isPending = followStatus === "pending";
                const isFollowersList = activeListType === "followers";
                
                return (
                  <View
                    key={u.id}
                    className="flex-row items-center p-4 border-b border-gray-100"
                  >
                    <TouchableOpacity
                      className="flex-row items-center flex-1"
                      activeOpacity={0.7}
                      onPress={() => handleUserPress(u.id)}
                    >
                      <Image
                        source={
                          u.profile_image
                            ? { uri: u.profile_image }
                            : require("@/assets/images/ball.png")
                        }
                        className="rounded-full border-2 border-green-200"
                        style={{ width: 55, height: 55, resizeMode: "cover" }}
                      />
                      <View className="ml-4 flex-1">
                        <Text className="text-lg font-semibold text-green-700">
                          {u.name} {u.surname}
                        </Text>
                        <Text className="text-sm text-gray-500 mt-1">
                          {isFollowersList ? "Seni takip ediyor" : "Takip ediyorsun"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    
                    {/* Sağ taraftaki icon - Takipçiler listesinde */}
                    {isFollowersList && (
                      <TouchableOpacity
                        onPress={() => {
                          if (isFollowing) {
                            handleMessagePress(u.id, u.name, u.surname);
                          } else if (!isPending) {
                            handleFollowPress(u.id);
                          }
                        }}
                        className="ml-3 p-2"
                        activeOpacity={0.7}
                        disabled={isPending}
                      >
                        {isFollowing ? (
                          <Ionicons name="chatbubble-outline" size={24} color="#16a34a" />
                        ) : isPending ? (
                          <View className="relative">
                            <Ionicons name="person-add-outline" size={24} color="#f97316" />
                            <View className="absolute -top-1 -right-1">
                              <Ionicons name="time-outline" size={12} color="#f97316" />
                            </View>
                          </View>
                        ) : (
                          <Ionicons name="person-add-outline" size={24} color="#16a34a" />
                        )}
                      </TouchableOpacity>
                    )}

                    {/* Sağ taraftaki çıkarma butonu - Takip Edilenler listesinde */}
                    {!isFollowersList && (
                      <TouchableOpacity
                        onPress={() => handleUnfollow(u.id)}
                        className="ml-3 p-2"
                        activeOpacity={0.7}
                      >
                        <Ionicons name="person-remove-outline" size={24} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>

      {/* Profile Preview Modal - Nested modal içinde */}
      {selectedUserId && (
        <ProfilePreview
          isVisible={profilePreviewVisible}
          onClose={handleCloseProfilePreview}
          userId={selectedUserId}
        />
      )}
    </Modal>
  );
}
