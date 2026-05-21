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
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";

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
  isFirstLogin?: boolean;
}

export default function EditProfileModal({
  visible,
  onClose,
  editUserData,
  onSave,
  onEditUserDataChange,
  isFirstLogin = false,
}: EditProfileModalProps) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();

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





  // İlk girişte tüm alanların dolu olup olmadığını kontrol et
  const isFormComplete = editUserData?.name && editUserData?.surname && 
    editUserData?.age && editUserData?.height && 
    editUserData?.weight && editUserData?.description;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={isFirstLogin && !isFormComplete ? undefined : onClose}
    >
      <TouchableWithoutFeedback onPress={isFirstLogin && !isFormComplete ? undefined : onClose}>
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: colors.overlay }}>
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
              <View
                className="p-6 rounded-lg w-3/4"
                style={
                  {
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    shadowColor: colors.primary,
                    shadowOpacity: 0.35,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 8,
                    ...(Platform.OS === "web"
                      ? {
                          width: "36%",
                          minWidth: 320,
                          maxWidth: 520,
                          alignSelf: "center",
                          boxShadow: `0 0 18px ${colors.primary}`,
                        }
                      : undefined),
                  }
                }
              >
                <Text className="text-xl font-bold text-center mb-4" style={{ color: colors.primaryDark }}>
                  {t("profile.completePersonalInfo")}
                </Text>

                <View className="flex-row items-center mb-2">
                  <Text className="font-bold w-20" style={{ color: colors.primaryDark }}>{t("profile.field.name")}:</Text>
                  <TextInput
                    placeholder={t("profile.name")}
                    value={editUserData?.name || ""}
                    onChangeText={(text) => handleInputChange("name", text)}
                    className="rounded p-2 flex-1 ml-2"
                    style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="font-bold w-20" style={{ color: colors.primaryDark }}>{t("profile.field.surname")}:</Text>
                  <TextInput
                    placeholder={t("profile.surname")}
                    value={editUserData?.surname || ""}
                    onChangeText={(text) => handleInputChange("surname", text)}
                    className="rounded p-2 flex-1 ml-2"
                    style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="font-bold w-20" style={{ color: colors.primaryDark }}>{t("profile.field.age")}:</Text>
                  <TextInput
                    placeholder={t("profile.age")}
                    value={editUserData?.age?.toString() || ""}
                    onChangeText={(text) => handleInputChange("age", text)}
                    className="rounded p-2 flex-1 ml-2"
                    style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="font-bold w-20" style={{ color: colors.primaryDark }}>{t("profile.field.height")}:</Text>
                  <TextInput
                    placeholder={t("profile.height")}
                    value={editUserData?.height?.toString() || ""}
                    onChangeText={(text) => handleInputChange("height", text)}
                    className="rounded p-2 flex-1 ml-2"
                    style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="font-bold w-20" style={{ color: colors.primaryDark }}>
                    {t("profile.field.weight")} ({t("units.kg")}):
                  </Text>
                  <TextInput
                    placeholder={t("profile.weight")}
                    value={editUserData?.weight?.toString() || ""}
                    onChangeText={(text) => handleInputChange("weight", text)}
                    className="rounded p-2 flex-1 ml-2"
                    style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
                
                <View className="flex-row items-center mb-2">
                  <Text className="font-bold w-20" style={{ color: colors.primaryDark }}>{t("profile.field.position")}:</Text>
                  <TextInput
                    placeholder={t("profile.description")}
                    value={editUserData?.description || ""}
                    onChangeText={(text) => handleInputChange("description", text)}
                    className="rounded p-2 flex-1 ml-2"
                    style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text }}
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                </View>

                <View className="flex-row justify-between mt-3">
                  {!isFirstLogin && (
                    <TouchableOpacity
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: colors.danger }}
                      onPress={onClose}
                    >
                      <Text className="text-white font-semibold text-lg px-8">
                        {t("general.cancel")}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    className={`${isFirstLogin ? 'flex-1' : ''} p-2 rounded-lg`}
                    style={{ backgroundColor: colors.primary }}
                    onPress={onSave}
                  >
                    <Text className="text-white font-semibold text-lg text-center px-4">
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
