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
    const { refresh } = useNotification();
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
                .map((notification: any) => {
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
                }) as Notification[];

            // Sunucudan gelen anlık listeyi direkt state'e yaz (DB'de silinen bildirimler de UI'dan kalksın)
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
        }, [fetchNotifications])
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

    const groupNotificationsByDate = useCallback(
        (notifications: Notification[]): NotificationGroup[] => {
            // Cihazın yerel saatine göre bugünün başlangıcı
            const now = new Date();
            const startOfToday = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate()
            );
            const oneDayMs = 24 * 60 * 60 * 1000;

            const groups: { [key: string]: Notification[] } = {
                'Bugün': [],
                'Dün': [],
                'Son 1 Hafta': [],
                'Son 30 Gün': [],
                'Daha Eski': [],
            };

            notifications.forEach((notification) => {
                const created = new Date(notification.created_at);
                const startOfCreated = new Date(
                    created.getFullYear(),
                    created.getMonth(),
                    created.getDate()
                );

                const diffMs = startOfToday.getTime() - startOfCreated.getTime();
                // Eğer created_at, cihaz saatine göre gelecekte görünüyorsa (timezone farkı vb.),
                // negatif gün farkını 0'a sabitleyip "Bugün" grubuna alalım.
                let diffDays = Math.floor(diffMs / oneDayMs);
                if (diffDays < 0) diffDays = 0;

                if (diffDays === 0) {
                    groups['Bugün'].push(notification);
                } else if (diffDays === 1) {
                    groups['Dün'].push(notification);
                } else if (diffDays > 1 && diffDays <= 7) {
                    // Son 1 Hafta: 2–7 gün önce
                    groups['Son 1 Hafta'].push(notification);
                } else if (diffDays > 7 && diffDays <= 30) {
                    // Son 30 Gün: 8–30 gün önce
                    groups['Son 30 Gün'].push(notification);
                } else if (diffDays > 30) {
                    groups['Daha Eski'].push(notification);
                }
            });

            return Object.entries(groups).filter(
                ([, groupItems]) => groupItems.length > 0
            ) as NotificationGroup[];
        },
        []
    );

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

