// Custom hook for notification data fetching and real-time updates
import { useState, useEffect, useCallback, useRef } from 'react';
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

    // Realtime UPDATE/INSERT burst'lerinde UI kilitlenmesin diye fetch'i throttle edelim.
    const fetchInFlightRef = useRef(false);
    const fetchQueuedRef = useRef(false);
    const fetchTimerRef = useRef<any>(null);

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

            // Feedback bildirimlerini (kabul/red vb.) sayfaya girince otomatik okundu yap.
            // Actionable olanlar: follow_request "… takip isteği gönderdi", join_request "... katılım isteği"
            // Feedback olanlar: follow_request (actionable olmayan her şey), join_request (kabul/red içerenler)
            const idsToMarkRead = (formattedNotifications || [])
                .filter((n: any) => !n?.is_read)
                .filter((n: any) => n?.type === 'follow_request' || n?.type === 'join_request')
                .filter((n: any) => {
                    const msg = String(n?.message || '');
                    const msgLower = msg.toLowerCase();

                    if (n.type === 'follow_request') {
                        const isActionable =
                            msgLower.includes('takip isteği gönderdi') ||
                            msgLower.includes('sent you a follow request');
                        return !isActionable;
                    }

                    if (n.type === 'join_request') {
                        const isFeedback =
                            msgLower.includes('kabul edildiniz') ||
                            msgLower.includes('kabul edilmediniz') ||
                            msgLower.includes('reddedildi');
                        return isFeedback;
                    }

                    return false;
                })
                .map((n: any) => n?.id)
                .filter((id: any) => typeof id === 'string' && id);

            if (idsToMarkRead.length > 0) {
                // DB'de okundu işaretle
                const { error: updErr } = await supabase
                    .from('notifications')
                    .update({ is_read: true })
                    .in('id', idsToMarkRead);

                if (updErr) {
                    console.error('[Notifications] auto-mark feedback read error:', updErr);
                } else {
                    // UI state'i de güncelle
                    setNotifications(prev => prev.map(n => idsToMarkRead.includes(n.id) ? { ...n, is_read: true } : n));
                    refresh();
                }
            }
        } catch (error) {
            console.error(t('notifications.loadingError'), error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [t]);

    const scheduleFetch = useCallback(() => {
        // Zaten planlandıysa tekrar planlama
        if (fetchTimerRef.current) return;
        fetchTimerRef.current = setTimeout(async () => {
            fetchTimerRef.current = null;
            if (fetchInFlightRef.current) {
                fetchQueuedRef.current = true;
                return;
            }
            fetchInFlightRef.current = true;
            try {
                await fetchNotifications();
                refresh();
            } finally {
                fetchInFlightRef.current = false;
                if (fetchQueuedRef.current) {
                    fetchQueuedRef.current = false;
                    scheduleFetch();
                }
            }
        }, 350);
    }, [fetchNotifications, refresh]);

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
                    () => {
                        if (mounted) scheduleFetch();
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
                    () => {
                        if (mounted) scheduleFetch();
                    }
                )
                .subscribe();

        })();

        return () => {
            mounted = false;
            if (fetchTimerRef.current) {
                try { clearTimeout(fetchTimerRef.current); } catch (_) {}
                fetchTimerRef.current = null;
            }
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [scheduleFetch]);

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

