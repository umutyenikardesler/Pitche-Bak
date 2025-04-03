import { View, Text, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import '@/global.css';

export default function ProfileCondition({ matchCount = 0 }) {

  const screenWidth = Dimensions.get("window").width;
  const fontSize = screenWidth > 430 ? 12 : screenWidth > 320 ? 11.5 : 10;

  // Kondisyon seviyesini hesaplayan fonksiyon
  const calculateCondition = (matchCount) => {
    if (matchCount < 3) return 0;
    if (matchCount === 3) return 60;
    if (matchCount === 4) return 80;
    if (matchCount === 5) return 90;
    if (matchCount > 5) return Math.min(90 + (matchCount - 5) * 2, 100); // 6 maçta 92, 7 maçta 94, max 100
    return 0;
  };

  const progress = calculateCondition(matchCount);

  let conditionMessage = "";
  let conditionMessageColor = "#16a34a";

  if (matchCount === 0) {
    conditionMessage = "Yükleniyor...";
    conditionMessageColor = "gray";
  } else if (matchCount < 3) {
    conditionMessage = "Kondisyon kazanman için en az 3 maç yapman lazım!";
    conditionMessageColor = "red";
  } else if (matchCount === 3) {
    conditionMessage = "Eğer 1 maç daha yaparsan kondisyonun 80'e yükselecek";
  } else if (matchCount === 4) {
    conditionMessage = "Eğer 1 maç daha yaparsan kondisyonun 90'a yükselecek";
  } else if (matchCount === 5) {
    conditionMessage = "İlk 5 maçını tamamladın. Spor yapmaya devam ☺️";
  } else {
    conditionMessage = "Gerekli kondisyonu kazandın. Sağlıklı günler 👏";
  }

  return (
    <View>
      <View className="flex-row mt-2 px-3 justify-center items-center">
        <Ionicons name="accessibility" size={16} color="green" className="pl-2" />
        <Text className="font-bold text-green-700 text-center"> KONDİSYONUN </Text>
      </View>
      <View className="bg-white rounded-lg mx-4 my-3 p-3 shadow-md">
        <View className="w-full flex-row items-center mb-2">
          <View className="" style={{ flex: 1, height: 12, backgroundColor: '#e5e7eb', borderRadius: 9999, overflow: 'hidden' }}>
            <View className="" style={{ height: '100%', backgroundColor: '#16a34a', width: `${progress}%` }} />
          </View>
          <Text className="pl-2 font-semibold text-green-700">{progress}%</Text>
        </View>
        <Text className={`text-xs font-semibold text-center`} style={{ color: conditionMessageColor, fontSize: fontSize }}>
          {conditionMessage}
        </Text>
      </View>
    </View>
  );
}
