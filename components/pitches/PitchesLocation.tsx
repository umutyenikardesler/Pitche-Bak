import { memo } from "react";
import { Text, TextInput, Pressable, View } from "react-native";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";

interface PitchesLocationProps {
  locationText: string;
  setLocationText: (text: string) => void;
  getLocation: (showAlertOnError?: boolean) => void | Promise<void>;
}

function PitchesLocationInner({ locationText, setLocationText, getLocation }: PitchesLocationProps) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  return (
    <View className="p-4" style={{ backgroundColor: colors.surface }} collapsable={false}>
      <Text className="text-lg font-bold mb-2 text-center" style={{ color: colors.primaryDark }}>{t('pitches.listPitchesByLocation')}</Text>
      <View className="flex-row items-center space-x-2">
        <TextInput
          className="flex-1 p-2 rounded-md text-sm mr-2"
          placeholder={t('pitches.yourAddress')}
          placeholderTextColor={colors.textMuted}
          value={locationText}
          onChangeText={setLocationText}
          style={{
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBackground,
            color: colors.text,
          }}
        />
        <Pressable className="px-4 py-2 rounded-md" style={{ backgroundColor: colors.primary }} onPress={() => getLocation(true)}>
          <Text className="font-bold" style={{ color: colors.whiteText }}>{t('pitches.findYourLocation')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(PitchesLocationInner);
