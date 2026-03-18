import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, InteractionManager, Alert, Pressable, Modal } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image, TouchableOpacity as RNTouchableOpacity } from 'react-native';
import { useNotification } from '@/components/NotificationContext';
import { containsBannedWord } from '@/constants/bannedWords';
import { getBlockedUserIds, blockUser } from '@/services/blocks';
import { reportContent, hasUserReportedContent } from '@/services/contentReports';

interface MsgItem {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  match_id?: string | null;
}

export default function ChatScreen() {
  const { to, matchId, name } = useLocalSearchParams<{ to: string; matchId?: string; name?: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<MsgItem[]>([]);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportItem, setReportItem] = useState<MsgItem | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const listRef = useRef<FlatList<MsgItem>>(null);

  const normParam = useCallback((p: any): string | undefined => {
    const v = Array.isArray(p) ? p[0] : p;
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (!s || s === 'undefined' || s === 'null') return undefined;
    return s;
  }, []);

  const { refresh: refreshNotifications, clearMessageBadge } = useNotification();

  // Resolve recipient id safely (avoid sending message to self)
  const resolveRecipientId = useCallback(async (currentUserId: string): Promise<string | null> => {
    const toId = normParam(to);
    
    // En basit ve doğru çözüm: route ile gelen to parametresini kullan
    // Messages sayfasından gelen to parametresi zaten doğru recipient ID'sini içeriyor
    if (toId && toId !== currentUserId) {
      return toId;
    }

    // Fallback: Eğer geçmiş mesajlar varsa karşı tarafı son mesajdan çıkar
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      const otherId = last.sender_id !== currentUserId ? last.sender_id : (last.recipient_id !== currentUserId ? last.recipient_id : undefined);
      if (otherId && otherId !== currentUserId) return otherId;
    }

    return null;
  }, [to, messages]);

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

    // Her kullanıcı ile olan sohbet ayrı olmalı - sadece kullanıcı ID'lerine göre filtrele
    // match_id'yi filtreleme kriteri olarak kullanma, çünkü her sohbet ayrı olmalı
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at, match_id')
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${recip}),and(sender_id.eq.${recip},recipient_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (!error) {
      const rows = (data as MsgItem[]) || [];
      const blocked = await getBlockedUserIds(user.id);
      const filtered = blocked.size > 0 ? rows.filter((m) => !blocked.has(m.sender_id)) : rows;
      setMessages(filtered);
      setBlockedIds(blocked);
      // Mesajlar yüklendikten hemen sonra listeyi en alta kaydır
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: false });
      }, 50);
    }
  }, [resolveRecipientId]);

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
      const mId = normParam(matchId);
      let q = supabase.from('notifications')
        .update({ is_read: true })
        .eq('type', 'direct_message')
        .eq('user_id', user.id)
        .eq('sender_id', recip);
      if (mId) q = q.eq('match_id', mId);
      await q;
      try { 
        // Bildirim context'inde direct_message unread sayısını yeniden hesapla
        refreshNotifications?.(); 
        // Ve mesaj ikonundaki badge'i anında temizle
        clearMessageBadge?.();
      } catch {}
    })();
    return () => { mounted = false; };
  }, [resolveRecipientId, normParam, matchId]);

  // Realtime subscription: sadece ilgili sohbet (iki kullanıcı + match) insert'lerini dinle
  useEffect(() => {
    let mounted = true;
    let channel: any = null;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      const recip = await resolveRecipientId(user.id);
      if (!mounted || !recip) return;
      const matchIdStr = normParam(matchId);

      channel = supabase
        .channel(`msg-${user.id}-${recip}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload: any) => {
          const m = payload.new as MsgItem;
          const participants = (m.sender_id === user.id && m.recipient_id === recip) || (m.sender_id === recip && m.recipient_id === user.id);
          const blocked = await getBlockedUserIds(user.id);
          const isBlocked = blocked.has(m.sender_id);

          if (participants && !isBlocked) {
            setMessages(prev => [...prev, m]);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 30);
          }
        })
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [resolveRecipientId, normParam, matchId]);

  const sendMessage = useCallback(async () => {
    // Boş mesajı gönderme
    if (!input.trim()) return;

    // Yasaklı kelime kontrolü
    if (containsBannedWord(input)) {
      Alert.alert(t('chat.profanityTitle'), t('chat.profanityWarning'));
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Hedef kullanıcıyı çöz
      const recip = await resolveRecipientId(user.id);
      if (!recip) {
        console.warn('[Chat] sendMessage: recipient could not be resolved');
        return;
      }

      const content = input.trim();

      const payload: any = {
        sender_id: user.id,
        recipient_id: recip,
        content,
      };

      const getParam2 = (p: any): string | undefined => {
        const v = Array.isArray(p) ? p[0] : p;
        return typeof v === 'string' && v && v !== 'undefined' && v !== 'null' ? v : undefined;
      };
      const matchIdStr = getParam2(matchId);
      if (matchIdStr) payload.match_id = matchIdStr;

      const { error } = await supabase.from('messages').insert(payload);
      if (error) {
        console.error('[Chat] sendMessage insert error:', error);
        return;
      }

      // Alıcı için unread sayısını besleyecek direct_message bildirimi oluştur.
      // created_at'ı DB default'una bırakıyoruz (UTC).
      try {
        const notifPayload: any = {
          user_id: recip,
          sender_id: user.id,
          type: 'direct_message',
          message: content,
          is_read: false,
        };
        if (matchIdStr) notifPayload.match_id = matchIdStr;
        const { error: notifError } = await supabase.from('notifications').insert(notifPayload);
        if (notifError) {
          console.error('[Chat] direct_message notification insert error:', notifError);
        }
      } catch (e) {
        console.error('[Chat] direct_message notification unexpected error:', e);
      }

      setInput('');
      fetchMessages();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      console.error('[Chat] sendMessage unexpected error:', e);
    }
  }, [input, matchId, fetchMessages, resolveRecipientId, t]);

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

    const alreadyReported = await hasUserReportedContent(user.id, 'message', reportItem.id);
    if (alreadyReported) {
      closeReportModal();
      Alert.alert('', t('chat.reportAlreadySubmitted'));
      return;
    }

    const { error } = await reportContent({
      reporterId: user.id,
      reportedUserId: reportItem.sender_id,
      contentType: 'message',
      contentId: reportItem.id,
      contentPreview: reportItem.content?.slice(0, 200) || null,
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

  const renderItem = ({ item }: { item: MsgItem }) => {
    const mine = item.sender_id === me;
    return (
      <Pressable
        style={{ paddingHorizontal: 12, paddingVertical: 6, alignItems: mine ? 'flex-end' : 'flex-start' }}
        onLongPress={() => {
          if (!mine) {
            Alert.alert(
              t('chat.reportMessage'),
              item.content?.slice(0, 80) + (item.content && item.content.length > 80 ? '...' : ''),
              [
                { text: t('general.cancel'), style: 'cancel' },
                { text: t('chat.reportMessage'), onPress: () => openReportModal(item) },
              ]
            );
          }
        }}
      >
        <View style={{ backgroundColor: mine ? '#16a34a' : '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '85%' }}>
          <Text style={{ color: mine ? 'white' : '#111827' }}>{item.content}</Text>
        </View>
      </Pressable>
    );
  };

  const keyboardOffset = Platform.OS === 'ios' ? 80 : 50;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
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
                <Ionicons name="chevron-back" size={24} color="#065f46" />
              </TouchableOpacity>
            ),
            headerTitle: () => (
              <Text
                style={{ fontWeight: '800', color: '#065f46', maxWidth: 240 }}
                numberOfLines={1}
              >
                {String(name || 'Sohbet')}
              </Text>
            ),
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={handleBlockUser} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="ban-outline" size={22} color="#dc2626" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/notifications')} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="heart-outline" size={22} color="green" />
                </TouchableOpacity>
              </View>
            ),
          }}
        />
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: Math.max(60, insets.bottom + 8) }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
          <Modal
            visible={reportModalVisible}
            transparent
            animationType="fade"
            onRequestClose={closeReportModal}
          >
            <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }} onPress={closeReportModal}>
              <Pressable style={{ backgroundColor: 'white', borderRadius: 12, padding: 20 }} onPress={(e) => e.stopPropagation()}>
                <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>{t('chat.reportMessage')}</Text>
                {reportItem && (
                  <Text style={{ fontSize: 14, color: '#6b7280', marginBottom: 12 }} numberOfLines={3}>
                    "{reportItem.content?.slice(0, 100)}{reportItem.content && reportItem.content.length > 100 ? '...' : ''}"
                  </Text>
                )}
                <TextInput
                  placeholder={t('chat.reportAdditionalNotes')}
                  value={reportNotes}
                  onChangeText={setReportNotes}
                  multiline
                  numberOfLines={3}
                  style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16, minHeight: 80, textAlignVertical: 'top' }}
                />
                <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
                  <TouchableOpacity onPress={closeReportModal} style={{ backgroundColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: '#374151', fontWeight: '600' }}>{t('general.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleReportSubmit} style={{ backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                    <Text style={{ color: 'white', fontWeight: '600' }}>{t('chat.reportSubmit')}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

          <View style={{ flexDirection: 'row', paddingTop: 6, paddingHorizontal: 8, paddingBottom: Math.max(9, insets.bottom + 9), borderTopWidth: 1, borderColor: '#e5e7eb' }}>
            <TextInput
              placeholder="Mesaj yaz"
              value={input}
              onChangeText={setInput}
              style={{ flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 }}
            />
            <TouchableOpacity onPress={sendMessage} style={{ backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ color: 'white', fontWeight: '700' }}>Gönder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    </KeyboardAvoidingView>
  );
}


