import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  visible,
  onClose,
}: SettingsModalProps) {
  const { currentLanguage, changeLanguage, t } = useLanguage();
  const [languageOptionsVisible, setLanguageOptionsVisible] = useState(false);

  const handleLanguageChange = async (language: "tr" | "en") => {
    try {
      await changeLanguage(language);
      setLanguageOptionsVisible(false);
      Alert.alert(
        t("language.changed"),
        language === "tr" 
          ? t("language.changedToTurkish")
          : t("language.changedToEnglish")
      );
    } catch (error) {
      Alert.alert(
        t("general.error"),
        language === "tr" 
          ? "Dil değiştirilemedi"
          : "Language could not be changed"
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View className="flex-1 justify-end">
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          className="bg-white rounded-t-3xl h-1/2"
          style={{
            borderTopWidth: 4,
            borderTopColor: "#16a34a",
            borderLeftWidth: 2,
            borderLeftColor: "#16a34a",
            borderRightWidth: 2,
            borderRightColor: "#16a34a",
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: -6,
            },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 12,
          }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Text className="text-xl font-bold text-green-600">
              {t("profile.settings")}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="bg-green-600 p-2 rounded-full"
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* İçerik */}
          <View className="flex-1 p-4">
            <TouchableOpacity
              className="flex-row items-center justify-between p-3 bg-green-600 rounded-lg mb-3"
              activeOpacity={1}
              onPress={() =>
                setLanguageOptionsVisible(!languageOptionsVisible)
              }
            >
              <View className="flex-row items-center">
                <Ionicons name="language" size={24} color="white" />
                <Text className="text-white font-semibold text-lg ml-3">
                  {t("language.settings")}
                </Text>
              </View>
              <Ionicons
                name={
                  languageOptionsVisible ? "chevron-up" : "chevron-down"
                }
                size={24}
                color="white"
              />
            </TouchableOpacity>

            {/* Dil Seçenekleri */}
            {languageOptionsVisible && (
              <View className="mb-3">
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-row items-center justify-between p-3 rounded-lg flex-1 mr-2 ${
                      currentLanguage === "tr"
                        ? "bg-green-100 border-2 border-green-600"
                        : "bg-gray-100"
                    }`}
                    onPress={() => handleLanguageChange("tr")}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-lg font-semibold text-gray-800">
                        🇹🇷 {t("language.turkish")}
                      </Text>
                    </View>
                    {currentLanguage === "tr" && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#16a34a"
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={`flex-row items-center justify-between p-3 rounded-lg flex-1 ml-2 ${
                      currentLanguage === "en"
                        ? "bg-green-100 border-2 border-green-600"
                        : "bg-gray-100"
                    }`}
                    onPress={() => handleLanguageChange("en")}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-lg font-semibold text-gray-800">
                        🇬🇧 {t("language.english")}
                      </Text>
                    </View>
                    {currentLanguage === "en" && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#16a34a"
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Diğer ayar seçenekleri buraya eklenebilir */}
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
