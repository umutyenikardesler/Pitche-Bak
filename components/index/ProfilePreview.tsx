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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";
import { useState, useEffect, useCallback } from "react";
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

export default function ProfilePreview({
  isVisible,
  onClose,
  userId,
}: ProfilePreviewProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStatus, setFollowStatus] = useState<
    "pending" | "accepted" | null
  >(null);
  const [isFollowedByProfileUser, setIsFollowedByProfileUser] = useState(false);

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
        Alert.alert("Hata", "Kullanıcı oturumu bulunamadı");
        return;
      }

      // Kendi kullanıcı bilgini çek
      const { data: senderData, error: senderError } = await supabase
        .from("users")
        .select("name, surname")
        .eq("id", user.id)
        .single();

      if (senderError) {
        Alert.alert("Hata", "Kendi kullanıcı bilgilerin alınamadı");
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
            "Hata",
            "Zaten takip isteği gönderdiniz veya takip ediyorsunuz."
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
            message: `${senderData?.name} ${senderData?.surname} sizi takip etmek istiyor`,
            is_read: false,
            created_at: turkiyeNow.toISOString(), // <-- Türkiye saatiyle kaydet
          },
        ]);

      if (notificationError) {
        console.error("Bildirim oluşturma hatası:", notificationError);
      }

      setIsFollowing(true);
      setFollowStatus("pending");
      Alert.alert("Başarılı", "Takip isteği gönderildi");
      fetchData();
    } catch (error) {
      console.error("Takip isteği gönderilirken hata:", error);
      Alert.alert(
        "Hata",
        "Takip isteği gönderilirken bir hata oluştu. Lütfen tekrar deneyin."
      );
    }
  };

  // Takipten çıkma fonksiyonu
  const handleUnfollow = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert("Hata", "Kullanıcı oturumu bulunamadı");
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
      Alert.alert("Başarılı", "Takipten çıkıldı");
      fetchData();
    } catch (error) {
      console.error("Takipten çıkılırken hata:", error);
      Alert.alert(
        "Hata",
        "Takipten çıkılırken bir hata oluştu. Lütfen tekrar deneyin."
      );
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-gray-100">
        <View className="flex-1 bg-white mt-12 rounded-t-2xl overflow-hidden">
          <View className="flex-row justify-end items-center p-4 border-b border-gray-200">
            <TouchableOpacity
              onPress={handleClose}
              className="bg-green-700 px-4 py-2 rounded-full"
            >
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1">
            <View className="p-4">
              <View className="flex flex-row bg-white rounded-lg shadow-lg px-4 py-2 mb-4">
                {/* Profil Resmi */}
                <View className="w-1/4 py-2 px-1">
                  <Image
                    source={
                      userData?.profile_image
                        ? { uri: userData.profile_image }
                        : require("@/assets/images/ball.png")
                    }
                    className="rounded-full mx-auto"
                    style={{ width: 90, height: 90, resizeMode: "contain" }}
                  />
                </View>

                {/* Bilgiler */}
                <View className="w-3/4 pl-8">
                  <Text className="font-semibold text-lg text-green-700 my-1">
                    {userData?.name || "İsim Yok"} {userData?.surname || ""}
                  </Text>

                  <View className="flex-row justify-between mb-1">
                    <Text className="text-wrap font-semibold">Yaş:</Text>
                    <Text className="text-green-600 font-semibold">
                      {" "}
                      {userData?.age || "-"}{" "}
                    </Text>
                    <Text className="font-semibold">Boy:</Text>
                    <Text className="text-green-600 font-semibold">
                      {" "}
                      {userData?.height || "-"} cm{" "}
                    </Text>
                    <Text className="font-semibold">Ağırlık:</Text>
                    <Text className="text-green-600 font-semibold">
                      {" "}
                      {userData?.weight || "-"} kg
                    </Text>
                  </View>

                  <Text className="text-wrap font-semibold mb-1">
                    <Text className="font-semibold">Mevki:</Text>
                    <Text className="text-green-600 font-semibold mb-1">
                      {" "}
                      {userData?.description || "Açıklama Yok"}{" "}
                    </Text>
                  </Text>

                  {/* Takip Et / Takip İsteğini Geri Çek Butonu */}
                  {isFollowing && followStatus === "accepted" ? (
                    <View className="flex-row space-x-2">
                      <TouchableOpacity
                        className="w-full bg-green-700 px-4 py-2 rounded"
                        onPress={handleUnfollow}
                      >
                        <Text className="text-center font-bold text-white">
                          Takip Ediliyor
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
                            ? "Takip isteğin gönderildi"
                            : "Takip Et"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {isFollowing && followStatus === "accepted" && (
                <View className="bg-white rounded-lg shadow-lg p-4">
                  {/* ProfileStatus bileşeni */}
                  <ProfileStatus matchCount={userData?.match_count || 0} />

                  {/* ProfileCondition bileşeni */}
                  <ProfileCondition matchCount={userData?.match_count || 0} />

                  {/* ProfileMatches bileşeni */}
                  <ProfileMatches userData={userData} />
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
