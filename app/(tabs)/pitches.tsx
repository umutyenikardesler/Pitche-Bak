import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import '@/global.css';

export default function Pitches() {
    return (
      <View className="bg-slate-100 flex-1">

        <View className="bg-white rounded-lg mx-4 mt-3 mb-3 p-3 shadow-md">
          <View className="flex-row items-center justify-between ">
            <Text className="text-base font-semibold">Kardeşler Halı Saha</Text>
            <Ionicons name="chevron-forward-outline" size={16} color="green" className="" />
          </View>
        </View>

        <View className="bg-white rounded-lg mx-4 mb-3 p-3 shadow-md">
          <View className="flex-row items-center justify-between ">
            <Text className="text-base font-semibold">Olea Halı Saha</Text>
            <Ionicons name="chevron-forward-outline" size={16} color="green" className="" />
          </View>
        </View>

        <View className="bg-white rounded-lg mx-4 mb-3 p-3 shadow-md">
          <View className="flex-row items-center justify-between ">
            <Text className="text-base font-semibold">Doğanlar Halı Saha</Text>
            <Ionicons name="chevron-forward-outline" size={16} color="green" className="" />
          </View>
        </View>

      </View>
    );
  }