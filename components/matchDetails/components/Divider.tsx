import { View } from "react-native";

export default function Divider() {
  return (
    <View className="flex-row items-center justify-center px-1 mt-1 mb-4">
      <View className="flex-1 h-0.5 bg-green-500"></View>
      <View className="mx-4 flex-row items-center">
        <View className="w-2 h-2 bg-green-500 rounded-full mx-1"></View>
        <View className="w-1 h-1 bg-green-400 rounded-full mx-0.5"></View>
        <View className="w-2 h-2 bg-green-500 rounded-full mx-1"></View>
        <View className="w-1 h-1 bg-green-400 rounded-full mx-0.5"></View>
        <View className="w-2 h-2 bg-green-500 rounded-full mx-1"></View>
      </View>
      <View className="flex-1 h-0.5 bg-green-500"></View>
    </View>
  );
}

