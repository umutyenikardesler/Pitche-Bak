import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal, ScrollView, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from 'expo-router';
import { useNotification } from '@/components/NotificationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import ProfilePreview from '@/components/index/ProfilePreview';
import FollowRequestNotification from '@/components/notifications/FollowRequestNotification';
import JoinRequestNotification from '@/components/notifications/JoinRequestNotification';
import DirectMessageNotification from '@/components/notifications/DirectMessageNotification';

interface Notification {
    id: string;
    user_id: string;
    message: string;
    is_read: boolean;
    created_at: string;
    type: 'follow_request' | 'join_request' | 'direct_message';
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

    // Tarih gruplama fonksiyonu
    const groupNotificationsByDate = (notifications: Notification[]) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);

        const groups: { [key: string]: Notification[] } = {
            'Bugün': [],
            'Dün': [],
            'Son 7 Gün': [],
            'Son 30 Gün': [],
            'Daha Eski': []
        };

        notifications.forEach(notification => {
            const notificationDate = new Date(notification.created_at);
            const notificationDay = new Date(notificationDate.getFullYear(), notificationDate.getMonth(), notificationDate.getDate());

            if (notificationDay.getTime() === today.getTime()) {
                groups['Bugün'].push(notification);
            } else if (notificationDay.getTime() === yesterday.getTime()) {
                groups['Dün'].push(notification);
            } else if (notificationDate >= weekAgo) {
                groups['Son 7 Gün'].push(notification);
            } else if (notificationDate >= monthAgo) {
                groups['Son 30 Gün'].push(notification);
            } else {
                groups['Daha Eski'].push(notification);
            }
        });

        // Boş grupları kaldır ve sıralı döndür
        return Object.entries(groups).filter(([_, notifications]) => notifications.length > 0);
    };

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
                .order('created_at', { ascending: false })
                .limit(1000); // Tüm bildirimleri almak için limit artır

            if (error) throw error;

            // Tüm bildirimleri göster (hem okunmuş hem okunmamış)
            const formattedNotifications = data
                .map(notification => {
                    // Maç bilgilerini formatla (sadece join_request için)
                    let matchInfo = null;
                    if (notification.type === 'join_request' && notification.match) {
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

            console.log('Tüm bildirimler:', formattedNotifications);
            console.log('Takip isteği bildirimleri:', formattedNotifications.filter(n => n.type === 'follow_request'));
            console.log('Katılım isteği bildirimleri:', formattedNotifications.filter(n => n.type === 'join_request'));
            console.log('Mesaj bildirimleri:', formattedNotifications.filter(n => n.type === 'direct_message'));
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

            console.log('[Notifications] handleFollowRequest:', {
                action,
                notification_id: notification.id,
                sender_id: notification.sender_id,
                current_user_id: user.id,
                message: notification.message
            });

            if (action === 'accept') {
                // Takip isteğini kabul et
                const { error: updateError } = await supabase
                    .from('follow_requests')
                    .update({ status: 'accepted' })
                    .eq('follower_id', notification.sender_id)
                    .eq('following_id', user.id);

                if (updateError) throw updateError;

                // Bildirimi okundu olarak işaretle ve kabul mesajı ekle
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: `${notification.sender_name} ${notification.sender_surname} seni takip etmeye başladı.`
                    })
                    .eq('id', notification.id);

                // Gönderen kullanıcıya kabul bildirimi oluştur
                try {
                    // Mevcut kullanıcının adını al (kabul eden kişi - Duygu)
                    const { data: currentUserData } = await supabase
                        .from('users')
                        .select('name, surname')
                        .eq('id', user.id)
                        .single();
                    
                    const senderName = currentUserData ? `${currentUserData.name} ${currentUserData.surname}` : 'Kullanıcı';
                    
                    console.log('[Notifications] Gönderen kullanıcıya bildirim:', {
                        user_id: notification.sender_id, // Umut (bildirimi alacak)
                        sender_id: user.id, // Duygu (bildirimi gönderen)
                        message: `${senderName} takip isteğinizi kabul etti.`
                    });
                    
                    await supabase.from('notifications').insert({
                        user_id: notification.sender_id, // Umut'a gönder
                        sender_id: user.id, // Duygu'dan geliyor
                        type: 'follow_request',
                        message: `${senderName} takip isteğinizi kabul etti.`,
                        is_read: false,
                    });
                } catch (e) {
                    console.error('[Notifications] Sender accept notification insert error:', e);
                }

                // Bildirim listesini güncelle - sadece is_read durumunu değiştir
                setNotifications(prev => prev.map(n => 
                    n.id === notification.id ? { ...n, is_read: true, message: `${notification.sender_name} ${notification.sender_surname} seni takip etmeye başladı.` } : n
                ));
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

                // Bildirimi okundu olarak işaretle ve red mesajı ekle
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: 'Takip isteği reddedildi.'
                    })
                    .eq('id', notification.id);

                // Gönderen kullanıcıya red bildirimi oluştur
                try {
                    // Mevcut kullanıcının adını al (reddeden kişi - Duygu)
                    const { data: currentUserData } = await supabase
                        .from('users')
                        .select('name, surname')
                        .eq('id', user.id)
                        .single();
                    
                    const senderName = currentUserData ? `${currentUserData.name} ${currentUserData.surname}` : 'Kullanıcı';
                    
                    console.log('[Notifications] Gönderen kullanıcıya red bildirimi:', {
                        user_id: notification.sender_id, // Umut (bildirimi alacak)
                        sender_id: user.id, // Duygu (bildirimi gönderen)
                        message: `${senderName} takip isteğinizi reddetti.`
                    });
                    
                    await supabase.from('notifications').insert({
                        user_id: notification.sender_id, // Umut'a gönder
                        sender_id: user.id, // Duygu'dan geliyor
                        type: 'follow_request',
                        message: `${senderName} takip isteğinizi reddetti.`,
                        is_read: false,
                    });
                } catch (e) {
                    console.error('[Notifications] Sender reject notification insert error:', e);
                }

                // Bildirim listesini güncelle - sadece is_read durumunu değiştir
                setNotifications(prev => prev.map(n => 
                    n.id === notification.id ? { ...n, is_read: true, message: 'Takip isteği reddedildi.' } : n
                ));
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

    const handleMarkAsRead = async (notification: Notification) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Bildirimi okundu olarak işaretle
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notification.id);

            if (error) throw error;

            // Local state'i güncelle
            setNotifications(prev => prev.map(n => 
                n.id === notification.id ? { ...n, is_read: true } : n
            ));
            
            // Bildirim sayısını güncelle
            refresh();
        } catch (error) {
            console.error('Bildirimi okundu olarak işaretleme hatası:', error);
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

                // Bildirimi okundu olarak işaretle (maç sahibine eski format)
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: `${getPositionName(notification.position || '')} mevkisine kabul edildiniz`
                    })
                    .eq('id', notification.id);

                // Gönderen kullanıcıya kabul bildirimi oluştur
                try {
                    // Maç sahibinin adını al (kabul eden kişi)
                    const { data: matchOwnerData } = await supabase
                        .from('users')
                        .select('name, surname')
                        .eq('id', user.id)
                        .single();
                    
                    const ownerName = matchOwnerData ? `${matchOwnerData.name} ${matchOwnerData.surname}` : 'Kullanıcı';
                    
                    // Maç bilgilerini mevcut bildirimden al (aynı yapıyı kullan)
                    let matchInfo = 'bilinmeyen maç';
                    if (notification.match) {
                        const matchDate = new Date(notification.match.date);
                        const formattedDate = matchDate.toLocaleDateString("tr-TR");
                        const [hours, minutes] = notification.match.time.split(":").map(Number);
                        const startFormatted = `${hours}:${minutes.toString().padStart(2, '0')}`;
                        const endFormatted = `${hours + 1}:${minutes.toString().padStart(2, '0')}`;
                        
                        const districtName = notification.match.pitches?.districts?.name || 'Bilinmiyor';
                        const pitchName = notification.match.pitches?.name || 'Bilinmiyor';
                        
                        matchInfo = `${formattedDate} ${startFormatted}-${endFormatted} ${districtName} → ${pitchName}`;
                    }
                    
                    const detailedMessage = `${ownerName} kullanıcısının oluşturduğu ${matchInfo} maçı için ${getPositionName(notification.position || '')} mevkisine kabul edildiniz.`;
                    
                    await supabase.from('notifications').insert({
                        user_id: notification.sender_id,
                        sender_id: user.id,
                        type: 'join_request',
                        message: detailedMessage,
                        match_id: notification.match_id,
                        position: notification.position,
                        is_read: false,
                    });
                } catch (e) {
                  console.error('[Notifications] Sender accept notification insert error:', e);
                }

                // Bildirim listesini güncelle - sadece is_read durumunu değiştir
                setNotifications(prev => prev.map(n => 
                    n.id === notification.id ? { ...n, is_read: true, message: `${getPositionName(notification.position || '')} mevkisine kabul edildiniz` } : n
                ));
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
                // Katılım isteğini reddet - bildirimi okundu olarak işaretle (maç sahibine eski format)
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: `${getPositionName(notification.position || '')} mevkisine kabul edilmediniz`
                    })
                    .eq('id', notification.id);

                // Gönderen kullanıcıya red bildirimi oluştur
                try {
                    // Maç sahibinin adını al (reddeden kişi)
                    const { data: matchOwnerData } = await supabase
                        .from('users')
                        .select('name, surname')
                        .eq('id', user.id)
                        .single();
                    
                    const ownerName = matchOwnerData ? `${matchOwnerData.name} ${matchOwnerData.surname}` : 'Kullanıcı';
                    
                    // Maç bilgilerini mevcut bildirimden al (aynı yapıyı kullan)
                    let matchInfo = 'bilinmeyen maç';
                    if (notification.match) {
                        const matchDate = new Date(notification.match.date);
                        const formattedDate = matchDate.toLocaleDateString("tr-TR");
                        const [hours, minutes] = notification.match.time.split(":").map(Number);
                        const startFormatted = `${hours}:${minutes.toString().padStart(2, '0')}`;
                        const endFormatted = `${hours + 1}:${minutes.toString().padStart(2, '0')}`;
                        
                        const districtName = notification.match.pitches?.districts?.name || 'Bilinmiyor';
                        const pitchName = notification.match.pitches?.name || 'Bilinmiyor';
                        
                        matchInfo = `${formattedDate} ${startFormatted}-${endFormatted} ${districtName} → ${pitchName}`;
                    }
                    
                    const detailedMessage = `${ownerName} kullanıcısının oluşturduğu ${matchInfo} maçı için ${getPositionName(notification.position || '')} mevkisine kabul edilmediniz.`;
                    
                    await supabase.from('notifications').insert({
                        user_id: notification.sender_id,
                        sender_id: user.id,
                        type: 'join_request',
                        message: detailedMessage,
                        match_id: notification.match_id,
                        position: notification.position,
                        is_read: false,
                    });
                } catch (e) {
                  console.error('[Notifications] Sender reject notification insert error:', e);
                }

                // Bildirim listesini güncelle - sadece is_read durumunu değiştir
                setNotifications(prev => prev.map(n => 
                    n.id === notification.id ? { ...n, is_read: true, message: `${getPositionName(notification.position || '')} mevkisine kabul edilmediniz` } : n
                ));
                refresh();
                
                // Kısa bilgilendirme
                try { (global as any).toast?.show?.('İstek reddedildi'); } catch (_) {}
            }
        } catch (error) {
            console.error('Katılım isteği işleme hatası:', error);
        }
    };

    const renderNotification = ({ item }: { item: Notification }) => {
        console.log('Rendering notification:', item.type, item.id, item.sender_name);
        
        if (item.type === 'follow_request') {
            return (
                <FollowRequestNotification
                    item={item}
                    onAccept={(item) => handleFollowRequest(item, 'accept')}
                    onReject={(item) => handleFollowRequest(item, 'reject')}
                    onProfilePress={(userId) => {
                        setViewingUserId(userId);
                        setProfileModalVisible(true);
                    }}
                    onMarkAsRead={handleMarkAsRead}
                />
            );
        } else if (item.type === 'join_request') {
            return (
                <JoinRequestNotification
                    item={item}
                    onAccept={(item) => handleJoinRequest(item, 'accept')}
                    onReject={(item) => handleJoinRequest(item, 'reject')}
                    onProfilePress={(userId) => {
                        setViewingUserId(userId);
                        setProfileModalVisible(true);
                    }}
                    onMarkAsRead={handleMarkAsRead}
                />
            );
        } else if (item.type === 'direct_message') {
            return (
                <DirectMessageNotification item={item} />
            );
        }
        
        console.log('Unknown notification type, returning null:', item.type, item.id);
        return null;
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color="#16a34a" />
            </View>
        );
    }

    // Gruplu bildirimleri render et
    const renderGroupedNotifications = () => {
        const groupedNotifications = groupNotificationsByDate(notifications);
        console.log('Grouped notifications:', groupedNotifications);
        
        if (groupedNotifications.length === 0) {
            return (
                <View className="flex-1 justify-center items-center mt-4">
                    <Text className="text-gray-500">{t('notifications.noNotificationsYet')}</Text>
                </View>
            );
        }

        return (
            <>
                {groupedNotifications.map(([groupName, groupNotifications]) => (
                    <View key={groupName} className="mb-4">
                        {/* Grup başlığı */}
                        <View className="px-4 py-2 bg-green-600">
                            <Text className="text-sm font-bold text-white">{groupName}</Text>
                        </View>
                        
                        {/* Grup bildirimleri */}
                        {groupNotifications.map((notification) => (
                            <View key={notification.id}>
                                {renderNotification({ item: notification })}
                            </View>
                        ))}
                    </View>
                ))}
            </>
        );
    };

    // FlatList'te refreshControl ekle
    return (
        <View className="flex-1 bg-gray-100">
            <ScrollView 
                className="flex-1" 
                contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            fetchNotifications();
                            refresh();
                        }}
                    />
                }
            >
                {renderGroupedNotifications()}
            </ScrollView>
            
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