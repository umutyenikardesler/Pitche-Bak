import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useLanguage } from "@/contexts/LanguageContext";

interface MatchCreatorProps {
  userName: string;
  userSurname: string;
  userId: string;
  onOpenProfilePreview?: (userId: string) => void;
}

export default function MatchCreator({
  userName,
  userSurname,
  userId,
  onOpenProfilePreview,
}: MatchCreatorProps) {
  const router = useRouter();
  const { t } = useLanguage();

  return (
    <View className="flex-row max-w-full items-center justify-center my-4">
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
  );
}

