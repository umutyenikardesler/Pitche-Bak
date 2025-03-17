import { Text, View } from "react-native";
import '@/global.css';

export default function Notifications() {
  return (
    <View className="flex-1 justify-center items-center bg-cyan-950">
      <Text className="color-white">Mesajlar</Text>
    </View>
  );
}