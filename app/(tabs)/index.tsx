import { Text, View, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
// import { RFValue } from "react-native-responsive-fontsize";
import { Dimensions } from "react-native";
import "@/global.css";

export default function Index() {

  const progress = 85;
  const screenWidth = Dimensions.get("window").width;
  const fontSize = screenWidth > 430 ? 12 : screenWidth > 320 ? 11.5 : 10; 

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} className="bg-slate-100 flex-1">

      <View className="flex-row mt-3 px-3">
        <Ionicons name="accessibility" size={16} color="black" className="pl-2" />
        <Text className="font-bold "> KONDİSYONUN </Text>
      </View>

      <View className="bg-white rounded-lg mx-4 my-3 p-3 shadow-md">
        {/* Progress Bar ve Yüzde */}
        <View className="w-full mb-3 flex-row items-center">
          {/* Progress Bar */}
          <View className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
            <View className="bg-blue-500 h-full" style={{ width: `${progress}%` }} />
          </View>
          {/* Yüzde */}
          <Text className="pl-2 font-semibold text-base text-blue-500">{progress}%</Text>
        </View>

        {/* İkon ve Metin */}
        <View className="flex-row items-center">
          <Ionicons name="information-circle-outline" size={16} color="black" />
          <Text className="text-xs text-slate-600 pl-2" style={{ fontSize }}>
            Kondisyonun yaptığın maç sayısına göre değişiklik gösterebilir.
          </Text>
        </View>
      </View>

      {/* SENİ BEKLEYEN MAÇLAR */}
      <View className="flex-row mt-3 px-3">
        <Ionicons name="alarm-outline" size={16} color="black" className="pl-2" />
        <Text className="font-bold "> SENİ BEKLEYEN MAÇLAR </Text>
      </View>

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
        <View className="flex-row flex-wrap max-w-full items-center justify-start ">

          <View className="flex-row items-center">
            <Text className="font-semibold">Eksikler:</Text>
          </View>

          {/* K Grubu */}
          <View className="flex-row items-center ml-2 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-red-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">K</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 1</Text>
          </View>
          {/* D Grubu */}
          <View className="flex-row items-center ml-2 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-blue-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">D</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 2</Text>
          </View>
          {/* O Grubu */}
          <View className="flex-row items-center ml-2 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-green-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">O</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 3</Text>
          </View>
          {/* F Grubu */}
          <View className="flex-row items-center ml-2 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-yellow-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">F</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 1</Text>
          </View>

        </View>
        
      </View>

      {/* KADROSU EKSİK MAÇLAR */}
      <View className="flex-row mt-3 px-3">
        <Ionicons name="megaphone-outline" size={16} color="black" className="pl-2" />
        <Text className="font-bold "> KADROSU EKSİK MAÇLAR  </Text>
      </View>
      
      {/* Maç1 */}
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
            <Text className="text-lg font-bold pb-1"> Hadi Maça Gidelim </Text>
            
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="location" size={16} color="black" />
              <Text className="pl-1 text-black text-base"> Kardeşler Halı Saha </Text>
            </View>
            
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="time-outline" size={16} color="black" />
              <Text className="pl-1 text-black text-base"> 18.00 - 19.00 </Text>
            </View>
            
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="calendar-outline" size={16} color="black"/>
              <Text className="pl-1 text-black text-base"> 15.04.2025 </Text>
            </View>
          </View>

          {/* 3. Sütun: İkonlar */}
          <View className="w-1/4 py-2 px-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-green-500">1.250 ₺</Text>
              <Ionicons name="chevron-forward-outline" size={16} color="green" />
            </View>
          </View>
        </View>
        {/* Çizgi */}
        <View className="h-[1px] bg-gray-600 my-3" />
        {/* Tek Satırlı Yazı */}
        <View className="flex-row justify-start flex-wrap max-w-full items-center">

          <View className="flex-row items-center">
            <Text className="font-semibold">Eksikler:</Text>
          </View>

          {/* K Grubu */}
          <View className="flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-red-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">K</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 1</Text>
          </View>
          {/* D Grubu
          <View className="flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-blue-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">D</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 2</Text>
          </View>
          {/* O Grubu 
          <View className="flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-green-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">O</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 3</Text>
          </View> */}
          
          <View className="flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-yellow-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">F</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 1</Text>
          </View>

        </View>
        
      </View>

       {/* Maç2 */}
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
            <Text className="text-lg font-bold pb-1"> Hadi Maça Gidelim </Text>
            
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="location" size={16} color="black" />
              <Text className="pl-1 text-black text-base"> Kardeşler Halı Saha </Text>
            </View>
            
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="time-outline" size={16} color="black" />
              <Text className="pl-1 text-black text-base"> 18.00 - 19.00 </Text>
            </View>
            
            <View className="text-black text-base flex-row items-center">
              <Ionicons name="calendar-outline" size={16} color="black"/>
              <Text className="pl-1 text-black text-base"> 15.04.2025 </Text>
            </View>
          </View>

          {/* 3. Sütun: İkonlar */}
          <View className="w-1/4 py-2 px-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-green-500">1.250 ₺</Text>
              <Ionicons name="chevron-forward-outline" size={16} color="green" />
            </View>
          </View>
        </View>
        {/* Çizgi */}
        <View className="h-[1px] bg-gray-600 my-3" />
        {/* Tek Satırlı Yazı */}
        <View className="flex-row justify-start flex-wrap max-w-full items-center">

          <View className="flex-row items-center">
            <Text className="font-semibold">Eksikler:</Text>
          </View>

          {/* K Grubu
          <View className="flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-red-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">K</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 1</Text>
          </View> */}
          {/* D Grubu */}
          <View className="flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-blue-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">D</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 2</Text>
          </View>
          {/* O Grubu */}
          <View className="flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-green-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">O</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 3</Text>
          </View>
          
          {/* <View className="flex-row items-center ml-1.5 border-solid border-2 border-gray-500 rounded-full p-1">
            <View className="bg-yellow-500 rounded-full p-1">
              <Text className="text-white font-bold text-md px-1">F</Text>
            </View>
            <Text className="ml-2 font-semibold pr-1">x 1</Text>
          </View> */}

        </View>
        
      </View>

    </ScrollView>
  );
}
