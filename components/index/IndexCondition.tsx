import { View, Text, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface IndexConditionProps {
    totalMatchCount: number;
}

export default function IndexCondition({ totalMatchCount }: IndexConditionProps) {

    const screenWidth = Dimensions.get("window").width;
    const fontSize = screenWidth > 430 ? 12 : screenWidth > 320 ? 11.5 : 10;

    // KONDİSYON HESAPLAMA FONKSİYONU
    const calculateCondition = (matchCount: number) => {
        if (matchCount < 3) return 0;
        if (matchCount === 3) return 60;
        if (matchCount === 4) return 80;
        if (matchCount === 5) return 90;
        if (matchCount > 5) return Math.min(90 + (matchCount - 5) * 2, 100);
        return 0;
    };

    const progress = calculateCondition(totalMatchCount);

    // KONDİSYON MESAJI
    let conditionMessage = "";
    let conditionMessageColor = "green";

    if (totalMatchCount < 3) {
        conditionMessage = "Kondisyon kazanman için en az 3 maç yapman lazım!";
        conditionMessageColor = "red";
    } else if (totalMatchCount === 3) {
        conditionMessage = "Eğer 1 maç daha yaparsan kondisyonun 80'e yükselecek";
    } else if (totalMatchCount === 4) {
        conditionMessage = "Eğer 1 maç daha yaparsan kondisyonun 90'a yükselecek";
    } else if (totalMatchCount === 5) {
        conditionMessage = "İlk 5 maçını tamamladın. Spor yapmaya devam ☺️";
    } else {
        conditionMessage = "Gerekli kondisyonu kazandın. Sağlıklı günler 👏";
    }

    return (
        <View>
            <View className="flex-row px-4 bg-green-700 p-2 items-center">
                <Ionicons name="accessibility" size={16} color="white" className="" />
                <Text className="font-bold text-white"> KONDİSYONUN </Text>
            </View>


            <View className="bg-white rounded-lg mx-4 my-2 p-3 shadow-md">
                <View className="w-full mb-1 flex-row items-center">
                    <View className="" style={{ flex: 1, height: 12, backgroundColor: '#e5e7eb', borderRadius: 9999, overflow: 'hidden' }}>
                        <View className="" style={{ height: '100%', backgroundColor: '#16a34a', width: `${progress}%` }} />
                    </View>
                    <Text className="pl-2 font-semibold text-base text-green-700">{progress}%</Text>
                </View>

                {conditionMessage && (
                    <View className=''>
                        <Text className={`text-xs font-semibold text-center`} style={{ color: conditionMessageColor, fontSize: fontSize }}>
                            {conditionMessage}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}