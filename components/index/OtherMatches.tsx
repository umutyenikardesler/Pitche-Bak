import { View, Text, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function OtherMatches({ otherMatches, refreshing, onRefresh, renderItem }) {
  
    const router = useRouter();

  return (
    <View>
      {/* KADROSU EKSİK MAÇLAR Başlığı */}
      <View className="flex-row px-3 py-3 bg-green-700 ">
        <Ionicons name="alarm-outline" size={16} color="white" className="pl-2" />
        <Text className="font-bold text-white "> KADROSU EKSİK MAÇLAR </Text>
      </View>
      {/* Kullanıcının oluşturmadığı maçlar */}
      {otherMatches.length === 0 ? (
        <View className='flex justify-center items-center'>
          <Text className="text-center font-bold my-4">Başkaları Tarafından Oluşturulan Kadrosu Eksik Maç Yok!</Text>
          <TouchableOpacity 
            className="text-center bg-green-600 text-white font-semibold rounded-md px-1 items-center" 
            onPress={() => router.push("/create")} 
          >
            <Text className="w-1/2 text-white font-semibold text-center p-4">Hemen Maç Oluştur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={otherMatches}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          style={{ paddingTop: 2, paddingBottom: 3 }}
          className="h-auto max-h-[74%]"
          nestedScrollEnabled={true}
        />
      )}
    </View>
  );
}