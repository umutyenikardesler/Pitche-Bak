import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Animated, Dimensions, Modal, Pressable, Alert, TextInput, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { supabase } from "@/services/supabase";
import { getBlockedUserIds, blockUser } from "@/services/blocks";
import { reportContent, hasUserReportedContent } from "@/services/contentReports";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestAuthAlert } from '@/contexts/GuestAuthModalContext';
import { useAppTheme } from "@/contexts/ThemeContext";
import { useTabBarBottomInset } from "@/hooks/useTabBarBottomInset";
import { useTabBarAwarePagination } from "@/hooks/useTabBarAwarePagination";

// Ölçüm tamamlanana kadar kullanılan ilk tahmin. Gerçek değer, ekranda hap menünün
// üstünde tam sığan kart sayısına göre hesaplanır (bkz. recomputeVisibleFit).
const INITIAL_VISIBLE_CHATS = 7;
const CHATS_PAGE_SIZE = 5;
// Kartlar arası ek dikey aralık ve listenin üst dolgusu (fit hesabında kullanılıyor).
// Kartların kendi `my-1` boşluğu var; burada ekstra aralık bırakmıyoruz.
const CHAT_ROW_GAP = 0;
const CHAT_LIST_PADDING_TOP = 8;
/** "Yapılacak Maçlar" bölümünde kaydırmadan görünecek azami kart sayısı. */
const UPCOMING_VISIBLE_ROWS = 3;
/** Bölümün kaplayabileceği azami alan oranı (kart sayısı sınırına ek üst sınır). */
const UPCOMING_MAX_HEIGHT_RATIO = 0.6;

/** Mesajlar sayfasındaki sekmeler. Grup mesajları henüz uygulanmadı. */
type ChatTab = 'direct' | 'match' | 'group';

/**
 * Maçın başlangıç zamanını ms cinsinden döndürür. Veri birkaç farklı biçimde
 * gelebildiği için sırayla ISO, tarih-only ve TR (gg.aa.yyyy) biçimleri denenir.
 * Hem sohbet sıralamasında hem de "Maç Sohbetleri" sekmesinde kullanılıyor.
 */
function parseMatchStartTs(dateStr: string, timeStr: string): number {
  const dRaw = (dateStr || "").trim();
  const tRaw = (timeStr || "").trim();
  // Bazı verilerde saat "16.17.00" gibi gelebiliyor → normalize et
  const tNorm = tRaw.includes(".") && !tRaw.includes(":") ? tRaw.replace(/\./g, ":") : tRaw;

  const tParts = (tNorm || "").split(":").map((x) => Number(x));
  const hh = Number.isFinite(tParts[0]) ? tParts[0] : 0;
  const mm = Number.isFinite(tParts[1]) ? tParts[1] : 0;

  // 1) ISO: 2026-03-29 + 16:17
  const iso = new Date(`${dRaw}T${tNorm}`);
  if (Number.isFinite(iso.getTime())) return iso.getTime();

  // 2) Date-only parse + set time
  const d1 = new Date(dRaw);
  if (Number.isFinite(d1.getTime())) {
    d1.setHours(hh, mm, 0, 0);
    return d1.getTime();
  }

  // 3) TR format: 29.03.2026
  if (dRaw.includes(".")) {
    const [dd, mo, yy] = dRaw.split(".").map((x) => Number(x));
    if (Number.isFinite(dd) && Number.isFinite(mo) && Number.isFinite(yy)) {
      const d2 = new Date(yy, mo - 1, dd, hh, mm, 0, 0);
      if (Number.isFinite(d2.getTime())) return d2.getTime();
    }
  }

  return 0;
}

type ChatSummary = MatchChatSummary | DirectChatSummary;

interface BaseChatSummary {
  owner_id: string;
  owner_name: string;
  owner_surname: string;
  owner_profile_image?: string | null;
  unreadCount?: number;
}

interface MatchChatSummary extends BaseChatSummary {
  kind: "match";
  id: string; // match id
  title: string;
  date: string;
  time: string;
  // Son mesaj zamanı (varsa). Yoksa sıralamada maç tarihi/saatine fallback yapılır.
  lastAt?: string | null;
  // Sohbeti listeye ekleten event zamanı (join_request kabul bildirimi)
  createdAt?: string | null;
  pitches?: { name?: string; districts?: { name?: string } } | null;
}

interface DirectChatSummary extends BaseChatSummary {
  kind: "direct";
  id: "dm";
  lastMessage?: string | null;
  lastAt?: string | null;
  match_id?: string | null;
}

export default function Messages() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors, isDark } = useAppTheme();
  const tabBarInset = useTabBarBottomInset();
  const { isGuest } = useAuth();
  const { showGuestAuthAlert } = useGuestAuthAlert();

  useFocusEffect(
    useCallback(() => {
      if (isGuest) {
        showGuestAuthAlert(t('auth.guestMessage'));
      }
    }, [isGuest, showGuestAuthAlert, t])
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ChatSummary[]>([]);
  const screenWidth = Dimensions.get('window').width;
  const [translateX] = useState(new Animated.Value(0));
  const [chatOptionsItem, setChatOptionsItem] = useState<ChatSummary | null>(null);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportNotes, setReportNotes] = useState('');
  const [reportTargetItem, setReportTargetItem] = useState<ChatSummary | null>(null);
  const [ugcAgreed, setUgcAgreed] = useState<boolean | null>(null);
  const [pinnedChatKeys, setPinnedChatKeys] = useState<Set<string>>(new Set());
  // İlk yükleme tamamlandı mı? Tamamlandıysa sonraki odaklanmalarda sessiz tazeleme yapılır.
  const hasLoadedOnceRef = useRef(false);
  const [activeTab, setActiveTab] = useState<ChatTab>('direct');
  // "Yapılacak Maçlar" bölümünde ilk kartın ölçülen yüksekliği ve iki bölümün
  // paylaştığı toplam alan; 3 kartlık sınır ve %60 üst sınırı bunlardan hesaplanıyor.
  const [upcomingRowHeight, setUpcomingRowHeight] = useState(0);
  const [matchSectionsHeight, setMatchSectionsHeight] = useState(0);
  const getChatKey = useCallback((item: ChatSummary): string => {
    if (item.kind === "match") return `${item.owner_id}-m-${item.id}`;
    return `${item.owner_id}-d-${(item as DirectChatSummary).match_id ?? "x"}`;
  }, []);

  /**
   * Sekmeye göre liste. `items` zaten sabitlenmişler önde olacak şekilde sıralı geliyor;
   * "Sohbetler" bu sırayı korur.
   *
   * Maç sekmesinde ayrıca bölüm başlıklarını çizebilmek için ilk "geçmiş" maçın anahtarı
   * ayrı listeler olarak döndürülür: yapılacak maçlar kendi kısa ve kaydırılabilir
   * listesinde, geçmiş maçlar ise sayfalanan ana listede gösterilir.
   */
  const { tabItems, upcomingItems, pastItems } = useMemo(() => {
    const empty = {
      tabItems: [] as ChatSummary[],
      upcomingItems: [] as ChatSummary[],
      pastItems: [] as ChatSummary[],
    };
    if (activeTab === 'group') return empty;
    if (activeTab === 'direct') {
      return { ...empty, tabItems: items.filter((it) => it.kind === 'direct') as ChatSummary[] };
    }

    // Maç sohbetleri: yaklaşan maçlar tarih-saat sırasıyla üstte, oynanmışlar altta
    // (en yakın geçmiş önce). Sabitlenenler kendi içlerinde aynı kurala uyar.
    const now = Date.now();
    const withTs = items
      .filter((it): it is MatchChatSummary => it.kind === 'match')
      .map((m) => ({ m, ts: parseMatchStartTs(m.date, m.time) }));

    const split = (list: typeof withTs) => ({
      upcoming: list.filter((x) => x.ts >= now).sort((a, b) => a.ts - b.ts),
      past: list.filter((x) => x.ts < now).sort((a, b) => b.ts - a.ts),
    });

    const pinned = split(withTs.filter((x) => pinnedChatKeys.has(getChatKey(x.m))));
    const rest = split(withTs.filter((x) => !pinnedChatKeys.has(getChatKey(x.m))));

    const upcoming = [...pinned.upcoming, ...rest.upcoming];
    const past = [...pinned.past, ...rest.past];

    return {
      tabItems: [] as ChatSummary[],
      upcomingItems: upcoming.map((x) => x.m) as ChatSummary[],
      pastItems: past.map((x) => x.m) as ChatSummary[],
    };
  }, [items, activeTab, pinnedChatKeys, getChatKey]);

  // Sayfalama/soluklaştırma maç sekmesinde YALNIZCA geçmiş maçlara uygulanır;
  // yapılacak maçlar kendi kısa listesinde tam olarak gösterilir.
  const paginatedItems = activeTab === 'match' ? pastItems : tabItems;

  // Hap menü hizasına denk gelen sohbet soluk gösterilir; kaydırdıkça 5'er yüklenir.
  const {
    visibleItems,
    isFaded,
    reset: resetPagination,
    handleRowLayout,
    listProps: paginationListProps,
  } = useTabBarAwarePagination<ChatSummary>(paginatedItems, {
    initialVisible: INITIAL_VISIBLE_CHATS,
    pageSize: CHATS_PAGE_SIZE,
    rowGap: CHAT_ROW_GAP,
    listPaddingTop: CHAT_LIST_PADDING_TOP,
    // Sekmeler farklı listeler ve farklı yüksekliklerde; geçişte ölçümler sıfırlanmalı.
    resetKey: activeTab,
  });

  /**
   * mode:
   *  - 'initial'    : tam ekran yükleme göstergesi (yalnızca ilk açılış)
   *  - 'refresh'    : pull-to-refresh göstergesi
   *  - 'background' : gösterge yok; ekrandaki liste durur, veri sessizce tazelenir
   */
  const fetchChats = useCallback(async (mode: 'initial' | 'refresh' | 'background' = 'initial') => {
    try {
      if (mode === 'refresh') {
        setRefreshing(true);
      } else if (mode === 'initial') {
        setLoading(true);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Birbirine bağlı olmayan okumalar paralel çalışıyor; eskiden hepsi sırayla
      // bekleniyordu ve her biri ayrı bir gidiş-dönüş gecikmesi ekliyordu.
      const [
        blockedIds,
        joinRequestsRes,
        unreadRes,
        recentMsgsRes,
        hiddenRaw,
        pinnedRaw,
      ] = await Promise.all([
        getBlockedUserIds(user.id),
        // Katılım kabul edilmiş join_request bildirimlerinden sohbetleri topla.
        // Partner her zaman sender_id'deki kullanıcıdır.
        supabase
          .from('notifications')
          .select(`
            id,
            match_id,
            created_at,
            sender:users!notifications_sender_id_fkey(id, name, surname, profile_image),
            match:match!notifications_match_id_fkey(id, title, date, time, create_user, pitches(name, districts(name)))
          `)
          .eq('user_id', user.id)
          .eq('type', 'join_request')
          .like('message', '%kabul edildiniz%')
          .order('created_at', { ascending: false }),
        // Okunmamış direct_message bildirimleri (kişi+maç bazında gruplanacak)
        supabase
          .from('notifications')
          .select(`sender_id, match_id`)
          .eq('user_id', user.id)
          .eq('type', 'direct_message')
          .eq('is_read', false),
        // Direkt mesaj sohbetleri bu mesajlardan türetiliyor
        supabase
          .from('messages')
          .select('id, sender_id, recipient_id, content, created_at, match_id')
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(250),
        AsyncStorage.getItem(`hidden_chats_${user.id}`),
        AsyncStorage.getItem(`pinned_chats_${user.id}`),
      ]);

      const { data: allData, error } = joinRequestsRes;
      if (error) throw error;

      const { data: unreadNotifs, error: unreadError } = unreadRes;
      if (unreadError) {
        console.error('[Messages] unread direct_message fetch error:', unreadError);
      }

      const unreadMap = new Map<string, number>();
      (unreadNotifs || []).forEach((n: any) => {
        const key = `${n.sender_id}-${n.match_id || 'null'}`;
        unreadMap.set(key, (unreadMap.get(key) || 0) + 1);
      });

      const matchSummaries: MatchChatSummary[] = (allData || [])
        .filter((n: any) => n.match && n.sender && n.sender.id && n.sender.id !== user.id && !blockedIds.has(n.sender.id))
        .map((n: any) => {
          const key = `${n.sender.id}-${n.match.id}`;
          return {
            kind: "match",
            id: n.match.id,
            title: n.match.title,
            date: n.match.date,
            time: n.match.time,
            owner_id: n.sender.id, // sohbet partneri (her zaman diğer kullanıcı)
            owner_name: n.sender.name || '',
            owner_surname: n.sender.surname || '',
            owner_profile_image: n.sender.profile_image || null,
            pitches: n.match?.pitches || null,
            unreadCount: unreadMap.get(key) || 0,
            createdAt: typeof n.created_at === "string" ? n.created_at : null,
          };
        });

      // Duplicate'leri kaldır (aynı maç + aynı kullanıcı için tek sohbet)
      const uniqueMatchSummaries = matchSummaries.filter((summary, index, self) =>
        index === self.findIndex(s => s.id === summary.id && s.owner_id === summary.owner_id)
      );

      // Direkt mesaj sohbetleri sadece match_id'siz mesajlardan türetiliyor
      const { data: recentMsgs, error: msgError } = recentMsgsRes;

      if (msgError) {
        console.error('[Messages] recent messages fetch error:', msgError);
      }

      const dmMetaByUser = new Map<string, { lastMessage: string | null; lastAt: string | null; match_id: null }>();
      const lastAtByMatchChatKey = new Map<string, string>(); // `${otherId}-m-${matchId}` => lastAt
      (recentMsgs || []).forEach((m: any) => {
        const otherId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        if (!otherId || otherId === user.id || blockedIds.has(otherId)) return;
        const at = typeof m.created_at === "string" ? m.created_at : null;

        // Match sohbetleri için son mesaj zamanını match_id bazında tut
        if (m.match_id && at) {
          const key = `${otherId}-m-${m.match_id}`;
          if (!lastAtByMatchChatKey.has(key)) {
            lastAtByMatchChatKey.set(key, at);
          }
          return;
        }

        // Direct sohbet kartı sadece match_id'siz mesajlardan üretilir
        if (!dmMetaByUser.has(otherId)) {
          dmMetaByUser.set(otherId, {
            lastMessage: typeof m.content === 'string' ? m.content : null,
            lastAt: at,
            match_id: null,
          });
        }
      });

      const dmUserIds = Array.from(dmMetaByUser.keys());
      const dmUsersById = new Map<string, { id: string; name?: string; surname?: string; profile_image?: string | null }>();
      if (dmUserIds.length > 0) {
        const { data: dmUsers, error: dmUsersError } = await supabase
          .from('users')
          .select('id, name, surname, profile_image')
          .in('id', dmUserIds);
        if (dmUsersError) {
          console.error('[Messages] dm users fetch error:', dmUsersError);
        }
        (dmUsers || []).forEach((u: any) => {
          if (u?.id) dmUsersById.set(u.id, u);
        });
      }

      const dmSummaries: DirectChatSummary[] = dmUserIds.map((otherId) => {
        const meta = dmMetaByUser.get(otherId)!;
        const u = dmUsersById.get(otherId);
        const unreadKey = `${otherId}-${meta.match_id || 'null'}`;
        return {
          kind: "direct",
          id: "dm",
          owner_id: otherId,
          owner_name: u?.name || '',
          owner_surname: u?.surname || '',
          owner_profile_image: u?.profile_image ?? null,
          unreadCount: unreadMap.get(unreadKey) || 0,
          lastMessage: meta.lastMessage,
          lastAt: meta.lastAt,
          match_id: meta.match_id,
        };
      });

      const hiddenSet = new Set<string>((hiddenRaw ? JSON.parse(hiddenRaw) : []) || []);
      const pinnedSet = new Set<string>((pinnedRaw ? JSON.parse(pinnedRaw) : []) || []);

      const getKey = (it: ChatSummary) =>
        it.kind === "match" ? `${it.owner_id}-m-${it.id}` : `${it.owner_id}-d-${(it as DirectChatSummary).match_id ?? "x"}`;

      const matchWithLastAt: MatchChatSummary[] = uniqueMatchSummaries.map((m) => {
        const k = `${m.owner_id}-m-${m.id}`;
        return { ...m, lastAt: lastAtByMatchChatKey.get(k) ?? null };
      });

      const allChats: ChatSummary[] = [...dmSummaries, ...matchWithLastAt];
      const filtered = allChats.filter((it) => !hiddenSet.has(getKey(it)));

      const toTs = (s: string | null | undefined) => {
        if (!s) return 0;
        const t = new Date(s).getTime();
        return Number.isFinite(t) ? t : 0;
      };

      const getSortTs = (it: ChatSummary): number => {
        if (it.kind === "direct") return toTs(it.lastAt);
        const mt = it as MatchChatSummary;
        const lastMsgTs = toTs(mt.lastAt);
        if (lastMsgTs) return lastMsgTs;
        const matchStartTs = parseMatchStartTs(mt.date, mt.time);
        if (matchStartTs) return matchStartTs;
        return toTs(mt.createdAt);
      };

      const byRecentDesc = (a: ChatSummary, b: ChatSummary) => getSortTs(b) - getSortTs(a);

      // İstenen davranış: sabitlenmiş sohbet yoksa en son mesaj/etkileşim en üstte.
      // Sabitlenmiş varsa: pinned üstte, kendi içinde yine en son etkileşim en üstte.
      const ordered =
        pinnedSet.size > 0
          ? [
              ...filtered.filter((it) => pinnedSet.has(getKey(it))).sort(byRecentDesc),
              ...filtered.filter((it) => !pinnedSet.has(getKey(it))).sort(byRecentDesc),
            ]
          : [...filtered].sort(byRecentDesc);

      setItems(ordered);
      setPinnedChatKeys(pinnedSet);
    } catch (e) {
      console.error('[Messages] fetchChats error:', e);
      setItems([]);
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUgcAgreed(true);
        return;
      }
      const v = await AsyncStorage.getItem(`ugc_messaging_agreed_${user.id}`);
      setUgcAgreed(v === '1');
    })();
  }, []);

  const handleUgcAgree = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await AsyncStorage.setItem(`ugc_messaging_agreed_${user.id}`, '1');
    }
    setUgcAgreed(true);
  }, []);

  const onRefresh = useCallback(() => {
    resetPagination();
    fetchChats('refresh');
  }, [fetchChats, resetPagination]);

  const handleBlockFromList = useCallback(async (item: ChatSummary) => {
    setChatOptionsItem(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !item.owner_id) return;
    Alert.alert(
      t('chat.blockUser'),
      t('chat.blockConfirm'),
      [
        { text: t('general.cancel'), style: 'cancel' },
        {
          text: t('chat.blockUser'),
          style: 'destructive',
          onPress: async () => {
            const { error } = await blockUser(user.id, item.owner_id);
            if (!error) {
              setItems((prev) => prev.filter((i) => i.owner_id !== item.owner_id));
              Alert.alert('', t('chat.blocked'));
            }
          },
        },
      ]
    );
  }, [t]);

  const openReportModalForItem = useCallback((item: ChatSummary) => {
    setChatOptionsItem(null);
    setReportTargetItem(item);
    setReportNotes('');
    setReportModalVisible(true);
  }, []);

  const handleDeleteChat = useCallback(async (item: ChatSummary) => {
    setChatOptionsItem(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    Alert.alert(
      t('messages.deleteChat'),
      t('messages.deleteChatConfirm'),
      [
        { text: t('general.cancel'), style: 'cancel' },
        {
          text: t('messages.deleteChat'),
          style: 'destructive',
          onPress: async () => {
            const key = getChatKey(item);
            const raw = await AsyncStorage.getItem(`hidden_chats_${user.id}`);
            const arr: string[] = raw ? JSON.parse(raw) : [];
            if (!arr.includes(key)) arr.push(key);
            await AsyncStorage.setItem(`hidden_chats_${user.id}`, JSON.stringify(arr));
            setItems((prev) => prev.filter((i) => getChatKey(i) !== key));
            Alert.alert('', t('messages.chatDeleted'));
          },
        },
      ]
    );
  }, [t, getChatKey]);

  const handlePinChat = useCallback(async (item: ChatSummary) => {
    setChatOptionsItem(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = getChatKey(item);
    const raw = await AsyncStorage.getItem(`pinned_chats_${user.id}`);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    if (!arr.includes(key)) arr.push(key);
    await AsyncStorage.setItem(`pinned_chats_${user.id}`, JSON.stringify(arr));
    // Sabitleme sonrası sıralama değişiyor; listeyi göstergesiz tazele.
    fetchChats('background');
  }, [getChatKey, fetchChats]);

  const handleUnpinChat = useCallback(async (item: ChatSummary) => {
    setChatOptionsItem(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const key = getChatKey(item);
    const raw = await AsyncStorage.getItem(`pinned_chats_${user.id}`);
    const arr: string[] = (raw ? JSON.parse(raw) : []).filter((k: string) => k !== key);
    await AsyncStorage.setItem(`pinned_chats_${user.id}`, JSON.stringify(arr));
    fetchChats('background');
  }, [getChatKey, fetchChats]);

  const handleReportSubmitFromList = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const item = reportTargetItem;
    if (!user || !item) return;

    const alreadyReported = await hasUserReportedContent(user.id, 'profile', item.owner_id);
    if (alreadyReported) {
      setReportModalVisible(false);
      setChatOptionsItem(null);
      Alert.alert('', t('chat.reportAlreadySubmitted'));
      return;
    }

    const { error } = await reportContent({
      reporterId: user.id,
      reportedUserId: item.owner_id,
      contentType: 'profile',
      contentId: item.owner_id,
      contentPreview: null,
      reason: reportNotes.trim() || null,
    });
    setReportModalVisible(false);
    setReportTargetItem(null);
    if (!error) Alert.alert('', t('chat.reportSent'));
  }, [reportTargetItem, reportNotes, t]);

  // Ekran odağa geldiğinde sohbet listesini tazele (ör: chat ekranından geri dönünce).
  // İlk yüklemeden sonra sessiz tazeleme: eskiden her odakta tam ekran gösterge açılıp
  // liste yerine spinner görünüyordu. Bu effect mount'ta da çalıştığı için ayrı bir
  // useEffect'e gerek yok (ikisi birlikte açılışta çift sorgu yapıyordu).
  useFocusEffect(
    useCallback(() => {
      fetchChats(hasLoadedOnceRef.current ? 'background' : 'initial');
      return () => {};
    }, [fetchChats])
  );

  // Soldan sağa kaydırarak index sayfasına dön (animasyonlu)
  const handleSwipeBack = useCallback(() => {
    Animated.timing(translateX, {
      toValue: screenWidth,
      duration: 350, // daha yavaş ve belirgin
      useNativeDriver: true,
    }).start(() => {
      router.push("/");
      // Sonraki giriş için pozisyonu sıfırla
      translateX.setValue(0);
    });
  }, [router, screenWidth, translateX]);

  // Ekran her odaklandığında yatay öteleme sıfırlanır.
  //
  // NEDEN: Yukarıdaki geri-kaydırma animasyonu sayfayı bir ekran genişliği
  // kadar ötelüyor ve sıfırlamayı animasyonun bitiş callback'ine bırakıyor.
  // Animasyon `useNativeDriver: true` ile çalıştığı için o `setValue(0)` native
  // tarafa her zaman yansımıyor; yansımadığında sayfa ekran dışında kalıyor ve
  // sekmeye tekrar girildiğinde SEKMELER DAHİL hiçbir şey görünmüyordu
  // (tamamen beyaz ekran, ara sıra tekrarlayan). Odakta sıfırlamak, önceki
  // çıkışta ne olduğundan bağımsız olarak sayfayı yerine oturtur.
  useFocusEffect(
    useCallback(() => {
      translateX.stopAnimation(() => translateX.setValue(0));
    }, [translateX])
  );

  // Pull-to-refresh çalışabilsin diye sadece sol kenardan başlatılan yatay swipe'ı yakala
  const swipeGesture = Gesture.Pan()
    .hitSlop({ left: 0, width: 24 })
    .activeOffsetX(20)
    .failOffsetY([-10, 10])
    .onEnd((event) => {
      if (event.translationX > 80) {
        runOnJS(handleSwipeBack)();
      }
    });

  // Realtime: C kullanıcısı Messages ekranındayken A'dan gelen yeni mesajlarda sohbet listesini anlık güncelle
  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted || !user) return;

      // Sadece current user'a gelen mesaj INSERT'lerini dinle
      channel = supabase
        .channel(`dm-list-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.id}` },
          () => {
            // Mesaj INSERT'inden hemen sonra listeyi sessizce tazele.
            fetchChats('background');
            // Bildirim kaydı biraz sonra oluşuyor; unreadCount'un doğru gelmesi için
            // kısa bir gecikmeyle bir kez daha tazeliyoruz (yine göstergesiz).
            setTimeout(() => {
              fetchChats('background');
            }, 300);
          }
        )
        .subscribe();
    })();

    return () => {
      mounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchChats]);

  const renderChatRow = ({ item }: { item: ChatSummary }) => {
    const hasUnread = (item.unreadCount ?? 0) > 0;
    const isPinned = pinnedChatKeys.has(getChatKey(item));
    const unreadText = (n: number | undefined) => {
      const v = typeof n === 'number' ? n : 0;
      if (v <= 0) return '';
      return v > 99 ? '99+' : String(v);
    };
    const formatDateTimeTr = (iso: string) => {
      const d = new Date(iso);
      const t = d.getTime();
      if (!Number.isFinite(t)) return '';
      return `${d.toLocaleDateString("tr-TR")} - ${d.toLocaleTimeString("tr-TR")}`;
    };

    if (item.kind === "direct") {
      const lastAtText = item.lastAt ? formatDateTimeTr(item.lastAt) : '';
      const preview = (item.lastMessage || '').trim();
      const previewText = preview.length ? (preview.length > 42 ? `${preview.slice(0, 42)}…` : preview) : (t('messages.directMessage') || 'Direkt mesaj');

      const params: any = { to: item.owner_id, name: `${item.owner_name} ${item.owner_surname}`.trim() };
      if (item.match_id) params.matchId = item.match_id;

      return (
        <View
          className="rounded-lg mx-4 my-1 px-1 py-0.5 shadow-lg"
          style={{ backgroundColor: colors.surface, ...(isPinned ? { borderWidth: 2, borderColor: colors.primary } : undefined) }}
        >
          <TouchableOpacity activeOpacity={0.8} onPress={() => router.push({ pathname: '/message/chat', params })} className="flex-row items-center">
            {/* Profil Resmi */}
            <View className="w-1/5 flex justify-center px-1 py-0.5">
              <Image
                source={item.owner_profile_image ? { uri: item.owner_profile_image } : require('@/assets/images/ball.png')}
                className="rounded-full mx-auto"
                style={{ width: 60, height: 60, resizeMode: 'contain' }}
              />
            </View>

            {/* Orta bilgi alanı - flex-1 ile kalan alanı doldurur */}
            <View className="flex-1 flex justify-center -mt-2 ml-2 min-w-0">
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-lg font-semibold"
                  style={{ color: isDark ? colors.primaryDark : (hasUnread ? colors.primaryDark : colors.textSecondary) }}
                  numberOfLines={1}
                >
                  {item.owner_name} {item.owner_surname}
                </Text>
              </View>

              <View className="text-md flex-row items-center">
                <Ionicons name="chatbubbles-outline" size={18} color={colors.icon} />
                <Text
                  className="pl-2 font-semibold flex-1"
                  style={{ color: isDark ? colors.text : colors.textSecondary }}
                  numberOfLines={1}
                >
                  {" "}{previewText}{" "}
                </Text>
              </View>

              {!!lastAtText && (
                <View className="text-md flex-row items-center pt-1">
                  <Ionicons name="time-outline" size={18} color={colors.icon} />
                  <Text className="pl-2 font-semibold" style={{ color: isDark ? colors.text : colors.textMuted }}>
                    {" "}{lastAtText}{" "}
                  </Text>
                </View>
              )}
            </View>

            {/* Sağ aksiyon kolonu: üst (pin+rozet) / orta (3 nokta) / alt (boş) */}
            <View
              style={{
                width: '10%',
                minWidth: 48,
                maxWidth: 64,
                marginLeft: 8,
                marginRight: 5,
                paddingVertical: 2,
                alignSelf: 'stretch',
                // Sağ hizalama çalışsın diye stretch
                alignItems: 'stretch',
                justifyContent: 'space-between',
              }}
            >
              {/* Üst alan (rozet/pin her zaman sağda hizalı) */}
              <View
                style={{
                  minHeight: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  paddingRight: 1,
                  paddingBottom: 5,
                  gap: 1,
                }}
              >
                {hasUnread && (
                  <View
                    style={{
                      minWidth: 22,
                      height: 22,
                      paddingHorizontal: 6,
                      borderRadius: 11,
                      backgroundColor: 'red',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>{unreadText(item.unreadCount)}</Text>
                  </View>
                )}
                {isPinned && (
                  <MaterialCommunityIcons name="pin" size={24} color="#047857" style={{ transform: [{ rotate: '25deg' }] }} />
                )}
              </View>

              {/* Orta alan (3 nokta her zaman ortada) */}
              <TouchableOpacity
                onPress={() => setChatOptionsItem(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                // Sağa yaslı + soldan biraz iç boşluk
                style={{ paddingLeft: 6, paddingRight: 0, paddingVertical: 2, alignSelf: 'flex-end' }}
              >
                <Ionicons name="ellipsis-vertical" size={22} color="#059669" />
              </TouchableOpacity>

              {/* Alt alan (boş) */}
              <View style={{ minHeight: 22 }} />
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    const formattedDate = new Date(item.date).toLocaleDateString("tr-TR");
    const [hours, minutes] = item.time.split(":").map(Number);
    const startFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const endFormatted = `${String((hours + 1)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const lastAtText = item.lastAt ? formatDateTimeTr(item.lastAt) : '';

    return (
      <View
        className="rounded-lg mx-4 my-1 px-2 py-1 shadow-lg"
        style={{ backgroundColor: colors.surface, ...(isPinned ? { borderWidth: 2, borderColor: colors.primary } : undefined) }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push({ pathname: '/message/chat', params: { to: item.owner_id, matchId: item.id, name: `${item.owner_name} ${item.owner_surname}` } })}
          className="flex-row items-center"
        >
          {/* Profil Resmi */}
          <View className="w-1/5 flex justify-center px-1 py-1">
            <Image
              source={item.owner_profile_image ? { uri: item.owner_profile_image } : require('@/assets/images/ball.png')}
              className="rounded-full mx-auto"
              style={{ width: 60, height: 60, resizeMode: 'contain' }}
            />
          </View>

          {/* Orta bilgi alanı - flex-1 ile kalan alanı doldurur */}
          <View className="flex-1 flex justify-center ml-2 min-w-0" style={{ paddingTop: 0, paddingBottom: 2 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold" style={{ color: hasUnread ? colors.primaryDark : colors.text }} numberOfLines={1}>
                {item.owner_name} {item.owner_surname}
              </Text>
            </View>

            <View className="text-md flex-row items-center">
              <Ionicons name="calendar-outline" size={18} color={colors.icon} />
              <Text className="pl-2 font-semibold" style={{ color: colors.text }}> {formattedDate} →</Text>
              <Text className="pl-2 font-bold" style={{ color: colors.primaryDark }}> {startFormatted}-{endFormatted} </Text>
            </View>

            <View className="text-md flex-row items-center pt-1">
              <Ionicons name="location" size={18} color={colors.icon} />
              <Text className="pl-2 font-semibold" style={{ color: colors.text }}> {(item.pitches?.districts?.name || 'Bilinmiyor')} →</Text>
              <Text className="pl-2 font-bold" style={{ color: colors.primaryDark }}> {item.pitches?.name || 'Bilinmiyor'} </Text>
            </View>

            {!!lastAtText && (
              <View className="text-md flex-row items-center pt-1">
                <Ionicons name="time-outline" size={18} color={colors.icon} />
                <Text className="pl-2 font-semibold" style={{ color: colors.text }}> {lastAtText} </Text>
              </View>
            )}
          </View>

          {/* Sağ aksiyon kolonu: üst (pin+rozet) / orta (3 nokta) / alt (boş) */}
          <View
            style={{
              width: '10%',
              minWidth: 48,
              maxWidth: 64,
              marginLeft: 8,
              marginRight: 0,
              paddingVertical: 2,
              alignSelf: 'stretch',
              // Sağ hizalama çalışsın diye stretch
              alignItems: 'stretch',
            }}
          >
            {/* Üst alan: rozet + pin (pinned olsun/olmasın üstte kalsın) */}
            <View
              style={{
                flex: 1,
                minHeight: 0,
                justifyContent: 'flex-start',
                alignItems: 'flex-end',
                paddingRight: 0, // sağdan 3px boşluk
                paddingBottom: isPinned ? 0 : 0, // pinned ise altına 5px boşluk
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
                {hasUnread && (
                  <View
                    style={{
                      minWidth: 20,
                      height: 20,
                      paddingHorizontal: 6,
                      borderRadius: 11,
                      backgroundColor: 'red',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>{unreadText(item.unreadCount)}</Text>
                  </View>
                )}
                {isPinned && (
                  <MaterialCommunityIcons name="pin" size={24} color="#047857" style={{ transform: [{ rotate: '25deg' }] }} />
                )}
              </View>
            </View>

            {/* Orta alan: 3 nokta hep ortada */}
            <View style={{ flex: 1, minHeight: 0, justifyContent: 'center', alignItems: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => setChatOptionsItem(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                // Sağa yaslı + soldan biraz iç boşluk
                style={{ paddingLeft: 6, paddingRight: isPinned ? 0 : 2, marginBottom: isPinned ? 12 : 4 }}
              >
                <Ionicons name="ellipsis-vertical" size={22} color={colors.primaryDark} />
              </TouchableOpacity>
            </View>

            {/* Alt alan (boş) */}
            <View style={{ flex: 1, minHeight: 0 }} />
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  // Görünen son satırın altındaki sohbet, "devamı var" ipucu olarak soluk gösterilir.
  // Sarmalayıcı her satırda aynı kalmalı: yapıyı koşullu değiştirmek NativeWind'in
  // "kardeş bileşen eklendi/çıkarıldı" uyarısını tetikliyor.
  const sectionTitle = (label: string) => (
    <Text
      style={{
        // primaryDark yerine primary: bir tık açık yeşil
        color: colors.primary,
        fontWeight: '800',
        fontSize: 15,
        textAlign: 'center',
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 10,
      }}
    >
      {label}
    </Text>
  );

  const renderItem = ({ item, index }: { item: ChatSummary; index: number }) => (
    <View
      onLayout={(e) => handleRowLayout(index, e.nativeEvent.layout.height)}
      style={{ opacity: isFaded(index) ? 0.35 : 1, marginBottom: CHAT_ROW_GAP }}
    >
      {renderChatRow({ item })}
    </View>
  );

  /**
   * "Yapılacak Maçlar" bölümünün yüksekliği iki sınırın küçüğü:
   *   1) kart sayısı kadar, en fazla UPCOMING_VISIBLE_ROWS kart (1 → 1, 2 → 2, 3+ → 3)
   *   2) alanın %60'ı
   * Hangisi önce doluyorsa bölüm orada durur ve kendi içinde kaydırılır.
   * Kart yüksekliği sabit olmadığı için ilk kart ölçülüp hesap ondan yapılıyor.
   * Kalan yüksekliği "Geçmiş Maçlar" listesi (flex: 1) otomatik alıyor.
   */
  const upcomingMaxHeight =
    matchSectionsHeight > 0 ? matchSectionsHeight * UPCOMING_MAX_HEIGHT_RATIO : undefined;

  // Kart yüksekliği ilk satırdan ölçülüyor. Listenin içerik yüksekliğinden türetmek
  // güvenilmezdi: liste esnerken ölçüm de şişiyordu.
  // Ölçüm gelene kadar yükseklik dayatmıyoruz; `flexGrow: 0` sayesinde liste zaten
  // içeriği kadar yer kaplıyor, dolayısıyla 3 ve altı kartta sınıra gerek bile yok.
  const upcomingHeight =
    upcomingRowHeight > 0 && upcomingItems.length > UPCOMING_VISIBLE_ROWS
      ? UPCOMING_VISIBLE_ROWS * upcomingRowHeight
      : undefined;

  const upcomingSection = (
    <>
      <View style={{ height: 5 }} />
      {sectionTitle(t('messages.sections.upcomingMatches'))}
      {upcomingItems.length === 0 ? (
        // Boş durumda ölçülecek kart yok; sabit ve mütevazı bir yükseklik yeterli.
        <View style={{ paddingVertical: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textMuted }}>{t('messages.noUpcomingMatches')}</Text>
        </View>
      ) : (
        <FlatList
          data={upcomingItems}
          keyExtractor={(it) => `up-${it.owner_id}-${it.kind === 'match' ? it.id : 'dm'}`}
          renderItem={({ item, index }) => (
            <View
              onLayout={
                index === 0
                  ? (e) => setUpcomingRowHeight(e.nativeEvent.layout.height)
                  : undefined
              }
            >
              {renderChatRow({ item })}
            </View>
          )}
          style={[
            // KRİTİK: RN'de ScrollView/FlatList varsayılan stili flexGrow: 1 içerir.
            // Bu yüzden liste, içeriği tek kart olsa bile sütundaki boş alanı kaplıyordu.
            { flexGrow: 0 },
            upcomingHeight != null ? { height: upcomingHeight } : null,
            upcomingMaxHeight != null ? { maxHeight: upcomingMaxHeight } : null,
          ]}
          showsVerticalScrollIndicator
          scrollEnabled={upcomingItems.length > UPCOMING_VISIBLE_ROWS}
        />
      )}
    </>
  );

  let content: JSX.Element;

  if (loading) {
    content = (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  } else if (activeTab === 'match') {
    // Maç sekmesi iki ayrı liste: üstte kısa/kaydırılabilir "Yapılacak Maçlar",
    // altta sayfalanan "Geçmiş Maçlar". Kardeş listeler oldukları için iç içe
    // VirtualizedList uyarısı oluşmuyor.
    content = (
      <View
        style={{ flex: 1 }}
        onLayout={(e) => setMatchSectionsHeight(e.nativeEvent.layout.height)}
      >
        {upcomingSection}

        {pastItems.length > 0 && (
          <>
            {/* Bölümler arası nefes payı */}
            <View style={{ height: 5 }} />
            {sectionTitle(t('messages.sections.pastMatches'))}
          </>
        )}

        <FlatList
          // Sekme değişiminde yeniden monte olup kendini taze ölçsün; aksi halde
          // önceki sekmenin yüksekliğiyle hesap yapılıyor.
          key="match-past"
          data={visibleItems}
          keyExtractor={(it) => `past-${it.owner_id}-${it.kind === 'match' ? it.id : 'dm'}`}
          renderItem={renderItem}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 16 + tabBarInset, paddingTop: CHAT_LIST_PADDING_TOP, flexGrow: 1 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          alwaysBounceVertical
          {...paginationListProps}
        />
      </View>
    );
  } else if (!tabItems.length) {
    content = (
      <FlatList
        data={[]}
        keyExtractor={() => 'empty'}
        renderItem={null as any}
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center" style={{ minHeight: 200 }}>
            {/* Maç sekmesi yukarıda kendi bölümleriyle ele alınıyor; burada kalanlar. */}
            <Text style={{ color: colors.textMuted }}>
              {activeTab === 'group' ? t('messages.groupComingSoon') : t('messages.noDirectChats')}
            </Text>
          </View>
        }
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      />
    );
  } else {
    content = (
      <FlatList
        // Maç sekmesindeki listeden ayrı bir örnek olsun ki ölçümler karışmasın.
        key="direct-list"
        data={visibleItems}
        keyExtractor={(it) => `${it.kind}-${it.owner_id}-${it.kind === 'match' ? it.id : 'dm'}`}
        renderItem={renderItem}
        // Sekme çubuğuyla kardeş olduğu için kalan alanı açıkça doldurmalı;
        // soluk satır hesabı da bu yüksekliğe göre ölçülüyor.
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 + tabBarInset, paddingTop: CHAT_LIST_PADDING_TOP, flexGrow: 1 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        alwaysBounceVertical
        {...paginationListProps}
      />
    );
  }

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={{ flex: 1, transform: [{ translateX }] }}>
        {/* EULA/Topluluk İlkeleri - Apple UGC: kullanıcı içeriğe girmeden önce kabul */}
        {!isGuest && ugcAgreed === false && (
          <Modal visible={true} animationType="fade">
            <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: 'center', padding: 24 }}>
              <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: colors.primaryDark, marginBottom: 16, textAlign: 'center' }}>{t('ugc.agreeTitle')}</Text>
                <Text style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: 24 }}>{t('ugc.agreeMessage')}</Text>
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600', marginBottom: 24 }}>• {t('chat.contentFilteredNote')}</Text>
                <TouchableOpacity onPress={handleUgcAgree} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{t('ugc.agreeButton')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </Modal>
        )}

        {/* Sekmeler: Sohbetler / Maç Sohbetleri / Grup Mesajları */}
        <View
          style={{
            flexDirection: 'row',
            gap: 6,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: 8,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          {(['direct', 'match', 'group'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label =
              tab === 'direct'
                ? t('messages.tabs.direct')
                : tab === 'match'
                  ? t('messages.tabs.match')
                  : t('messages.tabs.group');

            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  // Aktif sekme marka yeşiliyle dolu, pasifler yüzey rengi.
                  backgroundColor: isActive ? colors.primary : colors.surface,
                  // Hap menüdeki gibi 1px marka rengi kenarlık + dışa vuran yeşil ışıltı.
                  borderWidth: 1,
                  borderColor: colors.primary,
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 4,
                }}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={{
                    fontSize: 12.5,
                    fontWeight: '700',
                    color: isActive ? colors.whiteText : (isDark ? colors.text : colors.textSecondary),
                  }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {content}

        {/* Sohbet seçenekleri modalı (... menüsü) */}
        <Modal visible={!!chatOptionsItem} transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 }} onPress={() => setChatOptionsItem(null)}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }} onPress={(e) => e.stopPropagation()}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primaryDark, marginBottom: 16, textAlign: 'center' }}>{t('messages.chatOptions')}</Text>
              {chatOptionsItem && (
                <View style={{ gap: 4 }}>
                  {pinnedChatKeys.has(getChatKey(chatOptionsItem)) ? (
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleUnpinChat(chatOptionsItem)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#f0fdf4', borderRadius: 10 }}>
                      <Text style={{ color: '#047857', fontWeight: '600', fontSize: 15 }}>{t('messages.unpinChat')}</Text>
                      <MaterialCommunityIcons name="pin-off" size={22} color="#047857" style={{ transform: [{ rotate: '25deg' }] }} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity activeOpacity={0.7} onPress={() => handlePinChat(chatOptionsItem)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#f0fdf4', borderRadius: 10 }}>
                      <Text style={{ color: '#047857', fontWeight: '600', fontSize: 15 }}>{t('messages.pinChat')}</Text>
                      <MaterialCommunityIcons name="pin" size={22} color="#047857" style={{ transform: [{ rotate: '25deg' }] }} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity activeOpacity={0.7} onPress={() => handleDeleteChat(chatOptionsItem)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fee2e2', borderRadius: 10 }}>
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>{t('messages.deleteChat')}</Text>
                    <Ionicons name="trash-outline" size={22} color="#dc2626" />
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => handleBlockFromList(chatOptionsItem)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fef2f2', borderRadius: 10 }}>
                    <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>{t('chat.blockUser')}</Text>
                    <Ionicons name="ban-outline" size={22} color="#dc2626" />
                  </TouchableOpacity>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => openReportModalForItem(chatOptionsItem)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fff7ed', borderRadius: 10 }}>
                    <Text style={{ color: '#ea580c', fontWeight: '600', fontSize: 15 }}>{t('messages.reportUser')}</Text>
                    <Ionicons name="flag-outline" size={22} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity activeOpacity={0.8} onPress={() => setChatOptionsItem(null)} style={{ marginTop: 16, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.surfaceAlt, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>{t('general.cancel')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Kullanıcı şikayet modalı */}
        <Modal visible={reportModalVisible} transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 20 }} onPress={() => { setReportModalVisible(false); setReportTargetItem(null); }}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 20 }} onPress={(e) => e.stopPropagation()}>
              <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8, color: colors.text }}>{t('chat.reportUser')}</Text>
              {reportTargetItem && (
                <Text style={{ fontSize: 14, color: colors.textMuted, marginBottom: 12 }} numberOfLines={2}>
                  {reportTargetItem.owner_name} {reportTargetItem.owner_surname}
                </Text>
              )}
              <TextInput
                placeholder={t('chat.reportAdditionalNotes')}
                value={reportNotes}
                onChangeText={setReportNotes}
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.textMuted}
                style={{ borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 16, minHeight: 80, textAlignVertical: 'top' }}
              />
              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
                <TouchableOpacity onPress={() => { setReportModalVisible(false); setReportTargetItem(null); }} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{t('general.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleReportSubmitFromList} style={{ backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 }}>
                  <Text style={{ color: 'white', fontWeight: '600' }}>{t('chat.reportSubmit')}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </Animated.View>
    </GestureDetector>
  );
}