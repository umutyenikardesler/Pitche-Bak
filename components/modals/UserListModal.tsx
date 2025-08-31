import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
}

export default function UserListModal({
  visible,
  onClose,
  activeListType,
  followersList,
  followingList,
}: UserListModalProps) {
  const currentList = activeListType === "followers" ? followersList : followingList;
  const title = activeListType === "followers" ? "Takipçiler" : "Takip Edilenler";

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
          <View className="flex-row justify-between items-center p-4 border-b border-gray-200 bg-green-50 rounded-t-xl">
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
            nestedScrollEnabled
            bounces={false}
          >
            {currentList.map((u) => (
              <View
                key={u.id}
                className="flex-row items-center p-4 border-b border-gray-100"
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
                    {activeListType === "followers"
                      ? "Seni takip ediyor"
                      : "Takip ediyorsun"}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
