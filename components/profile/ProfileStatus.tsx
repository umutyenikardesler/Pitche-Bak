import { View, Text, TouchableOpacity } from "react-native";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";

interface ProfileStatusProps {
  matchCount?: number;
  followerCount?: number;
  followingCount?: number;
  onPressFollowers: () => void;
  onPressFollowing: () => void;
}

export default function ProfileStatus({
  matchCount = 0,
  followerCount = 0,
  followingCount = 0,
  onPressFollowers,
  onPressFollowing,
}: ProfileStatusProps) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  return (
    <View className="flex-row justify-between mx-4 mb-1">
      <View className="">
        <View className="pb-1 px-6 items-center">
          <Text className="font-bold text-xl" style={{ color: colors.text }}> {matchCount} </Text>
          <Text className="font-bold" style={{ color: colors.primaryDark }}>{t('profile.matches')}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={onPressFollowers}>
        <View className="pb-1 px-6 items-center">
          <Text className="font-bold text-xl" style={{ color: colors.text }}>{followerCount}</Text>
          <Text className="font-bold" style={{ color: colors.primaryDark }}>{t('profile.followers')}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={onPressFollowing}>
        <View className="pb-1 px-6 items-center">
          <Text className="font-bold text-xl" style={{ color: colors.text }}>{followingCount}</Text>
          <Text className="font-bold" style={{ color: colors.primaryDark }}>{t('profile.following')}</Text>
        </View>
      </TouchableOpacity>

    </View>
  );
}
