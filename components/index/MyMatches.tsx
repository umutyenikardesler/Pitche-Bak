import { View, Text, FlatList, Image, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router"; // useRouter ekledik

export default function MyMatches({ matches, refreshing, onRefresh, renderMatch }) {

    const router = useRouter(); // Router'ı tanımladık

    const formatTitle = (text) => {
        if (!text) return "";
        const formattedText = text.charAt(0).toUpperCase() + text.slice(1); // İlk harfi büyük yap
        return formattedText.length > 23 ? formattedText.slice(0, 23) + "..." : formattedText;
    };

    // Sadece kullanıcının oluşturduğu maçları filtrele
    const myFutureMatches = matches.filter((match) => match.date >= new Date().toISOString().split("T")[0]);

    return (
        <View>
            < View className="flex-row py-3 bg-green-700 px-3" >
                <Ionicons name="alarm-outline" size={16} color="white" className="pl-2" />
                <Text className="font-bold text-white "> SENİ BEKLEYEN MAÇLAR </Text>
            </View >


            {myFutureMatches.length === 0 ? (
                <View className='flex justify-center items-center'>
                    <Text className="text-center font-bold my-4">Oluşturduğun Maç Yok!</Text>
                    <TouchableOpacity
                        className="text-center bg-green-600 text-white font-semibold rounded-md px-1 mb-2 items-center"
                        onPress={() => router.push("/create")} >
                        <Text className="w-1/2 text-white font-semibold text-center p-3">Hemen Maç Oluştur</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={myFutureMatches}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderMatch}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    
                    nestedScrollEnabled={true}
                />
            )}
        </View>
    );
}
