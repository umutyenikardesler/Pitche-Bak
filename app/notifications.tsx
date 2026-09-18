import { View, ActivityIndicator, Modal, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from "react";
import ProfilePreview from '@/components/index/ProfilePreview';
import { useNotifications } from '@/components/notifications/useNotifications';
import { useNotificationHandlers } from '@/components/notifications/useNotificationHandlers';
import NotificationList from '@/components/notifications/NotificationList';
import { useNotification } from '@/components/NotificationContext';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useGuestAuthAlert } from '@/contexts/GuestAuthModalContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import AppHeader from '@/components/AppHeader';

export default function Notifications() {
    const router = useRouter();
    const { t } = useLanguage();
    const { colors } = useAppTheme();
    const { isGuest } = useAuth();
    const { showGuestAuthAlert } = useGuestAuthAlert();
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [viewingUserId, setViewingUserId] = useState<string | null>(null);
    
    const {
        notifications,
        setNotifications,
        loading,
        refreshing,
        groupNotificationsByDate,
        handleRefresh,
        markAllAsRead,
        clearAll,
    } = useNotifications();

    const { clearBadge, refresh } = useNotification();

    useFocusEffect(
        useCallback(() => {
            if (isGuest) {
                showGuestAuthAlert(t('auth.guestNotifications'));
                return;
            }

            // Badge sayısı anında güncellensin diye await edelim
            (async () => {
                try {
                    await clearBadge();
                    refresh();
                } catch (_) {}
            })();
        }, [isGuest, showGuestAuthAlert, clearBadge, refresh, t])
    );

    const {
        handleMarkAsRead,
        handleFollowRequest,
        handleFollowBack,
        handleJoinRequest,
    } = useNotificationHandlers(setNotifications);

    const closeProfileModal = useCallback(() => {
        setViewingUserId(null);
        setProfileModalVisible(false);
    }, []);

    const handleProfilePress = useCallback((userId: string) => {
        setViewingUserId(userId);
        setProfileModalVisible(true);
    }, []);

    const groupedNotifications = groupNotificationsByDate(notifications);

    // Toplu işlem sürerken iki buton da kilitli; art arda dokunma iki istek atmasın.
    const [bulkAction, setBulkAction] = useState<'read' | 'clear' | null>(null);
    const hasUnread = notifications.some((n) => !n.is_read);

    const handleMarkAllRead = useCallback(async () => {
        setBulkAction('read');
        const ok = await markAllAsRead();
        setBulkAction(null);
        if (!ok) Alert.alert(t('general.error'), t('notifications.bulkFailed'));
    }, [markAllAsRead, t]);

    const handleClearAll = useCallback(() => {
        Alert.alert(t('notifications.clearAllTitle'), t('notifications.clearAllConfirm'), [
            { text: t('general.cancel'), style: 'cancel' },
            {
                text: t('notifications.clearAllAction'),
                style: 'destructive',
                onPress: async () => {
                    setBulkAction('clear');
                    const ok = await clearAll();
                    setBulkAction(null);
                    if (!ok) Alert.alert(t('general.error'), t('notifications.bulkFailed'));
                },
            },
        ]);
    }, [clearAll, t]);

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            {/* Bu ekran sekme grubunun DIŞINDA (kaydırmalı sekmelere karışmasın
                diye), o yüzden header'ı navigatörden almıyor; kendisi çiziyor. */}
            <AppHeader title={t('notifications.title')} showNotificationIcon={false} />

            {/* Toplu işlemler: listenin üstünde. Liste boşsa gösterilmez. */}
            {notifications.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <TouchableOpacity
                        onPress={handleMarkAllRead}
                        disabled={!hasUnread || bulkAction !== null}
                        activeOpacity={0.8}
                        accessibilityLabel={t('notifications.markAllRead')}
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 9,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.primary,
                            backgroundColor: colors.surface,
                            // Okunmamış yoksa yapacak bir şey yok; soluk ve pasif.
                            opacity: hasUnread ? 1 : 0.5,
                        }}
                    >
                        {bulkAction === 'read' ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <>
                                <Ionicons name="checkmark-done-outline" size={18} color={colors.primary} />
                                <Text numberOfLines={1} style={{ marginLeft: 6, color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                                    {t('notifications.markAllRead')}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleClearAll}
                        disabled={bulkAction !== null}
                        activeOpacity={0.8}
                        accessibilityLabel={t('notifications.clearAll')}
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingVertical: 9,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.danger,
                            backgroundColor: colors.surface,
                        }}
                    >
                        {bulkAction === 'clear' ? (
                            <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                            <>
                                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                                <Text numberOfLines={1} style={{ marginLeft: 6, color: colors.danger, fontWeight: '700', fontSize: 13 }}>
                                    {t('notifications.clearAll')}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            <NotificationList
                groupedNotifications={groupedNotifications}
                onFollowRequest={handleFollowRequest}
                onFollowBack={handleFollowBack}
                onJoinRequest={handleJoinRequest}
                onMarkAsRead={handleMarkAsRead}
                onProfilePress={handleProfilePress}
                refreshing={refreshing}
                onRefresh={handleRefresh}
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
