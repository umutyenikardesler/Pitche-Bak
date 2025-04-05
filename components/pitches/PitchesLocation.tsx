import { Text, TextInput, Pressable, View } from "react-native";

export default function PitchesLocation({ locationText, setLocationText, getLocation }) {
  return (
    <View className="p-4 bg-white">
      <Text className="text-lg font-bold mb-2 text-green-700 text-center">Konumuna Göre Halı Sahaları Listele</Text>
      <View className="flex-row items-center space-x-2">
        <TextInput
          className="border flex-1 p-2 rounded-md border-gray-300 mr-2"
          placeholder="Adresin"
          value={locationText}
          onChangeText={setLocationText}
        />
        <Pressable className="bg-green-600 px-4 py-2 rounded-md" onPress={getLocation}>
          <Text className="text-white font-bold">Konumunu Bul</Text>
        </Pressable>
      </View>
    </View>
  );
}
