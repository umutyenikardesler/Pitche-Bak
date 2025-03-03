import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";

export default function EmailConfirmed() {
  const router = useRouter();

  return (
    <View className="flex-1 justify-center items-center bg-white px-6">
      <View className="bg-green-100 p-6 rounded-lg shadow-lg">
        <Text className="text-xl font-bold text-center text-green-700 mb-4">
          E-posta Adresiniz Onaylandı! ✅
        </Text>
        <Text className="text-center text-gray-700 mb-4">
          Artık giriş yapabilirsiniz.
        </Text>
        <Button title="Giriş Yap" onPress={() => router.replace("/auth")} />
      </View>
    </View>
  );
}
