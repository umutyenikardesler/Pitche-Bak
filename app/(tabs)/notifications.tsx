import { View, ActivityIndicator, Modal } from "react-native";
import { useState, useCallback } from "react";
import ProfilePreview from '@/components/index/ProfilePreview';
import { useNotifications } from '@/components/notifications/useNotifications';
import { useNotificationHandlers } from '@/components/notifications/useNotificationHandlers';
import NotificationList from '@/components/notifications/NotificationList';
import { useNotification } from '@/components/NotificationContext';
import { useFocusEffect } from 'expo-router';

export default function Notifications() {
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

    // Bildirim sayfasına her odaklanıldığında kalp ikonundaki badge'i sıfırla
    useFocusEffect(
        useCallback(() => {
            clearBadge();
            // İsteğe bağlı: badge ve genel sayaçları anında senkronize et
            refresh();
        }, [clearBadge, refresh])
    );

    const {
        handleMarkAsRead,
        handleFollowRequest,
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
                <ActivityIndicator size="large" color="#16a34a" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-gray-100">
            <NotificationList
                groupedNotifications={groupedNotifications}
                onFollowRequest={handleFollowRequest}
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
