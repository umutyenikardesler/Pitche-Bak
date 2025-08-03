import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import '@/global.css';
import { useFocusEffect } from 'expo-router';
import { useNotification } from '@/components/NotificationContext';

interface Notification {
    id: string;
    user_id: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: 'follow_request';
    sender_id: string;
    sender_name: string;
    sender_surname: string;
    sender_profile_image?: string; // Added for profile image
}

export default function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { refresh } = useNotification();

    useFocusEffect(
      useCallback(() => {
        fetchNotifications();
        refresh();
      }, [])
    );

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    *,
                    sender:users!notifications_sender_id_fkey(name, surname, profile_image)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Sadece okunmamış bildirimleri göster
            const formattedNotifications = data
                .filter(notification => !notification.is_read)
                .map(notification => ({
                    ...notification,
                    sender_name: notification.sender?.name || '',
                    sender_surname: notification.sender?.surname || '',
                    sender_profile_image: notification.sender?.profile_image || undefined // Ensure profile_image is included
                }));

            setNotifications(formattedNotifications);
        } catch (error) {
            console.error("Bildirimler yüklenirken hata:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleFollowRequest = async (notification: Notification, action: 'accept' | 'reject') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (action === 'accept') {
                // Takip isteğini kabul et
                const { error: updateError } = await supabase
                    .from('follow_requests')
                    .update({ status: 'accepted' })
                    .eq('follower_id', notification.sender_id)
                    .eq('following_id', user.id);

                if (updateError) throw updateError;

                // Bildirimi okundu olarak işaretle
                await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('id', notification.id);

                // Bildirim listesini güncelle
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
                refresh();
            } else {
                // Takip isteğini reddet
                const { error: deleteError } = await supabase
                    .from('follow_requests')
                    .delete()
                    .eq('follower_id', notification.sender_id)
                    .eq('following_id', user.id);

                if (deleteError) throw deleteError;

                // Bildirimi sil
                await supabase
                    .from('notifications')
                    .delete()
                    .eq('id', notification.id);

                // Bildirim listesini güncelle
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
                refresh();
            }
        } catch (error) {
            console.error("Takip isteği işlenirken hata:", error);
        }
    };

    const renderNotification = ({ item }: { item: Notification }) => {
        if (item.type === 'follow_request') {
            // Tarih ve saat formatlama
            const date = new Date(item.created_at);
            date.setHours(date.getHours() -3);
            const formatted = date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
            // Profil resmi için varsayılan görsel
            const profileImage = item.sender_profile_image || require('@/assets/images/ball.png');
            return (
                <View className="bg-white rounded-lg p-4 mx-4 mt-3 shadow-sm flex-row items-center">
                    {/* Profil Resmi */}
                    <View className="mr-3">
                        <Image
                            source={item.sender_profile_image ? { uri: item.sender_profile_image } : require('@/assets/images/ball.png')}
                            style={{ width: 72, height: 72, borderRadius: 36, resizeMode: 'cover' }}
                        />
                    </View>
                {/* Bildirim Metni ve Butonlar */}
                    <View className="flex-1 p-1">
                        <Text className="text-gray-700 mb-3">
                            <Text className="font-bold text-green-700">{item.sender_name} {item.sender_surname}</Text> sana takip isteği gönderdi.
                        </Text>
                        <View className="flex-row justify-between items-end mt-2">
                            <Text className="text-xs font-bold text-green-700 bg-gray-200 px-2 py-1 rounded">
                                {formatted}
                            </Text>
                            <View className="flex-row justify-end space-x-2">
                                <View className="flex-row mr-2">
                                    <TouchableOpacity
                                        onPress={() => handleFollowRequest(item, 'reject')}
                                        className="bg-red-500 font-bold px-2 py-2 rounded"
                                    >
                                        <Text className="text-white">Reddet</Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-row">
                                    <TouchableOpacity
                                        onPress={() => handleFollowRequest(item, 'accept')}
                                        className="bg-green-700 font-bold px-2 py-2 rounded"
                                    >
                                        <Text className="text-white">Kabul Et</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#16a34a" />
            </View>
        );
    }

    // FlatList'te refreshControl ekle
    return (
        <View className="flex-1 bg-gray-100">
            {/* <View className="flex-row p-2 bg-green-700"> 
                <Ionicons name="notifications-outline" size={16} color="white" className="pl-2" />
                <Text className="font-bold text-white"> BİLDİRİMLER </Text>
             </View> */}
            <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                    <View className="flex-1 justify-center items-center mt-4">
                        <Text className="text-gray-500">Henüz bildiriminiz yok</Text>
                    </View>
                }
                refreshing={refreshing}
                onRefresh={() => {
                    setRefreshing(true);
                    fetchNotifications();
                    refresh();
                }}
            />
        </View>
    );
}