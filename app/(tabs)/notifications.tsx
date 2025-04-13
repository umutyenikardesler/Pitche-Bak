import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useState, useEffect } from "react";
import { supabase } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import '@/global.css';

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
}

export default function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    *,
                    sender:users!notifications_sender_id_fkey(name, surname)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedNotifications = data.map(notification => ({
                ...notification,
                sender_name: notification.sender?.name || '',
                sender_surname: notification.sender?.surname || ''
            }));

            setNotifications(formattedNotifications);
        } catch (error) {
            console.error("Bildirimler yüklenirken hata:", error);
        } finally {
            setLoading(false);
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
            }
        } catch (error) {
            console.error("Takip isteği işlenirken hata:", error);
        }
    };

    const renderNotification = ({ item }: { item: Notification }) => {
        if (item.type === 'follow_request') {
            return (
                <View className="bg-white rounded-lg p-4 m-2 shadow-sm">
                    <Text className="text-gray-700">
                        {item.sender_name} {item.sender_surname} sana takip isteği gönderdi
                    </Text>
                    <View className="flex-row justify-end space-x-2 mt-2">
                        <TouchableOpacity
                            onPress={() => handleFollowRequest(item, 'reject')}
                            className="bg-red-500 px-4 py-2 rounded"
                        >
                            <Text className="text-white">Reddet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleFollowRequest(item, 'accept')}
                            className="bg-green-700 px-4 py-2 rounded"
                        >
                            <Text className="text-white">Kabul Et</Text>
                        </TouchableOpacity>
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

    return (
        <View className="flex-1 bg-gray-100">
            <View className="flex-row p-2 bg-green-700">
                <Ionicons name="notifications-outline" size={16} color="white" className="pl-2" />
                <Text className="font-bold text-white"> BİLDİRİMLER </Text>
            </View>
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
            />
        </View>
    );
}