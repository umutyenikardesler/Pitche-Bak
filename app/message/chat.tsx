import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image, TouchableOpacity as RNTouchableOpacity } from 'react-native';
import { useNotification } from '@/components/NotificationContext';

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
  const listRef = useRef<FlatList<MsgItem>>(null);

  const normParam = useCallback((p: any): string | undefined => {
    const v = Array.isArray(p) ? p[0] : p;
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (!s || s === 'undefined' || s === 'null') return undefined;
    return s;
  }, []);

  const { refresh: refreshNotifications } = useNotification();

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

    if (!error) setMessages((data as MsgItem[]) || []);
  }, [resolveRecipientId]);

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
      try { refreshNotifications?.(); } catch {}
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
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
          const m = payload.new as MsgItem;
          const participants = (m.sender_id === user.id && m.recipient_id === recip) || (m.sender_id === recip && m.recipient_id === user.id);
          
          // Sadece bu iki kullanıcı arasındaki mesajları al (match_id'ye bakmadan)
          if (participants) {
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
    if (!input.trim() || !to) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // TR (UTC+3) saatine göre created_at oluştur
    const trNowISO = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const recip = await resolveRecipientId(user.id);
    if (!recip) return;

    const payload: any = {
      sender_id: user.id,
      recipient_id: recip,
      content: input.trim(),
      created_at: trNowISO,
    };
    const getParam2 = (p: any): string | undefined => {
      const v = Array.isArray(p) ? p[0] : p;
      return typeof v === 'string' && v && v !== 'undefined' && v !== 'null' ? v : undefined;
    };
    const matchIdStr = getParam2(matchId);
    if (matchIdStr) payload.match_id = matchIdStr;
    const { error } = await supabase.from('messages').insert(payload);
    if (!error) {
      // Karşı tarafa bildirim gönder (direct_message)
      try {
        await supabase.from('notifications').insert({
          user_id: recip,
          sender_id: user.id,
          type: 'direct_message',
          message: input.trim().slice(0, 180),
          match_id: matchIdStr || null,
          is_read: false,
        });
      } catch {}
      setInput('');
      fetchMessages();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [input, to, matchId, fetchMessages]);

  const renderItem = ({ item }: { item: MsgItem }) => {
    const mine = item.sender_id === me;
    return (
      <View style={{ paddingHorizontal: 12, paddingVertical: 6, alignItems: mine ? 'flex-end' : 'flex-start' }}>
        <View style={{ backgroundColor: mine ? '#16a34a' : '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, maxWidth: '85%' }}>
          <Text style={{ color: mine ? 'white' : '#111827' }}>{item.content}</Text>
        </View>
      </View>
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
            headerTitleAlign: 'center',
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 4 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={24} color="#065f46" />
              </TouchableOpacity>
            ),
            headerTitle: () => (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Image source={require('@/assets/images/logo.png')} style={{ width: 120, height: 36, resizeMode: 'contain' }} />
              </View>
            ),
            headerRight: () => (
              <TouchableOpacity onPress={() => router.push('/notifications')} style={{ paddingHorizontal: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="heart-outline" size={22} color="green" />
              </TouchableOpacity>
            ),
          }}
        />
        <View style={{ flex: 1 }}>
          {/* Header altı bilgi satırı */}
          <View style={{ alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#e5e7eb' }}>
            {!!name && (
              <Text style={{ fontWeight: '700', color: '#065f46' }}>
                {String(name)} ile Sohbet Ediyorsunuz
              </Text>
            )}
          </View>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: Math.max(60, insets.bottom + 8) }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
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


