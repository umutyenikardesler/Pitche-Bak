import { useEffect, useState, useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import "@/global.css";

import ProfileInfo from "@/components/profile/ProfileInfo";
import ProfileStatus from "@/components/profile/ProfileStatus";
import ProfileCondition from "@/components/profile/ProfileCondition";
import ProfileMatches from "@/components/profile/ProfileMatches";

export default function Profile() {
  const searchParams = useLocalSearchParams();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
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
  const [activeListType, setActiveListType] = useState<"followers" | "following" | null>(null);
  const [listModalVisible, setListModalVisible] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [profileImage, setProfileImage] = useState({ uri: null });
  const [editUserData, setEditUserData] = useState<UserDataType | null>(null);

  const openEditModal = () => {
    setEditUserData(userData ? { ...userData } : null);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditUserData(null);
  };

  useEffect(() => {
    fetchUserData();
  }, [searchParams.userId]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const fetchLatestProfileImage = async (userId: string) => {
    console.log("fetchLatestProfileImage çağrıldı, userId:", userId); // Log eklendi

    if (!userId) {
      console.error("userId yok, fetchLatestProfileImage'den çıkılıyor."); // Log eklendi
      return null;
    }

    const { data, error } = await supabase.storage
      .from("pictures")
      .list(`${userId}/`, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      console.error("Profil resmi alınamadı:", error); // Log eklendi
      return null;
    }

    if (!data || data.length === 0) {
      console.log("Profil resmi bulunamadı."); // Log eklendi
      return null;
    }

    const profileImages = data.filter((file) =>
      file.name.startsWith("profile_")
    );

    if (profileImages.length === 0) {
      console.log("profile_ ile başlayan resim bulunamadı."); // Log eklendi
      return null;
    }

    const latestImage = profileImages[0];
    const filePath = `${userId}/${latestImage.name}`;
    const { data: publicURLData } = supabase.storage
      .from("pictures")
      .getPublicUrl(filePath);

    console.log("En son profil resmi URL'si:", publicURLData.publicUrl); // Log eklendi
    return publicURLData.publicUrl;
  };

  // Kullanıcı verisini çek
  const fetchUserData = async (): Promise<void> => {
    console.log("fetchUserData çağrıldı"); // Log eklendi

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

    let userIdToFetch =
      searchParams.userId || (await supabase.auth.getUser()).data?.user?.id;
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

  const pickImage = async (): Promise<void> => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const fileName = `profile_${Date.now()}.jpg`;
      const filePath = `${userData!.id}/${fileName}`;

      const { error } = await supabase.storage
        .from("pictures")
        .upload(filePath, await (await fetch(uri)).blob());

      if (error) {
        Alert.alert("Hata", "Resim yüklenirken bir hata oluştu.");
        return;
      }

      const { data: publicURLData } = supabase.storage
        .from("pictures")
        .getPublicUrl(filePath);
      setProfileImage({ uri: publicURLData.publicUrl as any });

      await supabase
        .from("users")
        .update({ profile_image: publicURLData.publicUrl })
        .eq("id", userData!.id);
      fetchUserData();
      Alert.alert("Başarılı", "Resminiz başarıyla yüklendi!"); // Başarılı uyarı eklendi
    }
  };

  const handleSave = async () => {
    if (!editUserData) return;
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
      setEditModalVisible(false);
      setEditUserData(null);
      fetchUserData();
    }
  };

  // Sayfayı yenileme işlemi
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  };

  const handleLogout = async (): Promise<void> => {
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
      .map((u: any) => ({ id: u.id, name: u.name, surname: u.surname, profile_image: u.profile_image }));

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
      .map((u: any) => ({ id: u.id, name: u.name, surname: u.surname, profile_image: u.profile_image }));

    setFollowingList(ordered);
  };

  const openUserListModal = async (type: "followers" | "following") => {
    try {
      console.log("openUserListModal -> tıklandı, type:", type);
      // Önce güvenilir userId'yi belirle
      const authUserId = (await supabase.auth.getUser()).data?.user?.id || null;
      const paramUserIdRaw = searchParams.userId as string | string[] | undefined;
      const paramUserId = typeof paramUserIdRaw === "string" ? paramUserIdRaw : null;
      const userIdToFetch: string | null = paramUserId || authUserId || null;

      console.log("openUserListModal -> userIdToFetch:", userIdToFetch);

      if (!userIdToFetch) {
        console.warn("openUserListModal -> Kullanıcı ID alınamadı!");
        return;
      }

      setUserId(userIdToFetch);
      setActiveListType(type);
      setListModalVisible(true);
      console.log("openUserListModal -> listModalVisible TRUE yapıldı");

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
    console.log("listModalVisible:", listModalVisible, "activeListType:", activeListType);
  }, [listModalVisible, activeListType]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      refreshControl={
        !editModalVisible && (
          <RefreshControl refreshing={refreshing} onRefresh={fetchUserData} />
        )
      }
    >
      <View className="bg-white rounded-lg m-3 p-1 shadow-lg flex-1">
        <View className="flex-1">
          <ProfileInfo
            userData={userData}
            fetchUserData={fetchUserData}
            setModalVisible={setModalVisible}
            setEditModalVisible={openEditModal}
            pickImage={pickImage}
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
            refreshing={refreshing}
            onRefresh={fetchUserData}
          />
        </View>
        <View className="flex pb-4 mt-auto">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-green-600 mx-4 rounded-lg"
          >
            <Text className="text-white font-semibold text-center p-2">
              Çıkış Yap
            </Text>
          </TouchableOpacity>
        </View>

        {/* 🔹 PROFİL FOTOĞRAFI MODALI */}
        <Modal
          visible={modalVisible}
          transparent={true}
          onRequestClose={() => setModalVisible(false)}
        >
          <TouchableOpacity
            className="flex-1 justify-center items-center bg-white/95"
            activeOpacity={1}
            onPressOut={() => setModalVisible(false)}
          >
            <TouchableOpacity activeOpacity={1}>
              <Image
                source={
                  userData?.profile_image
                    ? { uri: userData.profile_image }
                    : require("@/assets/images/ball.png")
                }
                style={{ width: 280, height: 280, resizeMode: "contain" }}
                className="rounded-full"
              />
              <TouchableOpacity onPress={pickImage} className="static">
                <View className="absolute -bottom-5 right-[7%] m-3 shadow-slate-600">
                  <View className="p-2 bg-white rounded-full absolute bottom-0 right-0 ">
                    <Ionicons
                      name="color-wand"
                      size={22}
                      color="white"
                      className="bg-green-700 rounded-full p-3"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* 🔹 BİLGİ DÜZENLEME MODALI */}
        {editUserData && (
          <Modal
            visible={editModalVisible}
            transparent={true}
            animationType="fade"
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View className="flex-1 justify-center items-center bg-black/50">
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : "height"}
                  className="w-full"
                >
                  <View
                    style={{
                      justifyContent: "center",
                      alignItems: "center",
                      padding: 10,
                    }}
                  >
                    <View className="bg-white p-6 rounded-lg w-3/4">
                      <Text className="text-xl font-bold text-center text-green-700 mb-4">
                        Kişisel Bilgilerini Tamamla
                      </Text>

                      <TextInput
                        placeholder="Adınız"
                        value={editUserData?.name || ""}
                        onChangeText={(text) =>
                          setEditUserData({ ...editUserData, name: text })
                        }
                        className="border border-gray-300 rounded p-2 mb-2"
                      />
                      <TextInput
                        placeholder="Soyadınız"
                        value={editUserData?.surname || ""}
                        onChangeText={(text) =>
                          setEditUserData({ ...editUserData, surname: text })
                        }
                        className="border border-gray-300 rounded p-2 mb-2"
                      />
                      <TextInput
                        placeholder="Yaş"
                        value={editUserData?.age?.toString() || ""}
                        onChangeText={(text) =>
                          setEditUserData({ ...editUserData, age: text })
                        }
                        className="border border-gray-300 rounded p-2 mb-2"
                        keyboardType="numeric"
                      />
                      <TextInput
                        placeholder="Boy (cm)"
                        value={editUserData?.height?.toString() || ""}
                        onChangeText={(text) =>
                          setEditUserData({ ...editUserData, height: text })
                        }
                        className="border border-gray-300 rounded p-2 mb-2"
                        keyboardType="numeric"
                      />
                      <TextInput
                        placeholder="Kilo (kg)"
                        value={editUserData?.weight?.toString() || ""}
                        onChangeText={(text) =>
                          setEditUserData({ ...editUserData, weight: text })
                        }
                        className="border border-gray-300 rounded p-2 mb-2"
                        keyboardType="numeric"
                      />
                      <TextInput
                        placeholder="Mevki / Biyografi"
                        value={editUserData?.description || ""}
                        onChangeText={(text) =>
                          setEditUserData({
                            ...editUserData,
                            description: text,
                          })
                        }
                        className="border border-gray-300 rounded p-2 mb-2"
                        multiline
                      />

                      <View className="flex-row justify-between mt-3">
                        <Text
                          className="text-white font-semibold bg-red-500 p-2 rounded-lg"
                          onPress={closeEditModal}
                        >
                          {" "}
                          İptal Et{" "}
                        </Text>
                        <Text
                          className="text-white font-semibold bg-green-600 p-2 rounded-lg"
                          onPress={handleSave}
                        >
                          {" "}
                          Kaydet{" "}
                        </Text>
                      </View>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </View>
            </TouchableWithoutFeedback>
          </Modal>
        )}

        {/* 🔹 TAKİPÇİ VE TAKİP EDİLEN LİSTESİ MODALI */}
        <Modal
          visible={listModalVisible}
          onRequestClose={() => setListModalVisible(false)}
          transparent
          animationType="fade"
          statusBarTranslucent
        >
          <View className="flex-1 bg-black/50 justify-center items-center">
            {/* Boş alana tıklayınca kapatma */}
            <TouchableOpacity
              className="absolute inset-0"
              onPress={() => setListModalVisible(false)}
              activeOpacity={1}
            />

            {/* Modal içeriği */}
            <View className="bg-white rounded-xl w-10/12 max-h-2/3 shadow-2xl">
              {/* Header */}
              <View className="flex-row justify-between items-center p-4 border-b border-gray-200 bg-green-50 rounded-t-xl">
                <Text className="text-xl font-bold text-green-700">
                  {activeListType === "followers" ? "Takipçiler" : "Takip Edilenler"}
                </Text>
                <TouchableOpacity
                  onPress={() => setListModalVisible(false)}
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
                nestedScrollEnabled
                bounces={false}
              >
                {(activeListType === "followers" ? followersList : followingList).map(
                  (u) => (
                    <View key={u.id} className="flex-row items-center p-4 border-b border-gray-100">
                      <Image
                        source={u.profile_image ? { uri: u.profile_image } : require("@/assets/images/ball.png")}
                        className="rounded-full border-2 border-green-200"
                        style={{ width: 55, height: 55, resizeMode: "cover" }}
                      />
                      <View className="ml-4 flex-1">
                        <Text className="text-lg font-semibold text-green-700">
                          {u.name} {u.surname}
                        </Text>
                        <Text className="text-sm text-gray-500 mt-1">
                          {activeListType === "followers" ? "Seni takip ediyor" : "Takip ediyorsun"}
                        </Text>
                      </View>
                    </View>
                  )
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
}
