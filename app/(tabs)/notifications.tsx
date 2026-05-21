import { View, ActivityIndicator, Modal } from "react-native";
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

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
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
