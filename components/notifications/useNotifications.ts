// Custom hook for notification data fetching and real-time updates
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useNotification } from '@/components/NotificationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Notification, NotificationGroup } from './notificationTypes';

export const useNotifications = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const { refresh, clearBadge } = useNotification();
    const { t } = useLanguage();

    const fetchNotifications = useCallback(async () => {
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
                // Mesaj bildirimlerini (direct_message) bildirim sayfasından çıkar
                .neq('type', 'direct_message')
                .order('created_at', { ascending: false })
                .limit(1000);

            if (error) throw error;

            const formattedNotifications = data
                .map(notification => {
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

            setNotifications(formattedNotifications);
        } catch (error) {
            console.error(t('notifications.loadingError'), error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [t]);

    useFocusEffect(
        useCallback(() => {
            // Bildirim sayfasına her girişte verileri çek
            fetchNotifications();
            // Kalp ikonundaki badge'i bu anda sıfırla
            clearBadge();
        }, [fetchNotifications]) // clearBadge bilinçli olarak dependency'e eklenmedi (loop'u önlemek için)
    );

    // Real-time subscription
    useEffect(() => {
        let mounted = true;
        let channel: any = null;

        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!mounted || !user) return;

            channel = supabase
                .channel(`notifications-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`
                    },
                    async (payload: any) => {
                        if (mounted) {
                            await fetchNotifications();
                            refresh();
                        }
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`
                    },
                    async (payload: any) => {
                        if (mounted) {
                            await fetchNotifications();
                            refresh();
                        }
                    }
                )
                .subscribe();

        })();

        return () => {
            mounted = false;
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [fetchNotifications, refresh]);

    const groupNotificationsByDate = useCallback((notifications: Notification[]): NotificationGroup[] => {
        // Şu anki tarihi al (Türkiye saati - UTC+3)
        const now = new Date();
        // Türkiye saati için bugünün tarihini hesapla
        // getTimezoneOffset() dakika cinsinden döner, negatif değer UTC'den ileri demektir
        // Türkiye UTC+3, bu yüzden offset -180 dakika (3 saat geri)
        const turkeyOffset = -180 * 60 * 1000; // -180 dakika = UTC+3
        const turkeyNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60 * 1000) - turkeyOffset);
        
        const today = new Date(turkeyNow.getFullYear(), turkeyNow.getMonth(), turkeyNow.getDate());
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
        
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
            // created_at değerini parse et (database'den gelen ISO string - UTC+3 olarak kaydedilmiş)
            const notificationDate = new Date(notification.created_at);
            // Türkiye saatine göre tarih string'ini oluştur
            const notificationWithOffset = new Date(notificationDate.getTime() - (notificationDate.getTimezoneOffset() * 60 * 1000) - turkeyOffset);
            const notificationDayStr = `${notificationWithOffset.getFullYear()}-${String(notificationWithOffset.getMonth() + 1).padStart(2, '0')}-${String(notificationWithOffset.getDate()).padStart(2, '0')}`;
            
            const notificationDay = new Date(notificationWithOffset.getFullYear(), notificationWithOffset.getMonth(), notificationWithOffset.getDate());

            // Bugün kontrolü - string karşılaştırması
            if (notificationDayStr === todayStr) {
                groups['Bugün'].push(notification);
            } 
            // Dün kontrolü - string karşılaştırması
            else if (notificationDayStr === yesterdayStr) {
                groups['Dün'].push(notification);
            } 
            // Son 7 Gün kontrolü - dünden önce ama bugünden 7 gün öncesine kadar
            else if (notificationDay.getTime() >= weekAgo.getTime() && notificationDay.getTime() < yesterday.getTime()) {
                groups['Son 7 Gün'].push(notification);
            }
            // Son 30 Gün kontrolü - 7 günden önce ama 30 gün içinde
            else if (notificationDay.getTime() >= monthAgo.getTime() && notificationDay.getTime() < weekAgo.getTime()) {
                groups['Son 30 Gün'].push(notification);
            } 
            // Daha eski
            else {
                groups['Daha Eski'].push(notification);
            }
        });

        return Object.entries(groups).filter(([_, notifications]) => notifications.length > 0);
    }, []);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchNotifications();
        refresh();
    }, [fetchNotifications, refresh]);

    return {
        notifications,
        setNotifications,
        loading,
        refreshing,
        fetchNotifications,
        groupNotificationsByDate,
        handleRefresh,
    };
};

