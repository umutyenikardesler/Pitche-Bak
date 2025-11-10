import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';

interface DirectMessageNotificationProps {
    item: {
        id: string;
        sender_id: string;
        sender_name: string;
        sender_surname: string;
        sender_profile_image?: string;
        message?: string;
        created_at: string;
        match_id?: string;
        is_read: boolean;
    };
    onMarkAsRead?: (item: any) => void;
}

export default function DirectMessageNotification({ item, onMarkAsRead }: DirectMessageNotificationProps) {
    const { t } = useLanguage();
    const router = useRouter();
    
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

    const senderFullName = `${item.sender_name || ''} ${item.sender_surname || ''}`.trim();

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
                // Bildirimi okundu olarak işaretle
                if (!item.is_read) {
                    onMarkAsRead?.(item);
                }
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
                            style={{ 
                                width: 56, 
                                height: 56, 
                                borderRadius: 28, 
                                resizeMode: 'cover',
                                opacity: item.is_read ? 0.6 : 1 
                            }}
                        />
                    </View>
                    <View className="flex-1">
                        <Text 
                            className={`${item.is_read ? 'text-gray-500' : 'text-gray-800'}`} 
                            numberOfLines={2}
                        >
                            <Text className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}>
                                {senderFullName}
                            </Text> {t('notifications.sentMessage') || 'size mesaj gönderdi.'}
                        </Text>
                        {!!item.message && (
                            <Text 
                                className={`mt-1 ${item.is_read ? 'text-gray-400' : 'text-gray-600'}`} 
                                numberOfLines={1}
                            >
                                "{item.message}"
                            </Text>
                        )}
                    </View>
                </View>
                <View className="px-4 pb-3">
                    <View className="flex-row items-center">
                        <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                            {formatted}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}
