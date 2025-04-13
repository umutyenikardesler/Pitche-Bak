// components/index/ProfilePreview.tsx
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { supabase } from '@/services/supabase';
import { useState, useEffect } from 'react';
import '@/global.css';
import ProfileStatus from '@/components/profile/ProfileStatus';
import ProfileCondition from '@/components/profile/ProfileCondition';
import ProfileMatches from '@/components/profile/ProfileMatches';

interface UserData {
    id: string;
    name: string;
    surname: string;
    email: string;
    profile_image: string;
    age: number;
    height: number;
    weight: number;
    description: string;
    match_count: number;
}

interface ProfilePreviewProps {
    isVisible: boolean;
    onClose: () => void;
    userId: string;
}

export default function ProfilePreview({ isVisible, onClose, userId }: ProfilePreviewProps) {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);
    const [followStatus, setFollowStatus] = useState<'pending' | 'accepted' | null>(null);

    useEffect(() => {
        let isMounted = true;

        if (!userId) {
            if (isMounted) {
                setUserData(null);
                setLoading(true);
            }
            return;
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

                // Takip durumunu kontrol et
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: followData } = await supabase
                        .from('follow_requests')
                        .select('*')
                        .eq('follower_id', user.id)
                        .eq('following_id', userId)
                        .single();

                    if (isMounted) {
                        setIsFollowing(!!followData);
                        setFollowStatus(followData?.status || null);
                    }
                }

                if (isMounted) {
                    setUserData(data);
                    setLoading(false);
                }
            } catch (error) {
                console.error("Profil yüklenirken hata:", error);
                if (isMounted) {
                    setUserData(null);
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [userId]);

    const handleClose = () => {
        // Önce state'leri sıfırla
        setUserData(null);
        setLoading(true);
        setIsFollowing(false);
        setFollowStatus(null);
        // Sonra modal'ı kapat
        onClose();
    };

    const handleFollow = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert("Hata", "Kullanıcı oturumu bulunamadı");
                return;
            }

            // Takip isteği oluştur
            const { error: insertError } = await supabase
                .from('follow_requests')
                .insert([
                    {
                        follower_id: user.id,
                        following_id: userId,
                        status: 'pending'
                    }
                ]);

            if (insertError) {
                throw insertError;
            }

            // Bildirim oluştur
            const { error: notificationError } = await supabase
                .from('notifications')
                .insert([
                    {
                        user_id: userId,
                        sender_id: user.id,
                        type: 'follow_request',
                        message: `${userData?.name} ${userData?.surname} sizi takip etmek istiyor`,
                        is_read: false
                    }
                ]);

            if (notificationError) {
                console.error("Bildirim oluşturma hatası:", notificationError);
            }

            setIsFollowing(true);
            setFollowStatus('pending');
            Alert.alert("Başarılı", "Takip isteği gönderildi");
        } catch (error) {
            console.error("Takip isteği gönderilirken hata:", error);
            Alert.alert("Hata", "Takip isteği gönderilirken bir hata oluştu. Lütfen tekrar deneyin.");
        }
    };

    return (
        <Modal
            visible={isVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}
        >
            <View className="flex-1 bg-gray-100">
                <View className="flex-1 bg-white mt-12 rounded-t-2xl overflow-hidden">
                    <View className="flex-row justify-end items-center p-4 border-b border-gray-200">
                        <TouchableOpacity 
                            onPress={handleClose}
                            className="bg-green-700 px-4 py-2 rounded-full"
                        >
                            <Ionicons name="close" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView className="flex-1">
                        <View className="p-4">
                            <View className="flex flex-row bg-white rounded-lg shadow-lg p-4 mb-4">
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
                                    {followStatus === 'accepted' ? (
                                        <View className="flex-row space-x-2">
                                            <TouchableOpacity
                                                className="bg-green-700 px-4 py-2 rounded"
                                            >
                                                <Text className="font-bold text-white">
                                                    Takip Ediliyor
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={handleFollow}
                                            className={`px-4 py-2 rounded ${isFollowing ? "bg-gray-400" : "bg-green-700"}`}
                                            disabled={isFollowing}
                                        >
                                            <Text className="font-bold text-white">
                                                {isFollowing ? "Takip isteğin gönderildi" : "Takip Et"}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            {followStatus === 'accepted' && (
                                <View className="bg-white rounded-lg shadow-lg p-4">
                                    {/* ProfileStatus bileşeni */}
                                    <ProfileStatus matchCount={userData?.match_count || 0} />

                                    {/* ProfileCondition bileşeni */}
                                    <ProfileCondition matchCount={userData?.match_count || 0} />

                                    {/* ProfileMatches bileşeni */}
                                    <ProfileMatches userData={userData} />
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}