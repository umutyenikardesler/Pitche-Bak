import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import '@/global.css';
import { useFocusEffect, useRouter } from 'expo-router';
import { useNotification } from '@/components/NotificationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ProfilePreview from '@/components/index/ProfilePreview';

interface Notification {
    id: string;
    user_id: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: 'follow_request' | 'join_request';
    sender_id: string;
    sender_name: string;
    sender_surname: string;
    sender_profile_image?: string;
    match_id?: string;
    position?: string;
    match?: {
        id: string;
        title: string;
        date: string;
        time: string;
        formattedDate: string;
        startFormatted: string;
        endFormatted: string;
        pitches: {
            name: string;
            districts: {
                name: string;
            };
        };
    };
}

export default function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    const { refresh } = useNotification();
    const { t } = useLanguage();
    const router = useRouter();

    // Modal kapatma fonksiyonu
    const closeProfileModal = useCallback(() => {
        setViewingUserId(null);
        setProfileModalVisible(false);
    }, []);

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
                    sender:users!notifications_sender_id_fkey(name, surname, profile_image),
                    match:match!notifications_match_id_fkey(
                        id, title, date, time,
                        pitches(name, districts(name))
                    )
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Sadece okunmamış bildirimleri göster
            const formattedNotifications = data
                .filter(notification => !notification.is_read)
                .map(notification => {
                    // Maç bilgilerini formatla
                    let matchInfo = null;
                    if (notification.match) {
                        const matchDate = new Date(notification.match.date);
                        const formattedDate = matchDate.toLocaleDateString("tr-TR");
                        const [hours, minutes] = notification.match.time.split(":").map(Number);
                        const startFormatted = `${hours}:${minutes.toString().padStart(2, '0')}`;
                        const endFormatted = `${hours + 1}:${minutes.toString().padStart(2, '0')}`;
                        
                        matchInfo = {
                            ...notification.match,
                            formattedDate,
                            startFormatted,
                            endFormatted
                        };
                    }
                    
                    return {
                        ...notification,
                        sender_name: notification.sender?.name || '',
                        sender_surname: notification.sender?.surname || '',
                        sender_profile_image: notification.sender?.profile_image || undefined,
                        match: matchInfo
                    };
                });

            setNotifications(formattedNotifications);
        } catch (error) {
            console.error(t('notifications.loadingError'), error);
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
                // Kısa başarı uyarısı
                try { (global as any).toast?.show?.('İstek kabul edildi'); } catch (_) {}

                // MatchDetails ekranını anında tetikle (local event)
                try { 
                  const { DeviceEventEmitter } = require('react-native'); 
                  const eventName = `match-updated-${notification.match_id}`;
                  console.log(`[Notifications] Event emit ediliyor: ${eventName}`);
                  DeviceEventEmitter.emit(eventName);
                  console.log(`[Notifications] Event başarıyla emit edildi: ${eventName}`);
                } catch (error) {
                  console.error(`[Notifications] Event emit hatası:`, error);
                }
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
                // Kısa bilgilendirme
                try { (global as any).toast?.show?.('İstek reddedildi'); } catch (_) {}
            }
        } catch (error) {
            console.error(t('notifications.followRequestError'), error);
        }
    };

    // Pozisyon kodlarını tam isimlere çevir
    const getPositionName = (positionCode: string) => {
        switch (positionCode) {
            case 'K': return 'Kaleci';
            case 'D': return 'Defans';
            case 'O': return 'Orta Saha';
            case 'F': return 'Forvet';
            default: return positionCode;
        }
    };

    const handleJoinRequest = async (notification: Notification, action: 'accept' | 'reject') => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (action === 'accept') {
                if (!notification.match_id || !notification.position) {
                    console.warn('[Notifications] join_request kabulünde eksik veri:', notification.match_id, notification.position);
                }

                // Maç verilerini al
                const { data: matchData, error: matchError } = await supabase
                    .from('match')
                    .select('missing_groups')
                    .eq('id', notification.match_id)
                    .single();

                if (matchError) throw matchError;

                console.log('[Notifications] Mevcut missing_groups:', matchData?.missing_groups);

                // Eksik kadro sayılarını güncelle
                const updatedGroups: string[] = (matchData?.missing_groups || []).map((group: string) => {
                    const [position, count] = group.split(':');
                    if (position === notification.position) {
                        const newCount = Math.max(0, parseInt(count, 10) - 1);
                        return newCount > 0 ? `${position}:${newCount}` : '';
                    }
                    return group;
                }).filter((g: string) => !!g);

                console.log('[Notifications] Güncellenmiş missing_groups:', updatedGroups);

                // Maç verilerini güncelle
                const { error: updateMatchError } = await supabase
                    .from('match')
                    .update({ missing_groups: updatedGroups })
                    .eq('id', notification.match_id);

                if (updateMatchError) {
                    console.error('[Notifications] Match update hatası:', updateMatchError);
                    throw updateMatchError;
                }

                // Güncellemenin başarılı olduğunu doğrula
                const { data: verifyData, error: verifyError } = await supabase
                    .from('match')
                    .select('missing_groups')
                    .eq('id', notification.match_id)
                    .single();
                
                if (verifyError) {
                    console.error('[Notifications] Verify hatası:', verifyError);
                } else {
                    console.log('[Notifications] Güncelleme doğrulandı:', verifyData?.missing_groups);
                }

                // Bildirimi okundu olarak işaretle
                await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .eq('id', notification.id);

                // Bildirim listesini güncelle
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
                refresh();

                // MatchDetails ekranını anında tetikle (local event) - küçük gecikme ile
                setTimeout(() => {
                    try {
                        const { DeviceEventEmitter } = require('react-native');
                        const eventName = `match-updated-${notification.match_id}`;
                        console.log(`[Notifications] (join_request) Event emit ediliyor: ${eventName}`);
                        DeviceEventEmitter.emit(eventName, { 
                            acceptedPosition: notification.position,
                            acceptedBy: notification.sender_id 
                        });
                    } catch (error) {
                        console.error('[Notifications] (join_request) Event emit hatası:', error);
                    }
                }, 500); // 500ms gecikme
            } else {
                // Katılım isteğini reddet - bildirimi güncelle (silme)
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: `${getPositionName(notification.position || '')} pozisyonunda katılım isteği reddedildi`
                    })
                    .eq('id', notification.id);

                // Bildirim listesini güncelle
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
                refresh();
                
                // Kısa bilgilendirme
                try { (global as any).toast?.show?.('İstek reddedildi'); } catch (_) {}
            }
        } catch (error) {
            console.error('Katılım isteği işleme hatası:', error);
        }
    };

    const renderNotification = ({ item }: { item: Notification }) => {
        // Tarih ve saat formatlama - Database'deki saati olduğu gibi göster
        const created = new Date(item.created_at);
        const formatted = created.toLocaleString('tr-TR', { 
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC' // UTC olarak göster, otomatik çevirme yapma
        });
        
        if (item.type === 'follow_request') {
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
                            <Text className="font-bold text-green-700">{item.sender_name} {item.sender_surname}</Text> {t('notifications.sentFollowRequest')}
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
                                        <Text className="text-white">{t('general.reject')}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-row">
                                    <TouchableOpacity
                                        onPress={() => handleFollowRequest(item, 'accept')}
                                        className="bg-green-700 font-bold px-2 py-2 rounded"
                                    >
                                        <Text className="text-white">{t('general.accept')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            );
        } else if (item.type === 'join_request') {
            // Pozisyon kodlarını tam isimlere çevir
            const getPositionName = (positionCode: string) => {
                switch (positionCode) {
                    case 'K': return 'Kaleci';
                    case 'D': return 'Defans';
                    case 'O': return 'Orta Saha';
                    case 'F': return 'Forvet';
                    default: return positionCode;
                }
            };

            // Maç bilgilerini hazırla
            const matchInfo = item.match ? 
                `${item.match.formattedDate} ${item.match.startFormatted}-${item.match.endFormatted}, ${item.match.pitches?.districts?.name || 'Bilinmiyor'} → ${item.match.pitches?.name || 'Bilinmiyor'}` :
                'Bilinmiyor';

            return (
                <View className="bg-white rounded-lg p-4 mx-4 mt-3 shadow-sm flex-row items-center">
                    {/* Profil Resmi */}
                    <TouchableOpacity 
                        className="mr-3"
                        onPress={() => {
                            setViewingUserId(item.sender_id);
                            setProfileModalVisible(true);
                        }}
                    >
                        <Image
                            source={item.sender_profile_image ? { uri: item.sender_profile_image } : require('@/assets/images/ball.png')}
                            style={{ width: 72, height: 72, borderRadius: 36, resizeMode: 'cover' }}
                        />
                    </TouchableOpacity>
                    {/* Bildirim Metni ve Butonlar */}
                    <View className="flex-1 p-1 leading-snug">
                        <View className="leading-snug">
                            <Text className="text-gray-700 leading-6">
                                <Text
                                    className="font-bold text-green-700 leading-6"
                                    onPress={() => {
                                        setViewingUserId(item.sender_id);
                                        setProfileModalVisible(true);
                                    }}
                                >
                                    {item.sender_name} {item.sender_surname}
                                </Text>
                                <Text className="text-gray-700 leading-6"> kullanıcısı senin </Text>
                                <Text className="font-bold text-green-700 leading-6">{matchInfo}</Text>
                                <Text className="text-gray-700 leading-6"> maçın için </Text>
                                <Text className="font-bold text-orange-600 leading-6">{getPositionName(item.position || '')}</Text>
                                <Text className="text-gray-700 leading-6"> pozisyonunda katılmak istiyor?</Text>
                            </Text>
                        </View>
                        <View className="flex-row justify-between items-end mt-2">
                            <Text className="text-xs font-bold text-green-700 bg-gray-200 px-2 py-1 rounded">
                                {formatted}
                            </Text>
                            <View className="flex-row justify-end space-x-2">
                                <View className="flex-row mr-2">
                                    <TouchableOpacity
                                        onPress={() => handleJoinRequest(item, 'reject')}
                                        className="bg-red-500 font-bold px-2 py-2 rounded"
                                    >
                                        <Text className="text-white">{t('general.reject')}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-row">
                                    <TouchableOpacity
                                        onPress={() => handleJoinRequest(item, 'accept')}
                                        className="bg-green-700 font-bold px-2 py-2 rounded"
                                    >
                                        <Text className="text-white">{t('general.accept')}</Text>
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
           
            <FlatList
                data={notifications}
                renderItem={renderNotification}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                    <View className="flex-1 justify-center items-center mt-4">
                        <Text className="text-gray-500">{t('notifications.noNotificationsYet')}</Text>
                    </View>
                }
                refreshing={refreshing}
                onRefresh={() => {
                    setRefreshing(true);
                    fetchNotifications();
                    refresh();
                }}
            />
            
            {/* Profil Modal */}
            {profileModalVisible && (
                <Modal
                    visible={profileModalVisible}
                    animationType="fade"
                    onRequestClose={closeProfileModal}
                    transparent={true}
                >
                    <ProfilePreview
                        userId={viewingUserId || ''}
                        onClose={closeProfileModal}
                        isVisible={profileModalVisible}
                    />
                </Modal>
            )}
        </View>
    );
}