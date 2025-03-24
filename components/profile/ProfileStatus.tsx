import { View, Text } from "react-native";

export default function ProfileStatus({ matchCount = 0 }) { // Varsayılan değer olarak 0
  return (
    <View className="flex-row justify-between mx-4 mt-1">
      <View className="p-2">
        <View className="border-2 border-green-600 rounded-lg py-2 px-6 items-center">
          <Text className="font-bold text-xl">{matchCount}</Text>
          <Text className="font-bold text-green-700">Maç</Text>
        </View>
      </View>
      <View className="p-2">
        <View className="border-2 border-green-600 rounded-lg py-2 px-6 items-center">
          <Text className="font-bold text-xl">250</Text>
          <Text className="font-bold text-green-700">Takipçi</Text>
        </View>
      </View>
      <View className="p-2">
        <View className="border-2 border-green-600 rounded-lg py-2 px-6 items-center">
          <Text className="font-bold text-xl">120</Text>
          <Text className="font-bold text-green-700">Takip</Text>
        </View>
      </View>
    </View>
  );
}
