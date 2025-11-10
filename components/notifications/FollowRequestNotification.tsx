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

    return (
        <TouchableOpacity 
            className="bg-white rounded-lg mx-4 mt-3 shadow-sm"
            onPress={() => {
                // Sadece sonuç bildirimlerine tıklandığında okundu olarak işaretle
                if (item.message && (item.message.includes('kabul edildi') || item.message.includes('reddedildi') || item.message.includes('reddetti') || item.message.includes('reddettiniz') || item.message.includes('takip isteğinizi') || item.message.includes('seni takip etmeye başladı'))) {
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
                    {item.message && (item.message.includes('kabul edildi') || item.message.includes('reddedildi') || item.message.includes('reddetti') || item.message.includes('reddettiniz') || item.message.includes('takip isteğinizi') || item.message.includes('seni takip etmeye başladı')) ? (
                        // Sonuç bildirimi (kabul/red) - mesajı parse et ve kullanıcı adını linkli yap
                        <Text
                            className={`text-sm leading-5 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}
                            style={{ flexShrink: 1, flexWrap: 'wrap' }}
                            numberOfLines={2}
                        >
                            {(() => {
                                if (item.message?.includes('seni takip etmeye başladı')) {
                                    // "Umut Yılmaz seni takip etmeye başladı." formatı için
                                    const parts = item.message.split(' ');
                                    const name = parts[0] + ' ' + parts[1]; // İsim ve soyisim
                                    const restOfMessage = parts.slice(2).join(' '); // Geri kalan mesaj
                                    
                                    return (
                                        <>
                                            <Text 
                                                className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                                onPress={() => onProfilePress?.(item.sender_id)}
                                            >
                                                {name}
                                            </Text>
                                            <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> {restOfMessage}</Text>
                                        </>
                                    );
                                } else if (item.message?.includes('takip isteğinizi reddetti')) {
                                    // İstek gönderen kullanıcıya: "Duygu Zengin takip isteğinizi reddetti."
                                    const parts = item.message.split(' ');
                                    const name = parts[0] + ' ' + parts[1]; // İsim ve soyisim
                                    const beforeReddetti = parts.slice(2, parts.length - 1).join(' '); // "takip isteğinizi"
                                    const reddetti = parts[parts.length - 1]; // "reddetti."
                                    
                                    return (
                                        <>
                                            <Text 
                                                className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                                onPress={() => onProfilePress?.(item.sender_id)}
                                            >
                                                {name}
                                            </Text>
                                            <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> {beforeReddetti} </Text>
                                            <Text className={`font-bold ${item.is_read ? 'text-red-500' : 'text-red-600'}`}>{reddetti}</Text>
                                        </>
                                    );
                                } else if (item.message?.includes('kullanıcısının takip isteğini reddettiniz')) {
                                    // İstek gelen kişiye: "Umut Yılmaz kullanıcısının takip isteğini reddettiniz."
                                    const parts = item.message.split(' ');
                                    const name = parts[0] + ' ' + parts[1]; // İsim ve soyisim
                                    const beforeReddettiniz = parts.slice(2, parts.length - 1).join(' '); // "kullanıcısının takip isteğini"
                                    const reddettiniz = parts[parts.length - 1]; // "reddettiniz."
                                    
                                    return (
                                        <>
                                            <Text 
                                                className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                                onPress={() => onProfilePress?.(item.sender_id)}
                                            >
                                                {name}
                                            </Text>
                                            <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> {beforeReddettiniz} </Text>
                                            <Text className={`font-bold ${item.is_read ? 'text-red-500' : 'text-red-600'}`}>{reddettiniz}</Text>
                                        </>
                                    );
                                } else {
                                    // Diğer mesajlar için: "Duygu Zengin takip isteğinizi kabul etti."
                                    const parts = item.message.split(' ');
                                    const name = parts[0] + ' ' + parts[1]; // İsim ve soyisim
                                    const restOfMessage = parts.slice(2).join(' '); // Geri kalan mesaj
                                    
                                    return (
                                        <>
                                            <Text 
                                                className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                                onPress={() => onProfilePress?.(item.sender_id)}
                                            >
                                                {name}
                                            </Text>
                                            <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> {restOfMessage}</Text>
                                        </>
                                    );
                                }
                            })()}
                            {item.message?.includes('kabul edildi') && (
                                <Text className="text-green-600 font-bold"> ✓</Text>
                            )}
                            {item.message?.includes('reddedildi') && (
                                <Text className="text-red-600 font-bold"> ✗</Text>
                            )}
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
                {item.message && (item.message.includes('kabul edildi') || item.message.includes('reddedildi') || item.message.includes('reddetti') || item.message.includes('reddettiniz') || item.message.includes('takip isteğinizi') || item.message.includes('seni takip etmeye başladı')) ? (
                    // Sonuç bildirimi - sadece tarih göster
                    <View className="flex-row justify-start items-center">
                        <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                            {formatted}
                        </Text>
                        {item.message?.includes('kabul edildi') }
                        {item.message?.includes('reddedildi') }
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
                                        {item.message || 'İşlem Tamamlandı'}
                                    </Text>
                                    {item.message?.includes('kabul edildiniz') && (
                                        <View className="ml-0 w-4 h-4 bg-green-600 rounded-full items-center justify-center">
                                            <Text className="text-white text-xs font-bold">✓</Text>
                                        </View>
                                    )}
                                    {item.message?.includes('kabul edilmediniz') && (
                                        <View className="ml-0 w-4 h-4 bg-red-600 rounded-full items-center justify-center">
                                            <Text className="text-white text-xs font-bold">✗</Text>
                                        </View>
                                    )}
                                    {item.message?.includes('kabul edildi') && (
                                        <View className="ml-0 w-4 h-4 bg-green-600 rounded-full items-center justify-center">
                                            <Text className="text-white text-xs font-bold">✓</Text>
                                        </View>
                                    )}
                                    {item.message?.includes('reddedildi') && (
                                        <View className="ml-0 w-4 h-4 bg-red-600 rounded-full items-center justify-center">
                                            <Text className="text-white text-xs font-bold">✗</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}
