import { memo, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Pressable, Modal, Keyboard, BackHandler, type GestureResponderEvent } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/services/supabase';
import { createNotification } from '@/services/triggerPushNotification';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image, TouchableOpacity as RNTouchableOpacity } from 'react-native';
import { useNotification } from '@/components/NotificationContext';
import { containsBannedWord } from '@/constants/bannedWords';
import { getBlockedUserIds, blockUser, unblockUser } from '@/services/blocks';
import { getChatHiddenAt, hideAllChatsWithUser } from '@/lib/hiddenChats';
import { fetchReactions, setMessageReaction, removeMessageReaction, ReactionMap } from '@/services/messageReactions';
import { useFlyingEmoji, type Point } from '@/components/FlyingEmojiLayer';
import { reportContent, hasUserReportedContent } from '@/services/contentReports';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface MsgItem {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  match_id?: string | null;
}

function formatDateTimeTr(iso: string): string {
  const d = new Date(iso);
  const t = d.getTime();
  if (!Number.isFinite(t)) return '';
  const nowYear = new Date().getFullYear();
  const y = d.getFullYear();
  const day = d.getDate();
  const month = d.toLocaleDateString('tr-TR', { month: 'long' });
  const time = d
    .toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', hour12: false })
    .replace(':', '.');
  // Bu yıl ise yılı gizle: "29 Mart 14.04"
  // Farklı yıl ise: "29 Mart 2025 14.04"
  return y === nowYear ? `${day} ${month} - ${time}` : `${day} ${month} ${y} - ${time}`;
}

function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, n));
}

const MESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;

/** Tepki seçenekleri: 6 sütunlu ızgarada 4 satır. */
const REACTION_EMOJIS = [
  '❤️', '😂', '😮', '😢', '😡', '👍',
  '👎', '🙏', '🔥', '👏', '😍', '🤣',
  '😊', '😎', '🤔', '😅', '🥳', '💪',
  '⚽', '🏆', '🥅', '👌', '🙌', '💯',
];

// Tepki seçicinin açılıp kapanma süresi ve rozetin iniş "zıplaması". Uçuşun
// kendisi kök katmanda çiziliyor: bkz. components/FlyingEmojiLayer.tsx.
const REACTION_SHEET_MS = 200;
const REACTION_POP_MS = 320;

function canEditMessage(message: Pick<MsgItem, 'created_at'>): boolean {
  const createdAt = new Date(message.created_at).getTime();
  if (!Number.isFinite(createdAt)) return false;
  return Date.now() - createdAt <= MESSAGE_EDIT_WINDOW_MS;
}

function isMessageEdited(message: Pick<MsgItem, 'edited_at'>): boolean {
  if (!message.edited_at) return false;
  return Number.isFinite(new Date(message.edited_at).getTime());
}

const MessageRow = memo(function MessageRow({
  item,
  mine,
  revealX,
  onReport,
  onOpenOptions,
  onOpenMyOptions,
  isDeleted,
  isEdited,
  editedLabel,
  colors,
  reaction,
  reactionHidden,
  reactionPop,
  onOpenReactions,
  addReactionLabel,
}: {
  item: MsgItem;
  mine: boolean;
  revealX: any;
  onReport: (item: MsgItem) => void;
  onOpenOptions: (item: MsgItem) => void;
  onOpenMyOptions: (item: MsgItem) => void;
  isDeleted?: boolean;
  isEdited?: boolean;
  editedLabel: string;
  colors: any;
  /** Bu mesaja bırakılan tepki (bire bir sohbette yalnızca alıcı tepki verir). */
  reaction?: string | null;
  /** Uçan emoji rozete inene kadar rozetteki emoji gizli. */
  reactionHidden?: boolean;
  /** Uçan emoji indi: rozet kısa bir "zıplama" yapar. */
  reactionPop?: boolean;
  /** Rozete basıldı; rozetin merkezi SAYFA koordinatında. */
  onOpenReactions?: (item: MsgItem, badgeCenter: Point) => void;
  addReactionLabel?: string;
}) {
  const ts = formatDateTimeTr(item.created_at);
  const MAX_REVEAL = 120;
  // Karşı tarafın mesajında rozet her zaman var (tepki vermek için); kendi
  // mesajımda yalnızca karşı taraf tepki bıraktıysa görünür.
  const showReactionBadge = !isDeleted && (!mine || !!reaction);
  const reactionBadgeBase = {
    position: 'absolute' as const,
    bottom: 0,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#16a34a',
  };

  // Rozetin merkezi (SAYFA koordinatı): uçan emojinin ineceği yer. Dokunuşun
  // sayfa konumundan (pageX/Y), rozet içindeki konumundan (locationX/Y) ve
  // rozetin onLayout ile alınan boyutundan hesaplanıyor. ref + measure
  // kullanılmıyor: bu ekranda NativeWind'in JSX sarmalayıcısı yüzünden ref'ler
  // bağlanmadı (bkz. components/FlyingEmojiLayer.tsx).
  const badgeSizeRef = useRef({ width: 0, height: 0 });
  const handleBadgePress = useCallback((e: GestureResponderEvent) => {
    const { pageX, pageY, locationX, locationY } = e.nativeEvent;
    const { width, height } = badgeSizeRef.current;
    let center: Point = { x: pageX, y: pageY };
    if (width > 0 && height > 0 && Number.isFinite(locationX) && Number.isFinite(locationY)) {
      const candidate = { x: pageX - locationX + width / 2, y: pageY - locationY + height / 2 };
      // Tutarlılık kontrolü: merkez, dokunuşa rozetin yarısı + dokunma payından
      // (8) uzaksa locationX/Y başka bir görünüme göre gelmiş demektir; o zaman
      // dokunulan noktaya güveniliyor.
      const limit = Math.max(width, height) / 2 + 8;
      if (Math.abs(candidate.x - pageX) <= limit && Math.abs(candidate.y - pageY) <= limit) {
        center = candidate;
      }
    }
    onOpenReactions?.(item, center);
  }, [item, onOpenReactions]);

  const badgeScale = useSharedValue(1);
  useEffect(() => {
    if (!reactionPop) return;
    badgeScale.value = withSequence(
      withTiming(1.45, { duration: 120, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 180, easing: Easing.out(Easing.back(2)) })
    );
  }, [reactionPop, badgeScale]);
  const badgeScaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.value }] }));

  const tsStyle = useAnimatedStyle(() => {
    const x = clamp(revealX.value, 0, MAX_REVEAL);
    const opacity = interpolate(x, [0, 12, 34], [0, 0.25, 1], Extrapolation.CLAMP);
    return { opacity };
  }, [revealX]);

  const rowStyle = useAnimatedStyle(() => {
    const x = clamp(revealX.value, 0, MAX_REVEAL);
    return {
      transform: [{ translateX: -x }],
    };
  }, [revealX]);

  const ThreeDots = ({ color }: { color: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: '#ffffff',
            borderWidth: 1.5,
            borderColor: color,
            shadowColor: '#ffffff',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 5,
            elevation: 6,
          }}
        />
      ))}
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 3 }}>
      <View style={{ position: 'relative', minHeight: 28 }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
              paddingRight: 2,
            },
            tsStyle,
          ]}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>{ts}</Text>
        </Animated.View>

        <Animated.View
          style={[
            {
              alignSelf: mine ? 'flex-end' : 'flex-start',
              flexDirection: 'row',
              justifyContent: mine ? 'flex-end' : 'flex-start',
              alignItems: 'center',
              gap: 4,
              maxWidth: '85%',
            },
            rowStyle,
          ]}
        >
          {/* Own message: "..." button to the LEFT of the bubble */}
          {mine && !isDeleted && (
            <TouchableOpacity
              onPress={() => onOpenMyOptions(item)}
              style={{ alignSelf: 'center', padding: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ThreeDots color={colors.primary} />
            </TouchableOpacity>
          )}

          <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start' }}>
            {/* Tepki rozeti balonun alt kenarına biniyor. Alt boşluk rozete yer
                açıyor: Android, kapsayıcının dışına taşan çocukları kırpıyor. */}
            <View
              style={{
                position: 'relative',
                paddingBottom: showReactionBadge ? 12 : 0,
                // Rozet balonun köşesinden DIŞARI taşıyor; taşan kısım kapsayıcının
                // içinde kalsın diye yan boşluk. Android sınır dışını hem kırpıyor
                // hem de dokunuşa kapatıyor.
                paddingRight: showReactionBadge && !mine ? 8 : 0,
                paddingLeft: showReactionBadge && mine ? 8 : 0,
              }}
            >
              <Pressable onLongPress={() => (!mine ? onReport(item) : undefined)}>
                <View
                  style={{
                    backgroundColor: isDeleted ? colors.border : (mine ? colors.primary : colors.surfaceAlt),
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    ...(!mine && !isDeleted && { borderWidth: 2, borderColor: '#16a34a' }),
                  }}
                >
                  {isDeleted ? (
                    <Text style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: 14 }}>{item.content}</Text>
                  ) : (
                    <Text style={{ color: mine ? colors.whiteText : colors.text }}>{item.content}</Text>
                  )}
                </View>
              </Pressable>

              {showReactionBadge && !mine && (
                // Karşı tarafın mesajı: sağ alt köşe. Tepki yoksa gülen yüz, varsa seçilen emoji.
                <View style={[reactionBadgeBase, { right: 0 }]}>
                  <Animated.View style={badgeScaleStyle}>
                    <TouchableOpacity
                      onPress={handleBadgePress}
                      onLayout={(e) => {
                        badgeSizeRef.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel={addReactionLabel}
                      style={{ minWidth: 22, height: 22, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' }}
                    >
                      {/* İçerik dokunmaya kapalı: dokunuşu TouchableOpacity'nin kendisi
                          alsın ki locationX/Y onun çerçevesine göre gelsin. */}
                      <View pointerEvents="none">
                        {reaction ? (
                          <Text style={{ fontSize: 14, opacity: reactionHidden ? 0 : 1 }}>{reaction}</Text>
                        ) : (
                          <Ionicons name="happy-outline" size={15} color={colors.primary} style={{ opacity: reactionHidden ? 0 : 1 }} />
                        )}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              )}

              {showReactionBadge && mine && (
                // Kendi mesajım: karşı tarafın tepkisi. Balon ekranın sağ kenarına
                // dayalı olduğu için sol altta; yalnızca gösterim.
                <View pointerEvents="none" style={[reactionBadgeBase, { left: 0, paddingHorizontal: 3 }]}>
                  <Text style={{ fontSize: 14 }}>{reaction}</Text>
                </View>
              )}
            </View>
            {!isDeleted && isEdited ? (
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: colors.textMuted,
                  textAlign: mine ? 'right' : 'left',
                }}
              >
                {editedLabel}
              </Text>
            ) : null}
          </View>

          {/* Other person's message: "..." button to the RIGHT */}
          {!mine && !isDeleted && (
            <TouchableOpacity
              onPress={() => onOpenOptions(item)}
              style={{ alignSelf: 'center', padding: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ThreeDots color={colors.primary} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </View>
  );
});

export default function ChatScreen() {
  const { to, matchId, name } = useLocalSearchParams<{ to: string; matchId?: string; name?: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MsgItem[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportItem, setReportItem] = useState<MsgItem | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [messageOptionsItem, setMessageOptionsItem] = useState<MsgItem | null>(null);
  const [myOptionsItem, setMyOptionsItem] = useState<MsgItem | null>(null);
  const [editModalItem, setEditModalItem] = useState<MsgItem | null>(null);
  const [editInput, setEditInput] = useState('');
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  // Mesaj kimliği -> tepki. Mesajlardan ayrı tutuluyor; ayrı sorgu ve realtime ile besleniyor.
  const [reactions, setReactions] = useState<ReactionMap>({});
  // Tepki seçicinin açık olduğu mesaj (yalnızca karşı tarafın mesajları).
  const [reactionTarget, setReactionTarget] = useState<MsgItem | null>(null);
  const listRef = useRef<FlatList<MsgItem>>(null);
  const messagesRef = useRef<MsgItem[]>([]);
  const pendingInitialScroll = useRef(true);
  const revealX = useSharedValue(0); // sağdan sola çekince timestamp görünür

  const normParam = useCallback((p: any): string | undefined => {
    const v = Array.isArray(p) ? p[0] : p;
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (!s || s === 'undefined' || s === 'null') return undefined;
    return s;
  }, []);

  const { refresh: refreshNotifications, clearMessageBadge } = useNotification();
  const activeMatchId = normParam(matchId);
  /**
   * Bu sohbetteki kişiyi BEN engelledim mi?
   *
   * Engelleme tek yönlü bir filtre: engellediğim kişinin mesajları hem bu
   * ekranda (aşağıdaki sender_id elemesi) hem de mesajlar listesinde
   * gizleniyor. Mesaj yazabilmek sessiz bir çıkmaz üretiyordu — mesaj gidiyor,
   * gelen cevap hiç görünmüyordu. Engelliyse yazma alanı yerine açıklama ve
   * engeli kaldırma yolu gösteriliyor.
   */
  const recipientIdParam = normParam(to);
  const isRecipientBlocked = !!recipientIdParam && blockedIds.has(recipientIdParam);
  const threadKey = `${normParam(to) ?? ''}|${activeMatchId ?? ''}`;

  const isSameThread = useCallback(
    (message: MsgItem, currentUserId: string, recipientId: string) => {
      const participants =
        (message.sender_id === currentUserId && message.recipient_id === recipientId) ||
        (message.sender_id === recipientId && message.recipient_id === currentUserId);
      if (!participants) return false;
      return activeMatchId ? message.match_id === activeMatchId : !message.match_id;
    },
    [activeMatchId]
  );

  // Liste `inverted` olduğu için "en alt" = offset 0. scrollToEnd'in içerik ölçümüyle
  // yarışması (yeni mesajın klavye altında kalması) böylece tamamen ortadan kalkıyor.
  const scrollToBottom = useCallback((animated = false) => {
    const run = () => {
      try {
        listRef.current?.scrollToOffset({ offset: 0, animated });
      } catch (_) {}
    };
    run();
    requestAnimationFrame(run);
  }, []);

  useEffect(() => {
    pendingInitialScroll.current = true;
    setMessages([]);
  }, [threadKey]);

  useFocusEffect(
    useCallback(() => {
      pendingInitialScroll.current = true;
      if (messagesRef.current.length > 0) {
        scrollToBottom(false);
      }
    }, [scrollToBottom])
  );

  useEffect(() => {
    if (!pendingInitialScroll.current || messages.length === 0) return;
    scrollToBottom(false);
    pendingInitialScroll.current = false;
  }, [messages, threadKey, scrollToBottom]);

  // messages state'i her değiştiğinde ref'i güncelle (fetchMessages'ın yeniden tetiklenmesini önler)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Klavye açıldığında son mesaj klavyenin altında kalmasın diye listeyi en alta kaydır
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(showEvent, () => scrollToBottom(true));
    return () => sub.remove();
  }, [scrollToBottom]);

  // Resolve recipient id safely (avoid sending message to self)
  const resolveRecipientId = useCallback(async (currentUserId: string): Promise<string | null> => {
    const toId = normParam(to);

    if (toId && toId !== currentUserId) {
      return toId;
    }

    // Fallback: messages ref üzerinden oku — state bağımlılığı olmadan
    const current = messagesRef.current;
    if (current.length > 0) {
      const last = current[current.length - 1];
      const otherId = last.sender_id !== currentUserId ? last.sender_id : (last.recipient_id !== currentUserId ? last.recipient_id : undefined);
      if (otherId && otherId !== currentUserId) return otherId;
    }

    return null;
  }, [to]); // messages bağımlılığı kaldırıldı → fetchMessages artık yeniden tetiklenmez

  const loadMe = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id ?? null);
    if (user) {
      const ids = await getBlockedUserIds(user.id);
      setBlockedIds(ids);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const recip = await resolveRecipientId(user.id);
    if (!recip) {
      console.warn('[Chat] recipient not resolved');
      return;
    }

    // Sohbet daha önce silindiyse, silme anından ÖNCEKİ mesajlar hiç
    // yüklenmez: kullanıcı sohbeti temizleyip yeniden yazışmaya başladığında
    // eski yazışmayı görmemeli. Silme yereldir; karşı taraf geçmişini görür.
    // Bu kişiyi engellediysem sohbetin HİÇBİR mesajı gösterilmez — kendi
    // gönderdiklerim de. Eskiden yalnızca karşı tarafın mesajları eleniyordu
    // ve ekranda tek taraflı, anlamsız bir yazışma kalıyordu.
    const blocked = await getBlockedUserIds(user.id);
    setBlockedIds(blocked);
    if (blocked.has(recip)) {
      setMessages([]);
      return;
    }

    const hiddenAt = await getChatHiddenAt(user.id, recip, activeMatchId);

    let query = supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at, edited_at, match_id')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recip}),and(sender_id.eq.${recip},recipient_id.eq.${user.id})`);

    query = activeMatchId ? query.eq('match_id', activeMatchId) : query.is('match_id', null);
    if (hiddenAt) query = query.gt('created_at', hiddenAt);

    const { data, error } = await query.order('created_at', { ascending: true });

    if (!error) {
      // Sorgu yalnızca bu iki kişinin mesajlarını getiriyor ve karşı tarafın
      // engelli olmadığı yukarıda doğrulandı; ayrıca göndereni elemeye gerek yok.
      const rows = (data as MsgItem[]) || [];
      setMessages(rows);
      // Tepkiler AYRI sorguyla geliyor: mesaj sorgusuna gömülseydi, migration
      // uygulanmadan yayınlanan bir sürümde sorgu hata verip sohbet boş kalırdı.
      fetchReactions(rows.map((m) => m.id)).then(setReactions);
      pendingInitialScroll.current = true;
      scrollToBottom(false);
    }
  }, [activeMatchId, resolveRecipientId, scrollToBottom]);

  // İlk açılışta mevcut mesajları yükle
  useEffect(() => {
    loadMe();
    fetchMessages();
  }, [loadMe, fetchMessages]);

  // Chat açılınca ilgili direct_message bildirimlerini okundu yap ve badge sayısını sıfırla
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      const recip = await resolveRecipientId(user.id);
      if (!mounted || !recip) return;
      let q = supabase.from('notifications')
        .update({ is_read: true })
        .eq('type', 'direct_message')
        .eq('user_id', user.id)
        .eq('sender_id', recip)
        .eq('is_read', false);

      q = activeMatchId ? q.eq('match_id', activeMatchId) : q.is('match_id', null);

      await q;
      try { 
        // Bildirim context'inde direct_message unread sayısını yeniden hesapla
        await (refreshNotifications?.() as any);
        // Ve mesaj ikonundaki badge'i anında temizle
        clearMessageBadge?.();
      } catch {}
    })();
    return () => { mounted = false; };
  }, [activeMatchId, clearMessageBadge, refreshNotifications, resolveRecipientId]);

  // Realtime subscription: sadece ilgili sohbet (iki kullanıcı + match) insert'lerini dinle
  useEffect(() => {
    let mounted = true;
    let channel: any = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      const recip = await resolveRecipientId(user.id);
      if (!mounted || !recip) return;
      channel = supabase
        .channel(`msg-${user.id}-${recip}-${activeMatchId ?? 'dm'}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload: any) => {
          const m = payload.new as MsgItem;
          const blocked = await getBlockedUserIds(user.id);
          const isBlocked = blocked.has(m.sender_id);

          // Kendi mesajlarımızı atla — optimistic update ile zaten ekledik
          if (m.sender_id === user.id) return;

          if (isSameThread(m, user.id, recip) && !isBlocked) {
            setMessages(prev => {
              // Aynı ID zaten varsa tekrar ekleme
              if (prev.some(existing => existing.id === m.id)) return prev;
              return [...prev, m];
            });
            scrollToBottom(true);
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, async (payload: any) => {
          const m = payload.new as MsgItem;
          const blocked = await getBlockedUserIds(user.id);
          const isBlocked = blocked.has(m.sender_id);
          if (isSameThread(m, user.id, recip) && !isBlocked) {
            setMessages(prev =>
              prev.map(existing => existing.id === m.id ? { ...existing, ...m } : existing)
            );
          }
        })
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeMatchId, isSameThread, resolveRecipientId, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isSending) return;

    // Engellediğim kişiye mesaj gitmesin. Arayüz zaten yazma alanını
    // gizliyor; bu, başka bir yoldan buraya düşülürse diye son savunma.
    if (isRecipientBlocked) {
      Alert.alert(t('blocked.guardTitle'), t('blocked.guardMessage'), [
        { text: t('general.cancel'), style: 'cancel' },
        { text: t('blocked.goToList'), onPress: () => router.push('/blocked-users' as any) },
      ]);
      return;
    }

    // Yasaklı kelime kontrolü
    if (containsBannedWord(input)) {
      Alert.alert(t('chat.profanityTitle'), t('chat.profanityWarning'));
      return;
    }

    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const content = input.trim();
    setInput('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsSending(false); return; }

      const recip = await resolveRecipientId(user.id);
      if (!recip) {
        console.warn('[Chat] sendMessage: recipient could not be resolved');
        setIsSending(false);
        return;
      }

      // Optimistic: mesajı anında ekrana düşür
      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: MsgItem = {
        id: tempId,
        sender_id: user.id,
        recipient_id: recip,
        content,
        created_at: new Date().toISOString(),
        edited_at: null,
        match_id: activeMatchId ?? null,
      };
      setMessages(prev => [...prev, optimisticMsg]);
      scrollToBottom(true);

      const getParam2 = (p: any): string | undefined => {
        const v = Array.isArray(p) ? p[0] : p;
        return typeof v === 'string' && v && v !== 'undefined' && v !== 'null' ? v : undefined;
      };
      const matchIdStr = getParam2(matchId);

      const payload: any = { sender_id: user.id, recipient_id: recip, content };
      if (matchIdStr) payload.match_id = matchIdStr;

      const { data: inserted, error } = await supabase.from('messages').insert(payload).select('id').single();
      if (error) {
        // Hata durumunda optimistic mesajı geri al
        setMessages(prev => prev.filter(m => m.id !== tempId));
        console.error('[Chat] sendMessage insert error:', error);
        setIsSending(false);
        return;
      }

      // Geçici ID'yi gerçek DB ID'siyle değiştir
      if (inserted?.id) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: inserted.id } : m));
      }

      // Alıcı için direct_message bildirimi oluştur
      try {
        const notifPayload: any = {
          user_id: recip,
          sender_id: user.id,
          type: 'direct_message',
          message: content,
          is_read: false,
        };
        if (matchIdStr) notifPayload.match_id = matchIdStr;
        await createNotification(notifPayload);
      } catch (e) {
        console.error('[Chat] direct_message notification unexpected error:', e);
      }
    } catch (e) {
      console.error('[Chat] sendMessage unexpected error:', e);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, matchId, activeMatchId, resolveRecipientId, scrollToBottom, t, isRecipientBlocked, router]);

  const openReportUserModal = useCallback(() => {
    setHeaderMenuVisible(false);
    const recip = normParam(to);
    if (!recip) return;
    setReportItem({
      id: 'profile-report',
      sender_id: recip,
      recipient_id: me || '',
      content: '',
      created_at: '',
    });
    setReportNotes('');
    setReportModalVisible(true);
  }, [to, me]);

  const openReportModal = useCallback((item: MsgItem) => {
    setReportItem(item);
    setReportNotes('');
    setReportModalVisible(true);
  }, []);

  const closeReportModal = useCallback(() => {
    setReportModalVisible(false);
    setReportItem(null);
    setReportNotes('');
  }, []);

  const handleReportSubmit = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !reportItem) return;

    const isProfileReport = reportItem.id === 'profile-report';
    const contentType = isProfileReport ? 'profile' : 'message';
    const contentId = isProfileReport ? reportItem.sender_id : reportItem.id;

    const alreadyReported = await hasUserReportedContent(user.id, contentType, contentId);
    if (alreadyReported) {
      closeReportModal();
      Alert.alert('', t('chat.reportAlreadySubmitted'));
      return;
    }

    const { error } = await reportContent({
      reporterId: user.id,
      reportedUserId: reportItem.sender_id,
      contentType,
      contentId: isProfileReport ? reportItem.sender_id : reportItem.id,
      contentPreview: isProfileReport ? null : (reportItem.content?.slice(0, 200) || null),
      reason: reportNotes.trim() || null,
    });
    closeReportModal();
    if (!error) {
      Alert.alert('', t('chat.reportSent'));
    }
  }, [reportItem, reportNotes, closeReportModal, t]);

  /**
   * Başlıktaki engelle butonu artık bir ANAHTAR: engelliysen engeli kaldırır,
   * değilsen engeller. İkisi de onay ister.
   *
   * Engelledikten sonra ekrandan çıkılmıyor; sohbet açık kalıp engel durumunu
   * gösteriyor ki kullanıcı aynı yerden geri alabilsin.
   */
  const handleToggleBlock = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const recip = normParam(to);
    if (!recip) return;

    if (blockedIds.has(recip)) {
      Alert.alert(
        t('blocked.removeTitle'),
        t('blocked.removeConfirm').replace('{name}', String(name || t('blocked.unknownUser'))),
        [
          { text: t('general.cancel'), style: 'cancel' },
          {
            text: t('blocked.remove'),
            onPress: async () => {
              const { error } = await unblockUser(user.id, recip);
              if (error) {
                Alert.alert(t('general.error'), t('blocked.removeFailed'));
                return;
              }
              // Engel kalkınca önceki geçmiş GERİ GELMEZ: bu kişiyle olan
              // bütün sohbetler bu ana kadar gizlenir, sonraki mesajlar normal
              // gelir. Damga fetchMessages'tan ÖNCE yazılmalı.
              await hideAllChatsWithUser(user.id, recip);
              setBlockedIds((prev) => {
                const next = new Set(prev);
                next.delete(recip);
                return next;
              });
              await fetchMessages();
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      t('chat.blockUser'),
      t('chat.blockConfirm'),
      [
        { text: t('general.cancel'), style: 'cancel' },
        {
          text: t('chat.blockUser'),
          style: 'destructive',
          onPress: async () => {
            const { error } = await blockUser(user.id, recip);
            if (!error) {
              setBlockedIds((prev) => new Set([...prev, recip]));
              // Engellenince ekranda hiçbir mesaj kalmaz (kendi mesajlarım da).
              setMessages([]);
              Alert.alert('', t('chat.blocked'));
            }
          },
        },
      ]
    );
  }, [to, t, name, blockedIds, fetchMessages]);

  const handleDeleteMessage = useCallback(async () => {
    if (!myOptionsItem) return;
    const id = myOptionsItem.id;
    setMyOptionsItem(null);
    Alert.alert(
      t('chat.deleteMessage'),
      t('chat.deleteMessageConfirm'),
      [
        { text: t('general.cancel'), style: 'cancel' },
        {
          text: t('chat.deleteMessage'),
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('messages').delete().eq('id', id);
            if (!error) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === id ? { ...m, content: t('chat.messageDeleted') } : m
                )
              );
              setDeletedIds(prev => new Set([...prev, id]));
            } else {
              Alert.alert(t('general.error'), error.message);
            }
          },
        },
      ]
    );
  }, [myOptionsItem, t]);

  const handleEditMessage = useCallback(async () => {
    if (!editModalItem || !editInput.trim()) return;
    if (!canEditMessage(editModalItem)) {
      Alert.alert(t('general.error'), t('chat.editTimeLimitExceeded'));
      setEditModalItem(null);
      setEditInput('');
      return;
    }
    const newContent = editInput.trim();
    if (containsBannedWord(newContent)) {
      Alert.alert(t('chat.profanityTitle'), t('chat.profanityWarning'));
      return;
    }
    const { error } = await supabase
      .from('messages')
      .update({ content: newContent, edited_at: new Date().toISOString() })
      .eq('id', editModalItem.id);
    if (!error) {
      const editedAt = new Date().toISOString();
      setMessages(prev =>
        prev.map(m => m.id === editModalItem.id ? { ...m, content: newContent, edited_at: editedAt } : m)
      );
      setEditModalItem(null);
      setEditInput('');
    } else {
      Alert.alert(t('general.error'), error.message);
    }
  }, [editModalItem, editInput, t]);

  // Realtime: karşı taraf mesajıma tepki bıraktığında/değiştirdiğinde/kaldırdığında
  // sohbet açıkken anında yansısın. Tablo sohbete göre süzülemiyor; olay bu
  // sohbetteki bir mesaja ait değilse yok sayılıyor. DELETE olayında yalnızca
  // birincil anahtar (message_id, user_id) geliyor, bu yüzden eski kayıttan okunuyor.
  useEffect(() => {
    let mounted = true;
    let channel: any = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      const recip = await resolveRecipientId(user.id);
      if (!mounted || !recip) return;
      channel = supabase
        .channel(`reactions-${user.id}-${recip}-${activeMatchId ?? 'dm'}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload: any) => {
          const isDelete = payload.eventType === 'DELETE';
          const row = (isDelete ? payload.old : payload.new) as { message_id?: string; emoji?: string } | undefined;
          const messageId = row?.message_id;
          if (!messageId) return;
          if (!messagesRef.current.some((m) => m.id === messageId)) return;
          setReactions((prev) => {
            const next = { ...prev };
            if (isDelete) delete next[messageId];
            else if (row?.emoji) next[messageId] = row.emoji;
            return next;
          });
        })
        .subscribe();
    })();
    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeMatchId, resolveRecipientId]);

  /**
   * Tepki ekler, değiştirir ya da kaldırır (`emoji` null ise ya da mevcut
   * tepkiyle aynıysa kaldırır). Arayüz hemen güncellenir; kayıt başarısız olursa
   * eski hâline döner.
   */
  const applyReaction = useCallback(async (item: MsgItem, emoji: string | null) => {
    if (!me) return;

    const previous = reactions[item.id] ?? null;
    const next = emoji === null || previous === emoji ? null : emoji;
    if (next === previous) return;

    const restore = (value: string | null) =>
      setReactions((prev) => {
        const copy = { ...prev };
        if (value) copy[item.id] = value;
        else delete copy[item.id];
        return copy;
      });

    restore(next);
    Haptics.selectionAsync().catch(() => {});

    const { error } = next
      ? await setMessageReaction(item.id, me, next)
      : await removeMessageReaction(item.id, me);

    if (error) {
      console.error('[Reactions] save error:', error.message);
      restore(previous);
      Alert.alert(t('general.error'), t('chat.reactionFailed'));
    }
  }, [me, reactions, t]);

  // ---- Tepki seçici ----------------------------------------------------------
  //
  // Seçici sohbet ekranının İÇİNDE bir katman (RN Modal değil). Uçan emoji ise
  // kök katmanda, bütün ekranların üstünde çiziliyor (bkz.
  // components/FlyingEmojiLayer.tsx). Konumlar yalnızca dokunma
  // koordinatlarından geliyor; ref ya da ölçüm yok.
  const flyEmoji = useFlyingEmoji();
  // Rozetin merkezi (sayfa koordinatı): emojinin ineceği yer.
  const badgeCenterRef = useRef<Point | null>(null);
  // Seçici kapanırken ikinci bir seçim yeni bir uçuş başlatmasın.
  const pickerClosingRef = useRef(false);
  // Uçuş sürerken hedef rozetteki emoji gizli; inince rozet zıplıyor.
  const [reactionAnim, setReactionAnim] = useState<{ id: string; phase: 'flying' | 'landed' } | null>(null);
  const sheetProgress = useSharedValue(0);

  // Zamanlayıcılar ekrandan çıkılınca temizlensin; yoksa unmount sonrası state yazılır.
  const reactionTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { reactionTimersRef.current.forEach(clearTimeout); }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    reactionTimersRef.current.push(setTimeout(fn, ms));
  }, []);

  const openReactionPicker = useCallback((item: MsgItem, badgeCenter: Point) => {
    Keyboard.dismiss();
    badgeCenterRef.current = badgeCenter;
    pickerClosingRef.current = false;
    setReactionTarget(item);
    sheetProgress.value = 0;
    sheetProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [sheetProgress]);

  const closeReactionPicker = useCallback(() => {
    pickerClosingRef.current = true;
    sheetProgress.value = withTiming(0, { duration: REACTION_SHEET_MS });
    later(() => setReactionTarget(null), REACTION_SHEET_MS);
  }, [sheetProgress, later]);

  // Android geri tuşu seçiciyi kapatsın (Modal'daki onRequestClose'un karşılığı).
  useEffect(() => {
    if (!reactionTarget) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeReactionPicker();
      return true;
    });
    return () => sub.remove();
  }, [reactionTarget, closeReactionPicker]);

  const selectReaction = useCallback((emoji: string, pageX: number, pageY: number) => {
    const item = reactionTarget;
    if (!item || pickerClosingRef.current) return;
    closeReactionPicker();

    // Aynı emojiye tekrar basmak tepkiyi kaldırır: uçuş yok.
    if (reactions[item.id] === emoji) {
      applyReaction(item, null);
      return;
    }

    // Kayıt hemen gidiyor; animasyon yalnızca görsel.
    applyReaction(item, emoji);

    const to = badgeCenterRef.current;
    if (!to || !Number.isFinite(pageX) || !Number.isFinite(pageY)) return;

    setReactionAnim({ id: item.id, phase: 'flying' });
    flyEmoji({
      emoji,
      from: { x: pageX, y: pageY },
      to,
      onLanded: () => {
        setReactionAnim({ id: item.id, phase: 'landed' });
        later(() => setReactionAnim((cur) => (cur && cur.id === item.id ? null : cur)), REACTION_POP_MS);
      },
    });
  }, [reactionTarget, reactions, applyReaction, closeReactionPicker, flyEmoji, later]);

  const reactionBackdropStyle = useAnimatedStyle(() => ({ opacity: sheetProgress.value }));
  const reactionSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheetProgress.value) * 360 }],
  }));

  // `inverted` liste en yeni mesajı başa alır; kaynak dizi kronolojik kaldığı için burada çeviriyoruz.
  const invertedMessages = useMemo(() => [...messages].reverse(), [messages]);
  // Tepkiler ve animasyon durumu mesajlardan ayrı state'te; değişince satırlar yeniden çizilsin.
  const listExtraData = useMemo(() => ({ reactions, reactionAnim }), [reactions, reactionAnim]);

  const renderItem = ({ item }: { item: MsgItem }) => {
    const mine = item.sender_id === me;
    const isDeleted = deletedIds.has(item.id);
    const edited = isMessageEdited(item);
    return (
      <MessageRow
        item={item}
        mine={mine}
        revealX={revealX}
        isDeleted={isDeleted}
        isEdited={edited}
        editedLabel={t('chat.messageEdited')}
        colors={colors}
        reaction={reactions[item.id] ?? null}
        reactionHidden={reactionAnim?.id === item.id && reactionAnim.phase === 'flying'}
        reactionPop={reactionAnim?.id === item.id && reactionAnim.phase === 'landed'}
        onOpenReactions={openReactionPicker}
        addReactionLabel={t('chat.addReaction')}
        onReport={(it) => {
          Alert.alert(
            t('chat.reportMessage'),
            it.content?.slice(0, 80) + (it.content && it.content.length > 80 ? '...' : ''),
            [
              { text: t('general.cancel'), style: 'cancel' },
              { text: t('chat.reportMessage'), onPress: () => openReportModal(it) },
            ]
          );
        }}
        onOpenOptions={(it) => setMessageOptionsItem(it)}
        onOpenMyOptions={(it) => setMyOptionsItem(it)}
      />
    );
  };

  const keyboardOffset = Platform.OS === 'ios' ? 80 : 50;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardOffset}
    >
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitleAlign: 'center',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={24} color={colors.primaryDark} />
              </TouchableOpacity>
            ),
            headerStyle: ({ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.primary } as any),
            headerShadowVisible: false,
            headerTitle: () => (
              <Text
                style={{ fontWeight: '800', color: colors.primaryDark, maxWidth: 240 }}
                numberOfLines={1}
              >
                {String(name || 'Sohbet')}
              </Text>
            ),
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  onPress={handleToggleBlock}
                  style={{
                    padding: 6,
                    borderRadius: 999,
                    // Engelliyken dolu ikon + kırmızı zemin: soluk bir çerçeve
                    // ikon durumu anlatmıyordu.
                    backgroundColor: isRecipientBlocked ? colors.danger : 'transparent',
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={isRecipientBlocked ? t('blocked.removeTitle') : t('chat.blockUser')}
                >
                  <Ionicons
                    name={isRecipientBlocked ? 'ban' : 'ban-outline'}
                    size={22}
                    color={isRecipientBlocked ? '#ffffff' : colors.danger}
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/notifications')} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="notifications-outline" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ),
          }}
        />
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <GestureDetector
            gesture={Gesture.Pan()
              .activeOffsetX([-18, 18])
              .failOffsetY([-10, 10])
              .onUpdate((e) => {
                if (e.translationX < 0) {
                  revealX.value = clamp(-e.translationX, 0, 120);
                } else {
                  revealX.value = 0;
                }
              })
              .onEnd(() => {
                revealX.value = withTiming(0, { duration: 180 });
              })
              .onFinalize(() => {
                revealX.value = withTiming(0, { duration: 180 });
              })}
          >
            <View style={{ flex: 1 }}>
              <FlatList
                ref={listRef}
                inverted
                data={invertedMessages}
                keyExtractor={(m) => m.id}
                renderItem={renderItem}
                extraData={listExtraData}
                contentContainerStyle={{ paddingVertical: 8 }}
              />
            </View>
          </GestureDetector>
          {/* Mesaj balonu 3 nokta → Sohbet Seçenekleri modalı */}
          <Modal visible={!!messageOptionsItem} transparent animationType="fade">
            <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 }} onPress={() => setMessageOptionsItem(null)}>
              <Pressable style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }} onPress={(e) => e.stopPropagation()}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primaryDark, marginBottom: 16, textAlign: 'center' }}>{t('messages.chatOptions')}</Text>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { if (messageOptionsItem) { setMessageOptionsItem(null); openReportModal(messageOptionsItem); } }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fff7ed', borderRadius: 10 }}
                  >
                    <Text style={{ color: '#ea580c', fontWeight: '600', fontSize: 15 }}>{t('chat.reportMessage')}</Text>
                    <Ionicons name="flag-outline" size={22} color="#ea580c" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { setMessageOptionsItem(null); handleToggleBlock(); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fef2f2', borderRadius: 10 }}
                  >
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>
                      {isRecipientBlocked ? t('blocked.removeTitle') : t('chat.blockUser')}
                    </Text>
                    <Ionicons name={isRecipientBlocked ? 'ban' : 'ban-outline'} size={22} color="#dc2626" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setMessageOptionsItem(null)} style={{ marginTop: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: '#6b7280', alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>{t('general.cancel')}</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Kendi mesajım: sil / düzenle seçenekleri */}
          <Modal visible={!!myOptionsItem} transparent animationType="fade">
            <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 }} onPress={() => setMyOptionsItem(null)}>
              <Pressable style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }} onPress={(e) => e.stopPropagation()}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primaryDark, marginBottom: 16, textAlign: 'center' }}>{t('chat.myMessageOptions')}</Text>
                <View style={{ gap: 6 }}>
                  {myOptionsItem && canEditMessage(myOptionsItem) ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        const item = myOptionsItem;
                        setMyOptionsItem(null);
                        if (item) {
                          setEditInput(item.content);
                          setEditModalItem(item);
                        }
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#f0fdf4', borderRadius: 10 }}
                    >
                      <Text style={{ color: '#16a34a', fontWeight: '600', fontSize: 15 }}>{t('chat.editMessage')}</Text>
                      <Ionicons name="pencil-outline" size={22} color="#16a34a" />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleDeleteMessage}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fef2f2', borderRadius: 10 }}
                  >
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>{t('chat.deleteMessage')}</Text>
                    <Ionicons name="trash-outline" size={22} color="#dc2626" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setMyOptionsItem(null)} style={{ marginTop: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: '#6b7280', alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>{t('general.cancel')}</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Mesaj düzenleme modalı */}
          <Modal visible={!!editModalItem} transparent animationType="none" onRequestClose={() => { setEditModalItem(null); setEditInput(''); }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={0}>
            <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={() => { setEditModalItem(null); setEditInput(''); }}>
              <Pressable
                style={{ backgroundColor: colors.surface, borderRadius: 20, margin: 16, padding: 20, paddingBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 }}
                onPress={(e) => e.stopPropagation()}
              >
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primaryDark, marginBottom: 16, textAlign: 'center' }}>{t('chat.editMessageTitle')}</Text>
                <TextInput
                  value={editInput}
                  onChangeText={setEditInput}
                  multiline
                  autoFocus
                  style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minHeight: 80, textAlignVertical: 'top', fontSize: 15, color: colors.text, marginBottom: 16 }}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => { setEditModalItem(null); setEditInput(''); }}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{t('general.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleEditMessage}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#16a34a', alignItems: 'center' }}
                  >
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>{t('chat.editMessageSave')}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
            </KeyboardAvoidingView>
          </Modal>

          {/* Header ... menüsü (Report / Block) - stille güncellendi */}
          <Modal visible={headerMenuVisible} transparent animationType="fade">
            <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 }} onPress={() => setHeaderMenuVisible(false)}>
              <Pressable style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }} onPress={(e) => e.stopPropagation()}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primaryDark, marginBottom: 16, textAlign: 'center' }}>{t('messages.chatOptions')}</Text>
                <View style={{ gap: 6 }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { setHeaderMenuVisible(false); openReportUserModal(); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fff7ed', borderRadius: 10 }}
                  >
                    <Text style={{ color: '#ea580c', fontWeight: '600', fontSize: 15 }}>{t('messages.reportUser')}</Text>
                    <Ionicons name="flag-outline" size={22} color="#ea580c" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { setHeaderMenuVisible(false); handleToggleBlock(); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fef2f2', borderRadius: 10 }}
                  >
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>
                      {isRecipientBlocked ? t('blocked.removeTitle') : t('chat.blockUser')}
                    </Text>
                    <Ionicons name={isRecipientBlocked ? 'ban' : 'ban-outline'} size={22} color="#dc2626" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setHeaderMenuVisible(false)} style={{ marginTop: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: '#6b7280', alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>{t('general.cancel')}</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal
            visible={reportModalVisible}
            transparent
            animationType="fade"
            onRequestClose={closeReportModal}
          >
            <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 }} onPress={closeReportModal}>
              <Pressable style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20 }} onPress={(e) => e.stopPropagation()}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: colors.text }}>{reportItem?.id === 'profile-report' ? t('chat.reportUser') : t('chat.reportMessage')}</Text>
                {reportItem && reportItem.id !== 'profile-report' && (
                  <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 12 }} numberOfLines={3}>
                    "{reportItem.content?.slice(0, 100)}{reportItem.content && reportItem.content.length > 100 ? '...' : ''}"
                  </Text>
                )}
                <TextInput
                  placeholder={t('chat.reportAdditionalNotes')}
                  value={reportNotes}
                  onChangeText={setReportNotes}
                  multiline
                  numberOfLines={3}
                  style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16, minHeight: 80, textAlignVertical: 'top' }}
                />
                <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
                  <TouchableOpacity onPress={closeReportModal} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{t('general.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleReportSubmit} style={{ backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: 'white', fontWeight: '600' }}>{t('chat.reportSubmit')}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <View style={{ borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
            {isRecipientBlocked ? (
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(40, insets.bottom) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <Ionicons name="ban-outline" size={18} color={colors.danger} />
                  <Text style={{ flex: 1, marginLeft: 8, fontSize: 13, color: colors.textSecondary }}>
                    {t('blocked.chatNotice')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/blocked-users' as any)}
                  activeOpacity={0.8}
                  style={{ backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>{t('blocked.goToList')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
              <Text style={{ fontSize: 11, color: colors.danger, fontWeight: '600', paddingHorizontal: 12, paddingTop: 4 }}>{t('chat.contentFilteredNote')}</Text>
              <View
                style={{
                  flexDirection: 'row',
                  paddingTop: 6,
                  paddingHorizontal: 8,
                  paddingBottom: Math.max(40, insets.bottom),
                }}
              >
                <TextInput
                  placeholder="Mesaj yaz"
                  value={input}
                  onChangeText={setInput}
                  onFocus={() => scrollToBottom(true)}
                  placeholderTextColor={colors.textMuted}
                  style={{ flex: 1, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}
                />
                <TouchableOpacity
                  onPress={sendMessage}
                  disabled={isSending}
                  style={{ backgroundColor: isSending ? '#86efac' : '#16a34a', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' }}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>Gönder</Text>
                </TouchableOpacity>
              </View>
              </>
            )}
          </View>

          {/* Tepki seçici: ekran içi katman, en üstte (bkz. openReactionPicker).
              Uçan emoji burada değil, kök katmanda çiziliyor. */}
          {!!reactionTarget && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, elevation: 50 }}>
              <Animated.View
                style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }, reactionBackdropStyle]}
              >
                <Pressable style={{ flex: 1 }} onPress={closeReactionPicker} />
              </Animated.View>

              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.surface,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    paddingTop: 16,
                    paddingHorizontal: 16,
                    paddingBottom: Math.max(24, insets.bottom + 12),
                  },
                  reactionSheetStyle,
                ]}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.primaryDark, textAlign: 'center', marginBottom: 8 }}>
                  {t('chat.reactionTitle')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {REACTION_EMOJIS.map((emoji) => {
                    const selected = reactions[reactionTarget.id] === emoji;
                    return (
                      <TouchableOpacity
                        key={emoji}
                        onPress={(e) => selectReaction(emoji, e.nativeEvent.pageX, e.nativeEvent.pageY)}
                        style={{ width: '16.66%', alignItems: 'center', paddingVertical: 6 }}
                        accessibilityLabel={emoji}
                      >
                        <View
                          style={{
                            width: 46,
                            height: 46,
                            borderRadius: 23,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: selected ? 'rgba(22,163,74,0.18)' : 'transparent',
                            borderWidth: selected ? 1.5 : 0,
                            borderColor: '#16a34a',
                          }}
                        >
                          <Text style={{ fontSize: 26 }}>{emoji}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {!!reactions[reactionTarget.id] && (
                  <TouchableOpacity
                    onPress={() => {
                      const it = reactionTarget;
                      closeReactionPicker();
                      applyReaction(it, null);
                    }}
                    activeOpacity={0.8}
                    style={{ marginTop: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.danger, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.danger, fontWeight: '700' }}>{t('chat.reactionRemove')}</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            </View>
          )}
        </View>
      </>
    </KeyboardAvoidingView>
  );
}


