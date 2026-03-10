import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from '@/contexts/LanguageContext';

interface FollowRequestNotificationProps {
    item: {
        id: string;
        sender_id: string;
        sender_name: string;
        sender_surname: string;
        sender_profile_image?: string;
        is_read: boolean;
        message?: string;
        created_at: string;
    };
    onAccept: (item: any) => void;
    onReject: (item: any) => void;
    onProfilePress?: (userId: string) => void;
    onMarkAsRead?: (item: any) => void;
}

export default function FollowRequestNotification({ item, onAccept, onReject, onProfilePress, onMarkAsRead }: FollowRequestNotificationProps) {
    const { t } = useLanguage();
    
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

    const msg = String(item.message || '');
    const msgLower = msg.toLowerCase();
    const senderFullName = `${item.sender_name || ''} ${item.sender_surname || ''}`.trim();
    const isResult =
      item.is_read &&
      (msg.includes('seni takip etmeye başladı') ||
        msgLower.includes('started following') ||
        msg.includes('takip isteğinizi kabul etti') ||
        msgLower.includes('accepted your follow request') ||
        msg.includes('takip isteğinizi reddetti') ||
        msgLower.includes('rejected your follow request') ||
        msg.includes('takip isteğini reddettiniz') ||
        msgLower.includes('you rejected'));

    const renderResultMessage = () => {
      if (msg.includes('seni takip etmeye başladı') || msgLower.includes('started following')) {
        return t('notifications.follow.startedFollowing').replace('{name}', senderFullName);
      }
      if (msg.includes('takip isteğinizi kabul etti') || msgLower.includes('accepted your follow request')) {
        return t('notifications.follow.acceptedYourRequest').replace('{name}', senderFullName);
      }
      if (msg.includes('takip isteğinizi reddetti') || msgLower.includes('rejected your follow request')) {
        return t('notifications.follow.rejectedYourRequest').replace('{name}', senderFullName);
      }
      if (msg.includes('takip isteğini reddettiniz') || msgLower.includes('you rejected')) {
        return t('notifications.follow.youRejectedRequest').replace('{name}', senderFullName);
      }
      return msg;
    };

    return (
        <TouchableOpacity 
            className="bg-white rounded-lg mx-4 mt-3 shadow-sm"
            onPress={() => {
                // Sadece sonuç bildirimlerine tıklandığında okundu olarak işaretle
                if (isResult) {
                    onMarkAsRead?.(item);
                }
            }}
            activeOpacity={0.7}
        >
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
                    {isResult ? (
                        <Text
                            className={`text-sm leading-5 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}
                            style={{ flexShrink: 1, flexWrap: 'wrap' }}
                            numberOfLines={2}
                        >
                            {(() => {
                                const full = renderResultMessage();
                                const idx = senderFullName ? full.indexOf(senderFullName) : -1;
                                if (idx === -1) {
                                    return <Text>{full}</Text>;
                                }
                                const before = full.slice(0, idx).trimStart();
                                const after = full.slice(idx + senderFullName.length);
                                return (
                                    <>
                                        {!!before && <Text>{before} </Text>}
                                        <Text
                                            className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                            onPress={() => onProfilePress?.(item.sender_id)}
                                        >
                                            {senderFullName}
                                        </Text>
                                        <Text>{after}</Text>
                                    </>
                                );
                            })()}
                        </Text>
                    ) : (
                        // Normal takip isteği bildirimi
                        <Text
                            className={`mb-3 text-sm leading-5 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}
                            style={{ flexShrink: 1, flexWrap: 'wrap' }}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.88}
                        >
                            <Text className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}>{item.sender_name} {item.sender_surname}</Text> {t('notifications.sentFollowRequest')}
                        </Text>
                    )}
                </View>
            </View>
            
            {/* Alt satır - Tarih/Saat ve Butonlar */}
            <View className="px-3 pb-3">
                {isResult ? (
                    // Sonuç bildirimi - sadece tarih göster
                    <View className="flex-row justify-start items-center">
                        <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                            {formatted}
                        </Text>
                    </View>
                ) : (
                    // Normal takip isteği - tarih + butonlar
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
                                        onPress={() => onReject(item)}
                                        className="bg-red-500 font-bold px-2 py-2 rounded"
                                    >
                                        <Text className="text-white">{t('general.reject')}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View className="flex-row">
                                    <TouchableOpacity
                                        onPress={() => onAccept(item)}
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
                                        {renderResultMessage() || t('notifications.actionCompleted')}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}
