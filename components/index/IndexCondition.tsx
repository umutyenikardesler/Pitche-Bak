import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function IndexCondition({ totalMatchCount = 0 }) {

    // ✅ Kondisyon seviyesini hesaplayan fonksiyon
    const calculateCondition = (totalMatchCount) => {
        if (totalMatchCount < 3) return 0;
        if (totalMatchCount === 3) return 60;
        if (totalMatchCount === 4) return 80;
        if (totalMatchCount === 5) return 90;
        if (totalMatchCount > 5) return Math.min(90 + (totalMatchCount - 5) * 2, 100);
        return 0;
    };

    const progress = calculateCondition(totalMatchCount);

    // ✅ Kullanıcıya gösterilecek bilgilendirme mesajı
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
        conditionMessage = "İlk 5 maçını tamamladın. Spor yapmaya devam!";
    } else {
        conditionMessage = "Gerekli kondisyonu kazandın. Sağlıklı günler!";
    }

    return (
        <View className="flex">
            < View className="flex-row mt-3 px-3" >
                <Ionicons name="accessibility" size={16} color="green" className="pl-2" />
                <Text className="font-bold text-green-700"> KONDİSYONUN </Text>
            </View >

            <View className="bg-white rounded-lg mx-4 my-2 p-3 shadow-md">
                {/* Progress Bar ve Yüzde */}
                <View className="w-full mb-1 flex-row items-center">
                    {/* Progress Bar */}
                    <View className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <View className="bg-green-600 h-full" style={{ width: `${progress}%` }} />
                    </View>
                    {/* Yüzde */}
                    <Text className="pl-2 font-semibold text-base text-green-500">{progress}%</Text>
                </View>

                {/* İkon ve Metin */}
                <View className="flex-row items-center justify-start">
                    {/* <Ionicons name="information-circle-outline" size={16} color="black" /> */}
                    {/* Dinamik Uyarı Mesajı */}
                    {conditionMessage && (
                        <View className=''>
                            <Text className={`text-xs font-semibold text-center`} style={{ color: conditionMessageColor }}>
                                {conditionMessage}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}
