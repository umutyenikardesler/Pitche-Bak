import { Text, TextInput, Pressable, View } from "react-native";
import { useLanguage } from "@/contexts/LanguageContext";

interface PitchesLocationProps {
  locationText: string;
  setLocationText: (text: string) => void;
  getLocation: () => void | Promise<void>;
}

export default function PitchesLocation({ locationText, setLocationText, getLocation }: PitchesLocationProps) {
  const { t } = useLanguage();
  return (
    <View className="p-4 bg-white">
      <Text className="text-lg font-bold mb-2 text-green-700 text-center">{t('pitches.listPitchesByLocation')}</Text>
      <View className="flex-row items-center space-x-2">
        <TextInput
          className="border flex-1 p-2 rounded-md border-gray-300 text-sm mr-2"
          placeholder={t('pitches.yourAddress')}
          value={locationText}
          onChangeText={setLocationText}
        />
        <Pressable className="bg-green-600 px-4 py-2 rounded-md" onPress={getLocation}>
          <Text className="text-white font-bold">{t('pitches.findYourLocation')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
