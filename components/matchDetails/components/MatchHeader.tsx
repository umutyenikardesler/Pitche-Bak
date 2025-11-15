import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";

interface MatchHeaderProps {
  title: string;
}

export default function MatchHeader({ title }: MatchHeaderProps) {
  const { t } = useLanguage();

  return (
    <>
      <View className="flex-row mb-3 justify-center items-center bg-green-100 border-2 border-green-300 rounded-lg py-3 px-2">
        <Ionicons name="accessibility-outline" size={20} color="green" />
        <Text className="text-xl font-bold text-green-700 ml-3"> {t('home.matchSummary')} </Text>
      </View>
      <Text className="text-xl text-green-700 font-semibold text-center mt-1 mb-2">{title}</Text>
    </>
  );
}

