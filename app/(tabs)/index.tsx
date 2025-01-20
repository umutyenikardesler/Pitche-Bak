import { Text, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import "@/global.css";

export default function Index() {
  return (
    <View className="bg-slate-100 flex-1">
      <View className="bg-white rounded-md mx-4 my-3 p-3 shadow-md">
        {/* Üç Sütun */}
        <View className="flex-row">
          {/* 1. Sütun: Resim */}
          <View className="w-1/4 py-2 px-1">
            <Image
              source={require('@/assets/images/ball.png')}
              className="mx-auto rounded-full"
              style={{
                width: '100%',       // Genişliği %100 yaparak, dış container'a sığmasını sağlarız
                height: '100%',   // Yükseklik oranı otomatik olacak
                maxWidth: 100,       // Resmi %20'lik alana sığdırmak için maxWidth sınırlaması ekledik
                resizeMode: 'contain',  // Resmi sıkıştırmadan alanı dolduracak şekilde ölçeklendir
              }}
            />
          </View>

          {/* 2. Sütun: Yazılar */}
          <View className="w-1/2 p-2">
            <Text className="font-bold pb-1"> Gidelim Joe </Text>
            
            <Text className="text-black text-sm flex items-end pb-1">
              <Ionicons name="location" size={16} color="black" />
              <Text className="pl-1"> Olea Halı Saha </Text>
            </Text>
            
            <Text className="text-black text-sm flex items-end pb-1">
              <Ionicons name="time-outline" size={16} color="black" />
              <Text className="pl-1"> 23.00 - 24.00 </Text>
            </Text>
            
            <Text className="text-black text-sm flex items-end">
              <Ionicons name="calendar-outline" size={16} color="black"/>
              <Text className="pl-1"> 25.05.2025 </Text>
            </Text>
          </View>

          {/* 3. Sütun: İkonlar */}
          <View className="w-1/4 py-2 px-1">
            <Text className="text-black text-sm flex justify-between font-semibold text-green-500"> 1.000 ₺ 
              <Ionicons name="chevron-forward-outline" size={16} color="black" className="" />
            </Text>
          </View>
        </View>

        {/* Çizgi */}
        <View className="h-[1px] bg-gray-600 my-3" />

        {/* Tek Satırlı Yazı */}
        <View className="flex-row items-center">
          <Text className="font-semibold">Eksikler:</Text>
          <View className="flex flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded p-1">
            <View className="bg-red-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">K</Text>
            </View>
            <Text className="ml-2 font-semibold">x 1</Text>
          </View>

          <View className="flex flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded p-1">
            <View className="bg-blue-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">D</Text>
            </View>
            <Text className="ml-2 font-semibold">x 1</Text>
          </View>

          <View className="flex flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded p-1">
            <View className="bg-green-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">O</Text>
            </View>
            <Text className="ml-2 font-semibold">x 1</Text>
          </View>

          <View className="flex flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded p-1">
            <View className="bg-yellow-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">F</Text>
            </View>
            <Text className="ml-2 font-semibold">x 1</Text>
          </View>
        </View>
        
      </View>
    </View>
  );
}
