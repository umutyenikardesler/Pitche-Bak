import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { POLICIES, PolicyKey } from "@/constants/policies";

interface PolicyModalProps {
  visible: boolean;
  onClose: () => void;
  policyKey: PolicyKey | null;
}

export default function PolicyModal({
  visible,
  onClose,
  policyKey,
}: PolicyModalProps) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  if (!policyKey) return null;

  const policy = POLICIES[policyKey];
  if (!policy) return null;

  const title = t(`settings.agreements.${policyKey}`) || policy.title;

  const safeTop = Platform.OS === "web" ? 0 : insets.top;
  const safeBottom = Platform.OS === "web" ? 0 : insets.bottom;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <View
        className="flex-1 justify-end"
        style={Platform.OS === "web" ? { alignItems: "center" } : undefined}
      >
        <View
          className="bg-white rounded-t-3xl flex-1"
          style={{
            paddingTop: safeTop,
            paddingBottom: safeBottom,
            borderTopWidth: 4,
            borderTopColor: "#16a34a",
            borderLeftWidth: 2,
            borderLeftColor: "#16a34a",
            borderRightWidth: 2,
            borderRightColor: "#16a34a",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 12,
            ...(Platform.OS === "web"
              ? {
                  width: "50%",
                  minWidth: 360,
                  maxWidth: 520,
                  alignSelf: "center",
                }
              : null),
          }}
        >
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Text
              className="text-lg font-bold text-green-600 flex-1"
              numberOfLines={2}
            >
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="bg-green-600 p-2 rounded-full ml-3"
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={true}
          >
            {policy.blocks.map((block, idx) => {
              if (block.type === "meta") {
                return (
                  <Text
                    key={idx}
                    className="text-xs text-gray-500 mb-3 italic"
                  >
                    {block.text}
                  </Text>
                );
              }
              if (block.type === "h3") {
                return (
                  <Text
                    key={idx}
                    className="text-base font-bold text-gray-900 mt-4 mb-2"
                  >
                    {block.text}
                  </Text>
                );
              }
              if (block.type === "li") {
                return (
                  <View key={idx} className="flex-row mb-2">
                    <Text className="text-gray-700 mr-2">•</Text>
                    <Text className="text-gray-700 flex-1">{block.text}</Text>
                  </View>
                );
              }
              return (
                <Text key={idx} className="text-gray-700 mb-3">
                  {block.text}
                </Text>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
