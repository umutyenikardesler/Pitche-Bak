import { View, Text, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";

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
    onFollowBack?: () => Promise<'sent' | 'already'>;
    onProfilePress?: (userId: string) => void;
    onMarkAsRead?: (item: any) => void;
}

export default function FollowRequestNotification({
    item,
    onAccept,
    onReject,
    onFollowBack,
    onProfilePress,
    onMarkAsRead,
}: FollowRequestNotificationProps) {
    const { t } = useLanguage();
    const [followBackLoading, setFollowBackLoading] = useState(false);
    const [followBackStatus, setFollowBackStatus] = useState<"idle" | "pending" | "accepted">("idle");
    const [followBackPendingSource, setFollowBackPendingSource] = useState<"none" | "db" | "just_sent">("none");
    
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
    const isResultMessage =
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

    const isStartedFollowing = msg.includes('seni takip etmeye başladı') || msgLower.includes('started following');

    // "Sen de takip et" durumunu DB'den oku + kabul edilince realtime ile güncelle
    useEffect(() => {
        let mounted = true;
        let channel: any = null;

        (async () => {
            if (!isStartedFollowing) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (!mounted || !user) return;

            const { data: fr } = await supabase
                .from("follow_requests")
                .select("status")
                .eq("follower_id", user.id)
                .eq("following_id", item.sender_id)
                .maybeSingle();

            if (!mounted) return;
            const st = (fr as any)?.status as string | undefined;
            if (st === "accepted") {
                setFollowBackStatus("accepted");
                setFollowBackPendingSource("none");
            } else {
                // NOT: pending'ı ekrana kendiliğinden yansıtma.
                // Kullanıcı butona basmadıkça "Takip isteğin gönderildi/zaten gönderilmiş" görünmesin.
                setFollowBackStatus("idle");
                setFollowBackPendingSource("none");
            }

            // realtime: karşı taraf kabul edince status accepted olsun
            channel = supabase
                .channel(`follow-back-${user.id}-${item.sender_id}`)
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "follow_requests",
                        filter: `follower_id=eq.${user.id}`,
                    },
                    (payload: any) => {
                        const row = payload?.new;
                        if (!row) return;
                        if (row.following_id !== item.sender_id) return;
                        if (row.status === "accepted") {
                            setFollowBackStatus("accepted");
                            setFollowBackPendingSource("none");
                        } else {
                            setFollowBackStatus("idle");
                            setFollowBackPendingSource("none");
                        }
                    }
                )
                .subscribe();
        })();

        return () => {
            mounted = false;
            if (channel) supabase.removeChannel(channel);
        };
    }, [isStartedFollowing, item.sender_id]);

    return (
        <TouchableOpacity 
            className="bg-white rounded-lg mx-4 mt-3 shadow-sm"
            onPress={() => {
                // Sonuç bildirimlerine tıklandığında okundu olarak işaretle
                if (isResultMessage && !item.is_read) {
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
                    {isResultMessage ? (
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
                {isResultMessage ? (
                    // Sonuç bildirimi - sadece tarih göster
                    <View
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                        }}
                    >
                        <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                            {formatted}
                        </Text>

                        {/* Kabul sonrası: "Sen de takip et" (aynı satırda, sağa dayalı) */}
                        {isStartedFollowing && onFollowBack ? (
                            <TouchableOpacity
                                activeOpacity={0.85}
                                disabled={followBackLoading || followBackStatus !== "idle"}
                                onPress={async () => {
                                    if (followBackLoading) return;
                                    if (followBackStatus !== "idle") return;
                                    setFollowBackLoading(true);
                                    try {
                                        const res = await onFollowBack();
                                        setFollowBackStatus("pending");
                                        setFollowBackPendingSource(res === "sent" ? "just_sent" : "db");
                                    } finally {
                                        setFollowBackLoading(false);
                                    }
                                }}
                                style={{
                                    backgroundColor:
                                        followBackStatus === "accepted"
                                            ? "#16a34a"
                                            : followBackStatus === "pending"
                                                ? "#f97316"
                                                : "#16a34a",
                                    paddingVertical: 6,
                                    paddingHorizontal: 10,
                                    borderRadius: 10,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 6,
                                    opacity: followBackLoading ? 0.8 : 1,
                                }}
                            >
                                {followBackLoading ? (
                                    <ActivityIndicator color="#ffffff" />
                                ) : (
                                    <>
                                        <Ionicons
                                            name={followBackStatus === "accepted" ? "checkmark-circle-outline" : "person-add-outline"}
                                            size={16}
                                            color="#ffffff"
                                        />
                                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12 }}>
                                            {followBackStatus === "accepted"
                                                ? t("notifications.followBackFollowing")
                                                : followBackStatus === "pending"
                                                    ? (followBackPendingSource === "db"
                                                        ? t("notifications.followBackAlreadySent")
                                                        : t("notifications.followBackSent"))
                                                    : t('notifications.followBack')}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        ) : null}
                    </View>
                ) : (
                    // Normal takip isteği - tarih + butonlar
                    <View className="flex-row justify-between items-center">
                        <View className="mr-3">
                            <Text className={`text-xs font-bold px-2 py-1 rounded ${item.is_read ? 'text-gray-500 bg-gray-300' : 'text-green-700 bg-gray-200'}`}>
                                {formatted}
                            </Text>
                        </View>
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
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
}
