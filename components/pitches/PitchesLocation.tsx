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
    // Stiller tamamen satır içi: className ile dinamik style (colors.*) birlikte
    // verildiğinde NativeWind bir render'dan sonra stili kaybedebiliyor. Bu
    // bileşende bu, "Saha Öner" modalı açılıp kapandıktan sonra tüm bloğun
    // (başlık + adres kutusu + buton) sıfır yüksekliğe inip kaybolmasına yol
    // açıyordu — kayma değil, tam çökme. Bu oturumda özellik çiplerinde ve
    // sekmelerde de aynı arızayla karşılaşıldı.
    <View style={{ padding: 16, backgroundColor: colors.surface }} collapsable={false}>
      <Text
        style={{
          fontSize: 18,
          fontWeight: '700',
          marginBottom: 8,
          textAlign: 'center',
          color: colors.primaryDark,
        }}
      >
        {t('pitches.listPitchesByLocation')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          placeholder={t('pitches.yourAddress')}
          placeholderTextColor={colors.textMuted}
          value={locationText}
          onChangeText={setLocationText}
          style={{
            flex: 1,
            marginRight: 8,
            padding: 8,
            borderRadius: 6,
            fontSize: 13,
            borderWidth: 1,
            borderColor: colors.inputBorder,
            backgroundColor: colors.inputBackground,
            color: colors.text,
          }}
        />
        <Pressable
          onPress={() => getLocation(true)}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 6,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ fontWeight: '700', color: colors.whiteText }}>
            {t('pitches.findYourLocation')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default memo(PitchesLocationInner);
