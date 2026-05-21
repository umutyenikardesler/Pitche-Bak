import { View, Text, TouchableOpacity, Image } from "react-native";
import { useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';

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
    const { colors } = useAppTheme();
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
            <View
                className="rounded-lg mx-4 mt-3 shadow-sm"
                style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: item.is_read ? colors.border : colors.primary }}
            >
                <View className="flex-row items-center p-4">
                    <View className="mr-3">
                        <Image
                            source={item.sender_profile_image ? { uri: item.sender_profile_image } : require('@/assets/images/ball.png')}
                            style={{ 
                                width: 56, 
                                height: 56, 
                                borderRadius: 28, 
                                borderWidth: 1,
                                borderColor: colors.primary,
                                shadowColor: colors.primary,
                                shadowOpacity: 0.9,
                                shadowRadius: 16,
                                shadowOffset: { width: 0, height: 0 },
                                elevation: 12,
                                resizeMode: 'cover',
                                opacity: item.is_read ? 0.6 : 1 
                            }}
                        />
                    </View>
                    <View className="flex-1">
                        <Text 
                            style={{ color: item.is_read ? colors.textMuted : colors.text }}
                            numberOfLines={2}
                        >
                            <Text className="font-bold" style={{ color: colors.primaryDark }}>
                                {senderFullName}
                            </Text> {t('notifications.sentMessage') || 'size mesaj gönderdi.'}
                        </Text>
                        {!!item.message && (
                            <Text 
                                className="mt-1"
                                style={{ color: item.is_read ? colors.textMuted : colors.textSecondary }}
                                numberOfLines={1}
                            >
                                {'"'}{item.message}{'"'}
                            </Text>
                        )}
                    </View>
                </View>
                <View className="px-4 pb-3">
                    <View className="flex-row items-center">
                        <Text
                            className="text-xs font-bold px-2 py-1 rounded"
                            style={{ color: item.is_read ? colors.textMuted : colors.primaryDark, backgroundColor: colors.surfaceAlt }}
                        >
                            {formatted}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}
