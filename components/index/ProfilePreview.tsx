// components/index/ProfilePreview.tsx
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { supabase } from '@/services/supabase';
import { useState, useEffect } from 'react';
import '@/global.css';

export default function ProfilePreview({ userId, onClose }) {
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);

    useEffect(() => {

        if (!userId || typeof userId !== "string") {
            console.warn("Geçersiz userId, sorgu çalıştırılmadı:", userId);
            return; // userId tanımlı değilse veya string değilse sorguyu durdur
        }
    

        const fetchData = async () => {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userId)
                    .single();

                if (error) throw error;

                setUserData(data);
            } catch (error) {
                console.error("Profil yüklenirken hata:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId]);

    const handleFollow = () => {
        setIsFollowing((prev) => !prev);
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-white p-4">
            {/* Kapatma Butonu */}
            <TouchableOpacity
                onPress={() => {
                    onClose(); // Önce modalı kapat
                    // setTimeout(() => setUserData(null), 300); // 300ms sonra userData temizlensin
                }}
                className="absolute top-14 right-4 z-10"
            >
                <Ionicons name="close" size={24} color="black" />
            </TouchableOpacity>

            {/* Profil Bilgileri */}
            <View className="flex flex-row p-2 mt-10">
                {/* Profil Resmi */}
                <View className="w-1/4 py-3 px-1">
                    <Image
                        source={userData?.profile_image
                            ? { uri: userData.profile_image }
                            : require("@/assets/images/ball.png")}
                        className="rounded-full mx-auto"
                        style={{ width: 90, height: 90, resizeMode: 'contain' }}
                    />
                </View>

                {/* Bilgiler */}
                <View className="w-3/4 px-4">
                    <Text className="font-semibold text-lg text-green-700 my-1">
                        {userData?.name || "İsim Yok"} {userData?.surname || ""}
                    </Text>

                    <View className="flex-row justify-between mb-1">
                        <Text className="text-wrap font-semibold">Yaş:</Text>
                        <Text className="text-green-600 font-semibold"> {userData?.age || "-"}  </Text>
                        <Text className="font-semibold">Boy:</Text>
                        <Text className="text-green-600 font-semibold"> {userData?.height || "-"} cm  </Text>
                        <Text className="font-semibold">Ağırlık:</Text>
                        <Text className="text-green-600 font-semibold"> {userData?.weight || "-"} kg</Text>
                    </View>

                    <Text className="text-wrap font-semibold mb-1">
                        {userData?.description || "Açıklama Yok"}
                    </Text>

                    {/* Takip Et / Takip İsteğini Geri Çek Butonu */}
                    <TouchableOpacity
                        onPress={handleFollow}
                        className={`px-4 py-2 rounded ${isFollowing ? "bg-orange-500" : "bg-green-700"}`}
                    >
                        <Text className="font-bold text-white">
                            {isFollowing ? "Takip isteğini gönderildi!" : "Takip Et"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}