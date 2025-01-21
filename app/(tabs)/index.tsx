import { Text, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import "@/global.css";

export default function Index() {
  return (
    <View className="bg-slate-100 flex-1">
      <View className="bg-white rounded-lg mx-4 my-3 p-3 shadow-md">
        {/* Üç Sütun */}
        <View className="flex-row">
          {/* 1. Sütun: Resim */}
          <View className="w-1/4 justify-center py-2 px-1">
            <Image
              source={require('@/assets/images/ball.png')}
              className="rounded-full mx-auto"
              style={{
                width: 80, // Genişliği kesin olarak belirt
                height: 80, // Yüksekliği kesin olarak belirt
                resizeMode: 'contain', // Resmin sıkıştırılmadan alanı doldurması
              }}
            />
          </View>

          {/* 2. Sütun: Yazılar */}
          <View className="w-1/2 p-2">
            <Text className="text-lg font-bold pb-1"> Gidelim Joe </Text>
            
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="location" size={16} color="black" />
              <Text className="pl-1 text-black text-base"> Olea Halı Saha </Text>
            </View>
            
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="time-outline" size={16} color="black" />
              <Text className="pl-1 text-black text-base"> 23.00 - 24.00 </Text>
            </View>
            
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="calendar-outline" size={16} color="black"/>
              <Text className="pl-1 text-black text-base"> 25.05.2025 </Text>
            </View>
          </View>

          {/* 3. Sütun: İkonlar */}
          <View className="w-1/4 py-2 px-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-green-500">1.000 ₺</Text>
              <Ionicons name="chevron-forward-outline" size={16} color="green" />
            </View>
          </View>
        </View>

        {/* Çizgi */}
        <View className="h-[1px] bg-gray-600 my-3" />

        {/* Tek Satırlı Yazı */}
        <View className="flex-row items-center justify-between">

          <Text className="font-semibold">Eksikler:</Text>

          <View className="flex flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-red-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">K</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 1</Text>
          </View>

          <View className="flex flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-blue-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">D</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 2</Text>
          </View>

          <View className="flex flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-green-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">O</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 3</Text>
          </View>

          <View className="flex flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-yellow-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">F</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 1</Text>
          </View>
        </View>
        
      </View>
    </View>
  );
}
