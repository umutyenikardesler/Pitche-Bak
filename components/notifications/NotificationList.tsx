// Component for rendering grouped notifications
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { Notification, NotificationGroup } from './notificationTypes';
import FollowRequestNotification from './FollowRequestNotification';
import JoinRequestNotification from './JoinRequestNotification';
import DirectMessageNotification from './DirectMessageNotification';

interface NotificationListProps {
    groupedNotifications: NotificationGroup[];
    onFollowRequest: (notification: Notification, action: 'accept' | 'reject') => void;
    onJoinRequest: (notification: Notification, action: 'accept' | 'reject') => void;
    onMarkAsRead: (notification: Notification) => void;
    onProfilePress: (userId: string) => void;
    refreshing: boolean;
    onRefresh: () => void;
}

export default function NotificationList({
    groupedNotifications,
    onFollowRequest,
    onJoinRequest,
    onMarkAsRead,
    onProfilePress,
    refreshing,
    onRefresh,
}: NotificationListProps) {
    const { t } = useLanguage();

    const renderNotification = ({ item }: { item: Notification }) => {
        if (item.type === 'follow_request') {
            return (
                <FollowRequestNotification
                    item={item}
                    onAccept={(item) => onFollowRequest(item, 'accept')}
                    onReject={(item) => onFollowRequest(item, 'reject')}
                    onProfilePress={onProfilePress}
                    onMarkAsRead={onMarkAsRead}
                />
            );
        } else if (item.type === 'join_request') {
            return (
                <JoinRequestNotification
                    item={item}
                    onAccept={(item) => onJoinRequest(item, 'accept')}
                    onReject={(item) => onJoinRequest(item, 'reject')}
                    onProfilePress={onProfilePress}
                    onMarkAsRead={onMarkAsRead}
                />
            );
        } else if (item.type === 'direct_message') {
            return (
                <DirectMessageNotification 
                    item={item} 
                    onMarkAsRead={onMarkAsRead} 
                />
            );
        }
        
        return null;
    };

    if (groupedNotifications.length === 0) {
        return (
            <View className="flex-1 justify-center items-center mt-4">
                <Text className="text-gray-500">{t('notifications.noNotificationsYet')}</Text>
            </View>
        );
    }

    return (
        <ScrollView 
            className="flex-1" 
            contentContainerStyle={{ paddingBottom: 20 }}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                />
            }
        >
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
        </ScrollView>
    );
}

