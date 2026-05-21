import { memo, useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, InteractionManager, Alert, Pressable, Modal } from 'react-native';
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
import { getBlockedUserIds, blockUser } from '@/services/blocks';
import { reportContent, hasUserReportedContent } from '@/services/contentReports';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

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
}) {
  const ts = formatDateTimeTr(item.created_at);
  const MAX_REVEAL = 120;

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
    <View style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
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

  const scrollToBottom = useCallback((animated = false) => {
    const run = () => {
      try {
        listRef.current?.scrollToEnd({ animated });
      } catch (_) {}
    };
    run();
    requestAnimationFrame(run);
    requestAnimationFrame(() => requestAnimationFrame(run));
    InteractionManager.runAfterInteractions(run);
    setTimeout(run, 50);
    setTimeout(run, 200);
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

    let query = supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at, edited_at, match_id')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recip}),and(sender_id.eq.${recip},recipient_id.eq.${user.id})`);

    query = activeMatchId ? query.eq('match_id', activeMatchId) : query.is('match_id', null);

    const { data, error } = await query.order('created_at', { ascending: true });

    if (!error) {
      const rows = (data as MsgItem[]) || [];
      const blocked = await getBlockedUserIds(user.id);
      const filtered = blocked.size > 0 ? rows.filter((m) => !blocked.has(m.sender_id)) : rows;
      setMessages(filtered);
      setBlockedIds(blocked);
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

    // Yasaklı kelime kontrolü
    if (containsBannedWord(input)) {
      Alert.alert(t('chat.profanityTitle'), t('chat.profanityWarning'));
      return;
    }

    setIsSending(true);

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
  }, [input, isSending, matchId, activeMatchId, resolveRecipientId, scrollToBottom, t]);

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

  const handleBlockUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const recip = normParam(to);
    if (!recip) return;
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
              setMessages((prev) => prev.filter((m) => m.sender_id !== recip));
              Alert.alert('', t('chat.blocked'));
              router.back();
            }
          },
        },
      ]
    );
  }, [to, t, router]);

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
                <TouchableOpacity onPress={handleBlockUser} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="ban-outline" size={22} color={colors.danger} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/notifications')} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="heart-outline" size={22} color={colors.primary} />
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
                data={messages}
                keyExtractor={(m) => m.id}
                renderItem={renderItem}
                contentContainerStyle={{ paddingVertical: 8, paddingBottom: Math.max(60, insets.bottom + 8) }}
                onContentSizeChange={() => {
                  if (pendingInitialScroll.current && messages.length > 0) {
                    scrollToBottom(false);
                    pendingInitialScroll.current = false;
                  }
                }}
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
                    onPress={() => { setMessageOptionsItem(null); handleBlockUser(); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fef2f2', borderRadius: 10 }}
                  >
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>{t('chat.blockUser')}</Text>
                    <Ionicons name="ban-outline" size={22} color="#dc2626" />
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
                    onPress={() => { setHeaderMenuVisible(false); handleBlockUser(); }}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fef2f2', borderRadius: 10 }}
                  >
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>{t('chat.blockUser')}</Text>
                    <Ionicons name="ban-outline" size={22} color="#dc2626" />
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
          </View>
        </View>
      </>
    </KeyboardAvoidingView>
  );
}


