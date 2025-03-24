import { View, Text } from "react-native";

export default function ProfileCondition({ matchCount = 0 }) {
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
  let conditionMessageColor = "green";

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
    conditionMessage = "İlk 5 maçını tamamladın. Spor yapmaya devam iyi gidiyorsun ☺️";
  } else {
    conditionMessage = "Gerekli kondisyonu kazandın. Sağlıklı günler dilerim 👏";
  }

  return (
    <View className="bg-white rounded-lg mx-4 my-3 p-3 shadow-md">
      <View className="w-full mb-3 flex-row items-center">
        <View className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
          <View className="bg-green-600 h-full" style={{ width: `${progress}%` }} />
        </View>
        <Text className="pl-2 font-semibold text-green-500">{progress}%</Text>
      </View>
      <Text className={`text-xs font-semibold text-center`} style={{ color: conditionMessageColor }}>
        {conditionMessage}
      </Text>
    </View>
  );
}
