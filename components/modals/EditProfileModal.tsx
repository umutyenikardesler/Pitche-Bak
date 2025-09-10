import React from "react";
import {
  Modal,
  TouchableWithoutFeedback,
  View,
  TextInput,
  Text,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";

interface UserDataType {
  id: string;
  name?: string;
  surname?: string;
  age?: number;
  height?: number;
  weight?: number;
  description?: string;
}

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  editUserData: UserDataType | null;
  onSave: () => void;
  onEditUserDataChange: (data: UserDataType) => void;
}

export default function EditProfileModal({
  visible,
  onClose,
  editUserData,
  onSave,
  onEditUserDataChange,
}: EditProfileModalProps) {
  const { t } = useLanguage();

  // Modal kapandığında state temizle
  React.useEffect(() => {
    if (!visible) {
      console.log("EditProfileModal kapandı, state temizleniyor...");
    }
  }, [visible]);

  if (!editUserData) return null;

  const handleInputChange = (field: keyof UserDataType, value: string) => {
    let parsedValue: string | number = value;
    
    // Sayısal alanlar için parse et
    if (field === 'age' || field === 'height' || field === 'weight') {
      parsedValue = value === '' ? 0 : parseInt(value) || 0;
    }
    
    onEditUserDataChange({ ...editUserData, [field]: parsedValue });
  };





  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <TouchableWithoutFeedback onPress={onClose}>
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
                  {t("profile.completePersonalInfo")}
                </Text>

                <View className="flex-row items-center mb-2">
                  <Text className="text-green-700 font-bold w-20">Ad:</Text>
                  <TextInput
                    placeholder={t("profile.name")}
                    value={editUserData?.name || ""}
                    onChangeText={(text) => handleInputChange("name", text)}
                    className="border border-gray-300 rounded p-2 flex-1 ml-2"
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="text-green-700 font-bold w-20">Soyad:</Text>
                  <TextInput
                    placeholder={t("profile.surname")}
                    value={editUserData?.surname || ""}
                    onChangeText={(text) => handleInputChange("surname", text)}
                    className="border border-gray-300 rounded p-2 flex-1 ml-2"
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="text-green-700 font-bold w-20">Yaş:</Text>
                  <TextInput
                    placeholder={t("profile.age")}
                    value={editUserData?.age?.toString() || ""}
                    onChangeText={(text) => handleInputChange("age", text)}
                    className="border border-gray-300 rounded p-2 flex-1 ml-2"
                    keyboardType="numeric"
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="text-green-700 font-bold w-20">Boy:</Text>
                  <TextInput
                    placeholder={t("profile.height")}
                    value={editUserData?.height?.toString() || ""}
                    onChangeText={(text) => handleInputChange("height", text)}
                    className="border border-gray-300 rounded p-2 flex-1 ml-2"
                    keyboardType="numeric"
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="text-green-700 font-bold w-20">Kilo (kg):</Text>
                  <TextInput
                    placeholder={t("profile.weight")}
                    value={editUserData?.weight?.toString() || ""}
                    onChangeText={(text) => handleInputChange("weight", text)}
                    className="border border-gray-300 rounded p-2 flex-1 ml-2"
                    keyboardType="numeric"
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="text-green-700 font-bold w-20">Mevki:</Text>
                  <TextInput
                    placeholder={t("profile.description")}
                    value={editUserData?.description || ""}
                    onChangeText={(text) => handleInputChange("description", text)}
                    className="border border-gray-300 rounded p-2 flex-1 ml-2"
                    multiline
                  />
                </View>

                <View className="flex-row justify-between mt-3">
                  <TouchableOpacity
                    className="bg-red-500 p-2 rounded-lg"
                    onPress={onClose}
                  >
                    <Text className="text-white font-semibold text-lg px-8">
                      {t("general.cancel")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-green-600 p-2 rounded-lg"
                    onPress={onSave}
                  >
                    <Text className="text-white font-semibold text-lg px-4">
                      {t("general.save")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
