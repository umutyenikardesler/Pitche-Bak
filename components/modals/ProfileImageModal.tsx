import React, { useEffect } from "react";
import { Modal, TouchableOpacity, Image, Alert, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ProfileImageModalProps {
  visible: boolean;
  onClose: () => void;
  profileImage?: string;
  onPickImage: () => Promise<void>;
}

export default function ProfileImageModal({
  visible,
  onClose,
  profileImage,
  onPickImage,
}: ProfileImageModalProps) {
  
  // Modal açıldığında resim güncellendiğinde otomatik yenile
  useEffect(() => {
    if (visible) {
      if (profileImage) {
        console.log("ProfileImageModal açıldı, resim:", profileImage);
      } else {
        console.log("ProfileImageModal açıldı, default resim kullanılıyor");
      }
    }
  }, [visible, profileImage]);

  // Modal kapandığında state temizle
  useEffect(() => {
    if (!visible) {
      console.log("ProfileImageModal kapandı, state temizleniyor...");
      // Modal kapandığında tüm state'leri temizle
      setTimeout(() => {
        console.log("ProfileImageModal state tamamen temizlendi");
      }, 100);
    }
  }, [visible]);
  return (
    <Modal
      visible={visible}
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        className="flex-1 justify-center items-center bg-white/95"
        activeOpacity={1}
        onPressOut={onClose}
        style={{ zIndex: 9998 }}
      >
        <TouchableOpacity activeOpacity={1}>
          <Image
            source={
              profileImage
                ? { uri: profileImage }
                : require("@/assets/images/ball.png")
            }
            style={{ width: 280, height: 280, resizeMode: "contain" }}
            className="rounded-full"
          />
          <TouchableOpacity onPress={onPickImage} className="static">
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
  );
}
