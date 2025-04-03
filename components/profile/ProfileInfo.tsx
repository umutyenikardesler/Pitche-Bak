import { useState, useEffect } from "react";
import { Text, View, Image, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import '@/global.css';

export default function ProfileInfo({ userData, setModalVisible, setEditModalVisible, pickImage }) {

    const [profileImage, setProfileImage] = useState({ uri: userData?.profile_image || null });

    useEffect(() => {
        if (userData?.profile_image) {
            setProfileImage({ uri: userData.profile_image });
        }
    }, [userData]);

    //console.log("ProfileInfo userData:", userData); // Log eklendi

    return (
        <View className="flex flex-row p-2 ">  {/* En dış çerçeveye p-2 padding eklendi */}
            <View className="w-1/4 py-3 px-1 relative">
                <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Image
                        source={userData?.profile_image ? { uri: userData.profile_image } : require("@/assets/images/ball.png")}
                        className="rounded-full mx-auto"
                        style={{ width: 90, height: 90, resizeMode: 'contain' }}
                    />
                </TouchableOpacity>
                <TouchableOpacity onPress={pickImage} className="absolute right-0 bottom-0" style={{marginBottom: 5}}>
                    <View className="bg-white rounded-full p-1 shadow-lg">
                        <Ionicons name="add-circle" size={24} color="green" />
                    </View>
                </TouchableOpacity>
            </View>

            <View className="w-3/4 px-4">  {/* Diğer bilgilerin olduğu kısım %75 */}
                <View className="w-full">
                    <Text className="font-semibold text-lg text-green-700 my-1">
                        {userData?.name || "İsim Yok"} {userData?.surname || ""}
                    </Text>
                </View>

                <View className="flex-row justify-between mb-1">
                    <Text className="text-wrap font-semibold">Yaş:</Text>
                    <Text className="text-green-600 font-semibold"> {userData?.age || "-"}  </Text>
                    <Text className="font-semibold">Boy:</Text>
                    <Text className="text-green-600 font-semibold"> {userData?.height || "-"} cm  </Text>
                    <Text className="font-semibold">Ağırlık:</Text>
                    <Text className="text-green-600 font-semibold"> {userData?.weight || "-"} kg</Text>
                </View>

                <View>
                    <Text className="text-wrap font-semibold mb-1">{userData?.description || "Açıklama Yok"}</Text>
                </View>

                {/* Butonlar */}
                <View className="flex-row mt-1">
                    <View className="w-1/2">
                        <TouchableOpacity className="bg-green-600 text-white font-semibold rounded-md p-2 items-center mr-1"
                            onPress={() => setEditModalVisible(true)}
                        >
                            <Text className="text-white font-semibold">Düzenle</Text>
                        </TouchableOpacity>
                    </View>
                    <View className="w-1/2">
                        <TouchableOpacity className="bg-green-600 text-white font-semibold rounded-md p-2 items-center">
                            <Text className='text-white font-semibold'>Takip Et</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );
}
