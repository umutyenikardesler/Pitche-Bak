import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";

interface MatchHeaderProps {
  title: string;
}

export default function MatchHeader({ title }: MatchHeaderProps) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();

  return (
    <>
      <View
        className="flex-row mb-3 justify-center items-center rounded-lg py-3 px-2"
        style={{ backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.primary }}
      >
        <Ionicons name="accessibility-outline" size={20} color={colors.primary} />
        <Text className="text-xl font-bold ml-3" style={{ color: colors.primaryDark }}> {t('home.matchSummary')} </Text>
      </View>
      <Text className="text-xl font-semibold text-center mt-1 mb-2" style={{ color: colors.primaryDark }}>{title}</Text>
    </>
  );
}

