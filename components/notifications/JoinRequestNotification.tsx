import { View, Text, TouchableOpacity, Image } from "react-native";
import { useLanguage } from '@/contexts/LanguageContext';

interface JoinRequestNotificationProps {
    item: {
        id: string;
        sender_id: string;
        sender_name: string;
        sender_surname: string;
        sender_profile_image?: string;
        is_read: boolean;
        message?: string;
        created_at: string;
        position?: string;
        match?: {
            formattedDate: string;
            startFormatted: string;
            endFormatted: string;
            pitches?: {
                name?: string;
                districts?: {
                    name?: string;
                };
            };
        };
    };
    onAccept: (item: any) => void;
    onReject: (item: any) => void;
    onProfilePress: (userId: string) => void;
    onMarkAsRead?: (item: any) => void;
}

export default function JoinRequestNotification({ item, onAccept, onReject, onProfilePress, onMarkAsRead }: JoinRequestNotificationProps) {
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

    // Pozisyon kodlarını tam isimlere çevir
    const getPositionName = (positionCode: string) => {
        switch (positionCode) {
            case 'K': return 'Kaleci';
            case 'D': return 'Defans';
            case 'O': return 'Orta Saha';
            case 'F': return 'Forvet';
            default: return positionCode;
        }
    };

    // Maç bilgilerini hazırla
    const matchInfo = item.match ? 
        `${item.match.formattedDate} ${item.match.startFormatted}-${item.match.endFormatted}, ${item.match.pitches?.districts?.name || 'Bilinmiyor'} → ${item.match.pitches?.name || 'Bilinmiyor'}` :
        'Bilinmiyor';

    return (
        <TouchableOpacity 
            className="bg-white rounded-lg mx-4 mt-3 shadow-sm"
            onPress={() => {
                // Sadece geri bildirim mesajlarına tıklandığında okundu olarak işaretle
                if (item.message && (item.message.includes('kullanıcısının oluşturduğu') || item.message.includes('kabul edildiniz') || item.message.includes('kabul edilmediniz') || item.message.includes('reddedildi'))) {
                    onMarkAsRead?.(item);
                }
            }}
            activeOpacity={0.7}
        >
            {/* Üst satır - Profil Resmi ve Bildirim Metni */}
            <View className="flex-row items-center p-4">
                {/* Profil Resmi */}
                <TouchableOpacity 
                    className="mr-3"
                    onPress={() => onProfilePress(item.sender_id)}
                >
                    <Image
                        source={item.sender_profile_image ? { uri: item.sender_profile_image } : require('@/assets/images/ball.png')}
                        style={{ width: 72, height: 72, borderRadius: 36, resizeMode: 'cover', opacity: item.is_read ? 0.6 : 1 }}
                    />
                </TouchableOpacity>
                {/* Bildirim Metni */}
                <View className="flex-1 p-1 leading-snug">
                    {item.message && (item.message.includes('reddedildi')) ? (
                        // Red bildirimi - detaylı mesaj formatı
                        <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                            {(() => {
                                // Mesajı parse et: "Duygu Zengin kullanıcısının oluşturmuş olduğu 25.10.2025 14:00-15:00, Kadıköy → Fenerbahçe maçı için Defans pozisyonuna katılma isteğiniz reddedildi."
                                // "maçı için" ile ayır
                                const messageParts = item.message.split(' maçı için ');
                                const beforeMatch = messageParts[0]; // "Duygu Zengin kullanıcısının oluşturmuş olduğu 25.10.2025 14:00-15:00, Kadıköy → Fenerbahçe"
                                const afterMatch = messageParts[1]; // "Defans pozisyonuna katılma isteğiniz reddedildi."
                                
                                // beforeMatch'i parse et - virgül ile ayır
                                const beforeMatchParts = beforeMatch.split(', ');
                                const firstPart = beforeMatchParts[0]; // "Duygu Zengin kullanıcısının oluşturmuş olduğu 25.10.2025 14:00-15:00"
                                const locationInfo = beforeMatchParts[1] || ''; // "Kadıköy → Fenerbahçe"
                                
                                // firstPart'i parse et
                                const firstPartWords = firstPart.split(' ');
                                const name = firstPartWords[0] + ' ' + firstPartWords[1]; // "Duygu Zengin"
                                const userPart = firstPartWords.slice(2, 5).join(' '); // "kullanıcısının oluşturmuş olduğu"
                                const dateTime = firstPartWords.slice(5).join(' '); // "25.10.2025 14:00-15:00"
                                
                                // afterMatch'i parse et
                                const afterMatchParts = afterMatch.split(' pozisyonuna ');
                                const position = afterMatchParts[0]; // "Defans"
                                const reddedildi = afterMatchParts[1]; // "katılma isteğiniz reddedildi."
                                
                                return (
                                    <>
                                        <Text 
                                            className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                            onPress={() => onProfilePress(item.sender_id)}
                                        >
                                            {name}
                                        </Text>
                                        <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> {userPart} </Text>
                                        <Text className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}>{dateTime}</Text>
                                        {locationInfo && (
                                            <>
                                                <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}>, </Text>
                                                <Text className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}>{locationInfo}</Text>
                                            </>
                                        )}
                                        <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> maçı için </Text>
                                        <Text className={`font-bold ${item.is_read ? 'text-orange-500' : 'text-orange-600'}`}>{position}</Text>
                                        <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> pozisyonuna </Text>
                                        <Text className={`font-bold ${item.is_read ? 'text-red-500' : 'text-red-600'}`}>{reddedildi}</Text>
                                    </>
                                );
                            })()}
                        </Text>
                    ) : item.message && (item.message.includes('kullanıcısının oluşturduğu')) ? (
                        // Detaylı sonuç bildirimi - mesajı parse et ve kullanıcı adını linkli yap
                        <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                            {(() => {
                                // Mesajı parse et: "Duygu Zengin kullanıcısının oluşturduğu 25.10.2025 14:00-15:00 Kadıköy → Fenerbahçe maçı için Defans mevkisine kabul edilmediniz."
                                const parts = item.message.split(' ');
                                const name = parts[0] + ' ' + parts[1]; // İsim ve soyisim
                                const restOfMessage = parts.slice(2).join(' '); // Geri kalan mesaj
                                
                                // Mesajı daha detaylı parse et
                                const messageParts = restOfMessage.split(' maçı için ');
                                const beforeMatch = messageParts[0]; // "kullanıcısının oluşturduğu 25.10.2025 14:00-15:00 Kadıköy → Fenerbahçe"
                                const afterMatch = messageParts[1]; // "Defans mevkisine kabul edilmediniz."
                                
                                // beforeMatch'i daha detaylı parse et
                                const beforeMatchParts = beforeMatch.split(' ');
                                const userPart = beforeMatchParts[0]; // "kullanıcısının"
                                const oluşturduğu = beforeMatchParts[1]; // "oluşturduğu"
                                const matchInfo = beforeMatchParts.slice(2).join(' '); // "25.10.2025 14:00-15:00 Kadıköy → Fenerbahçe"
                                
                                // Pozisyon ve sonucu ayır
                                const positionParts = afterMatch.split(' mevkisine ');
                                const position = positionParts[0]; // "Defans"
                                const result = positionParts[1]; // "kabul edildiniz." veya "kabul edilmediniz."
                                
                                // Sonucu daha detaylı parse et
                                const resultParts = result.split(' ');
                                const kabul = resultParts[0]; // "kabul"
                                const edildiniz = resultParts[1]; // "edildiniz." veya "edilmediniz."
                                
                                return (
                                    <>
                                        <Text 
                                            className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                            onPress={() => onProfilePress(item.sender_id)}
                                        >
                                            {name}
                                        </Text>
                                        <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> {userPart} {oluşturduğu} </Text>
                                        <Text className={`font-bold ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}>{matchInfo}</Text>
                                        <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> maçı için </Text>
                                        <Text className={`font-bold ${item.is_read ? 'text-orange-500' : 'text-orange-600'}`}>{position}</Text>
                                        <Text className={`${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> mevkisine </Text>
                                        <Text className={`font-bold ${item.is_read ? (edildiniz.includes('edildiniz') ? 'text-green-500' : 'text-red-500') : (edildiniz.includes('edildiniz') ? 'text-green-600' : 'text-red-600')}`}>{kabul} </Text>
                                        <Text className={`font-bold ${item.is_read ? (edildiniz.includes('edildiniz') ? 'text-green-500' : 'text-red-500') : (edildiniz.includes('edildiniz') ? 'text-green-600' : 'text-red-600')}`}>{edildiniz}</Text>
                                    </>
                                );
                            })()}
                        </Text>
                    ) : item.message && (item.message.includes('kabul edildiniz') || item.message.includes('kabul edilmediniz')) ? (
                        // Kısa sonuç bildirimi - eski format (sadece alt satırda gösterilecek)
                        <View className="leading-snug">
                            <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                                <Text
                                    className={`font-bold leading-6 ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                    onPress={() => onProfilePress(item.sender_id)}
                                >
                                    {item.sender_name} {item.sender_surname}
                                </Text>
                                <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> kullanıcısı senin </Text>
                                <Text className={`font-bold leading-6 ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}>{matchInfo}</Text>
                                <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> maçın için </Text>
                                <Text className={`font-bold leading-6 ${item.is_read ? 'text-orange-500' : 'text-orange-600'}`}>{getPositionName(item.position || '')}</Text>
                                <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> pozisyonuna katılmak istiyor?</Text>
                            </Text>
                        </View>
                    ) : (
                        // Normal katılım isteği bildirimi
                        <View className="leading-snug">
                            <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}>
                                <Text
                                    className={`font-bold leading-6 ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}
                                    onPress={() => onProfilePress(item.sender_id)}
                                >
                                    {item.sender_name} {item.sender_surname}
                                </Text>
                                <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> kullanıcısı senin </Text>
                                <Text className={`font-bold leading-6 ${item.is_read ? 'text-gray-600' : 'text-green-700'}`}>{matchInfo}</Text>
                                <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> maçın için </Text>
                                <Text className={`font-bold leading-6 ${item.is_read ? 'text-orange-500' : 'text-orange-600'}`}>{getPositionName(item.position || '')}</Text>
                                <Text className={`leading-6 ${item.is_read ? 'text-gray-500' : 'text-gray-700'}`}> pozisyonuna katılmak istiyor?</Text>
                            </Text>
                        </View>
                    )}
                </View>
            </View>
            
            {/* Alt satır - Tarih/Saat ve Butonlar */}
            <View className="px-3 pb-3">
                {item.message && (item.message.includes('reddedildi')) ? (
                    // Red bildirimi - tarih + bilgilendirme mesajı
                    <View className="flex-row justify-between items-center mr-2">
                        <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                            {formatted}
                        </Text>
                        <Text className="text-gray-600 text-xs ml-2 flex-1">Sonraki maçlar için tekrar istek gönderebilirsiniz.</Text>
                    </View>
                ) : item.message && (item.message.includes('kullanıcısının oluşturduğu')) ? (
                    // Detaylı sonuç bildirimi - sadece tarih göster
                    <View className="flex-row justify-start items-center">
                        <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                            {formatted}
                        </Text>
                    </View>
                ) : item.message && (item.message.includes('Göndermiş olduğunuz')) ? (
                    // İstek gönderen kullanıcıya gönderilen red mesajı - mesajı olduğu gibi göster
                    <View className="flex-row justify-between items-center mr-2">
                        <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                            {formatted}
                        </Text>
                        <Text className="text-red-600 font-bold ml-2 flex-1">{item.message}</Text>
                    </View>
                ) : item.message && (item.message.includes('kabul edildiniz') || item.message.includes('kabul edilmediniz')) ? (
                    // Kısa sonuç bildirimi - tarih + kırmızı mesaj (maç sahibi için)
                    <View className="flex-row justify-between items-center mr-2">
                        <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                            {formatted}
                        </Text>
                        {item.message?.includes('kabul edildiniz') && (
                            <Text className="text-green-600 font-bold ml-2"> Maça katılma isteğini kabul ettiniz.</Text>
                        )}
                        {item.message?.includes('kabul edilmediniz') && (
                            <Text className="text-red-600 font-bold ml-2"> Maça katılma isteğini kabul etmediniz.</Text>
                        )}
                    </View>
                ) : (
                    // Normal katılım isteği - tarih + butonlar
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
                            </View>
                        </View>
                    )}
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}
