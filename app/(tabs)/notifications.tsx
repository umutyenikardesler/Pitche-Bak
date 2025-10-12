import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Modal, ScrollView, RefreshControl } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
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
            'Son 30 Gün': []
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
            }
        });

        // Boş grupları kaldır
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
                .order('created_at', { ascending: false });

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

                // Bildirimi okundu olarak işaretle ve kabul mesajı ekle
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: 'Takip isteğiniz kabul edildi.'
                    })
                    .eq('id', notification.id);

                // Bildirim listesini güncelle - sadece is_read durumunu değiştir
                setNotifications(prev => prev.map(n => 
                    n.id === notification.id ? { ...n, is_read: true, message: 'Takip isteğiniz kabul edildi.' } : n
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
                        message: 'Takip isteğiniz reddedildi ✗'
                    })
                    .eq('id', notification.id);

                // Bildirim listesini güncelle - sadece is_read durumunu değiştir
                setNotifications(prev => prev.map(n => 
                    n.id === notification.id ? { ...n, is_read: true, message: 'Takip isteğiniz reddedildi ✗' } : n
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

                // Bildirimi okundu olarak işaretle ve kabul mesajı ekle
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: `${getPositionName(notification.position || '')} mevkisine kabul edildiniz`
                    })
                    .eq('id', notification.id);

                // Gönderen kullanıcıya kabul bildirimi oluştur
                try {
                  await supabase.from('notifications').insert({
                    user_id: notification.sender_id,
                    sender_id: user.id,
                    type: 'join_request',
                    message: `${getPositionName(notification.position || '')} mevkisine kabul edildiniz`,
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
                // Katılım isteğini reddet - bildirimi okundu olarak işaretle
                await supabase
                    .from('notifications')
                    .update({ 
                        is_read: true,
                        message: `${getPositionName(notification.position || '')} mevkisine kabul edilmediniz`
                    })
                    .eq('id', notification.id);

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
            console.log('Rendering follow_request notification:', item.id);
            return (
                <View className="bg-white rounded-lg mx-4 mt-3 shadow-sm">
                    {/* Üst satır - Profil Resmi ve Bildirim Metni */}
                    <View className="flex-row items-center p-4">
                        {/* Profil Resmi */}
                        <View className="mr-3">
                            <Image
                                source={item.sender_profile_image ? { uri: item.sender_profile_image } : require('@/assets/images/ball.png')}
                                style={{ width: 72, height: 72, borderRadius: 36, resizeMode: 'cover', opacity: item.is_read ? 0.6 : 1 }}
                            />
                        </View>
                        {/* Bildirim Metni */}
                        <View className="flex-1 p-1">
                            <Text
                                className={`mb-3 text-sm leading-5 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}
                                style={{ flexShrink: 1, flexWrap: 'wrap' }}
                                numberOfLines={2}
                                adjustsFontSizeToFit
                                minimumFontScale={0.88}
                            >
                                <Text className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}>{item.sender_name} {item.sender_surname}</Text> {t('notifications.sentFollowRequest')}
                            </Text>
                        </View>
                    </View>
                    
                    {/* Alt satır - Tarih/Saat ve Butonlar */}
                    <View className="px-3 pb-3">
                        <View className="flex-row justify-center items-center">
                            <View className="mr-2">
                                <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                                    {formatted}
                                </Text>
                            </View>
                            {!item.is_read && (
                                <View className="flex-row justify-center">
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
                            )}
                            {item.is_read && (
                                <View className="mr-2 flex-1" style={{ flexShrink: 1 }}>
                                    <View className="text-xs font-bold text-gray-500 bg-gray-300 px-1 py-1 rounded text-right flex-row flex-wrap items-center justify-center" style={{ flexShrink: 1 }}>
                                        <Text
                                            className="text-gray-500 text-sm leading-5"
                                            style={{ flexShrink: 1, flexWrap: 'wrap' }}
                                        >
                                            {item.message || 'İşlem Tamamlandı'}
                                        </Text>
                                        {item.message?.includes('kabul edildiniz') && (
                                            <View className="ml-0 w-4 h-4 bg-green-600 rounded-full items-center justify-center">
                                                <Text className="text-white text-xs font-bold">✓</Text>
                                            </View>
                                        )}
                                        {item.message?.includes('kabul edilmediniz') && (
                                            <View className="ml-1 w-4 h-4 bg-red-600 rounded-full items-center justify-center">
                                                <Text className="text-white text-xs font-bold">✗</Text>
                                            </View>
                                        )}
                                        {item.message?.includes('kabul edildi') && (
                                            <View className="ml-1 w-4 h-4 bg-green-600 rounded-full items-center justify-center">
                                                <Text className="text-white text-xs font-bold">✓</Text>
                                            </View>
                                        )}
                                        {item.message?.includes('reddedildi') && (
                                            <View className="ml-1 w-4 h-4 bg-red-600 rounded-full items-center justify-center">
                                                <Text className="text-white text-xs font-bold">✗</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            );
        } else if (item.type === 'join_request') {
            console.log('Rendering join_request notification:', item.id);
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
                <View className="bg-white rounded-lg mx-4 mt-3 shadow-sm">
                    {/* Üst satır - Profil Resmi ve Bildirim Metni */}
                    <View className="flex-row items-center p-4">
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
                                style={{ width: 72, height: 72, borderRadius: 36, resizeMode: 'cover', opacity: item.is_read ? 0.6 : 1 }}
                            />
                        </TouchableOpacity>
                        {/* Bildirim Metni */}
                        <View className="flex-1 p-1 leading-snug">
                            <View className="leading-snug">
                                <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                                    <Text
                                        className={`font-bold leading-6 ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                        onPress={() => {
                                            setViewingUserId(item.sender_id);
                                            setProfileModalVisible(true);
                                        }}
                                    >
                                        {item.sender_name} {item.sender_surname}
                                    </Text>
                                    <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> kullanıcısı senin </Text>
                                    <Text className={`font-bold leading-6 ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}>{matchInfo}</Text>
                                    <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> maçın için </Text>
                                    <Text className={`font-bold leading-6 ${item.is_read ? 'text-orange-500' : 'text-orange-600'}`}>{getPositionName(item.position || '')}</Text>
                                    <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> pozisyonuna katılmak istiyor?</Text>
                                </Text>
                            </View>
                        </View>
                    </View>
                    
                    {/* Alt satır - Tarih/Saat ve Butonlar */}
                    <View className="px-3 pb-3">
                        <View className="flex-row justify-between items-center">
                            <View className="mr-3">
                                <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                                    {formatted}
                                </Text>
                            </View>
                            {!item.is_read && (
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
                            )}
                            {item.is_read && (
                                <View className="mr-1 flex-1" style={{ flexShrink: 1 }}>
                                    <View className="text-xs font-bold text-gray-500 bg-gray-300 px-2 py-1 rounded text-right flex-row flex-wrap items-center justify-end" style={{ flexShrink: 1 }}>
                                        <Text
                                            className="text-gray-500 text-sm leading-5"
                                            style={{ flexShrink: 1, flexWrap: 'wrap' }}
                                        >
                                            {item.message || 'İşlem Tamamlandı'}
                                        </Text>
                                        {item.message?.includes('kabul edildiniz') && (
                                            <View className="ml-0 w-4 h-4 bg-green-600 rounded-full items-center justify-center">
                                                <Text className="text-white text-xs font-bold">✓</Text>
                                            </View>
                                        )}
                                        {item.message?.includes('kabul edilmediniz') && (
                                            <View className="ml-0 w-4 h-4 bg-red-600 rounded-full items-center justify-center">
                                                <Text className="text-white text-xs font-bold">✗</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            );
        } else if (item.type === 'direct_message') {
            // Direkt mesaj bildirimi kartı
            const senderFullName = `${item.sender_name || ''} ${item.sender_surname || ''}`.trim();
            return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    router.push({
                      pathname: '/message/chat',
                      params: { to: item.sender_id, matchId: item.match_id, name: senderFullName }
                    });
                  }}
                >
                  <View className="bg-white rounded-lg mx-4 mt-3 shadow-sm">
                    <View className="flex-row items-center p-4">
                      <View className="mr-3">
                        <Image
                          source={item.sender_profile_image ? { uri: item.sender_profile_image } : require('@/assets/images/ball.png')}
                          style={{ width: 56, height: 56, borderRadius: 28, resizeMode: 'cover' }}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-gray-800" numberOfLines={2}>
                          <Text className="font-bold text-green-700">{senderFullName}</Text> {t('notifications.sentMessage') || 'size mesaj gönderdi.'}
                        </Text>
                        {!!item.message && (
                          <Text className="text-gray-600 mt-1" numberOfLines={1}>“{item.message}”</Text>
                        )}
                      </View>
                    </View>
                    <View className="px-4 pb-3">
                      <View className="flex-row items-center">
                        <Text className="text-xs font-bold px-2 py-1 rounded text-green-700 bg-gray-200">{formatted}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
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