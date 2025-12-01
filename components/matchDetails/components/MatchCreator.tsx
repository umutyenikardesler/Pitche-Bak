import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "@/contexts/LanguageContext";

interface MatchCreatorProps {
  userName: string;
  userSurname: string;
  userId: string;
  onOpenProfilePreview?: (userId: string) => void;
  onEditPositions?: () => void;
  canEditPositions?: boolean;
}

export default function MatchCreator({
  userName,
  userSurname,
  userId,
  onOpenProfilePreview,
  onEditPositions,
  canEditPositions = false,
}: MatchCreatorProps) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <View className="items-center my-4">
      <View className="flex-row max-w-full items-center justify-center">
        <Text className="font-semibold">{t('home.matchCreatedBy')} </Text>
        <TouchableOpacity
          onPress={() => {
            if (onOpenProfilePreview) {
              onOpenProfilePreview(userId);
            } else {
              router.push({ pathname: "./", params: { userId } });
            }
          }}
        >
          <Text className="text-green-700 font-semibold">
            {userName} {userSurname}
          </Text>
        </TouchableOpacity>
      </View>
      {canEditPositions && onEditPositions && (
        <TouchableOpacity
          onPress={onEditPositions}
          className="mt-2 bg-green-600 px-4 py-2 rounded-md"
        >
          <Text className="text-white font-semibold text-sm">Pozisyonları Düzenle</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

