import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { fetchAdminReports, updateReportStatus, AdminReportRow } from '@/services/contentReports';

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fullName(ob?: { name?: string; surname?: string } | null): string {
  if (!ob) return '-';
  const n = [ob.name, ob.surname].filter(Boolean).join(' ');
  return n || '-';
}

export default function AdminReportsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);

  const loadReports = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const { data: userRow } = await supabase.from('users').select('role').eq('id', user.id).single();
    if (userRow?.role !== 'admin') {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(true);
    const [{ data, error }, totalRes] = await Promise.all([
      fetchAdminReports(),
      supabase.from('users').select('*', { count: 'exact', head: true }),
    ]);

    if (!error && data) setReports(data);
    setTotalUsers(totalRes.count ?? 0);
  };

  useEffect(() => {
    loadReports().finally(() => setLoading(false));
  }, []);

  // Online/aktif kullanıcı sayısı: uygulamanın genel presence kanalındaki unique key sayısı
  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!mounted || !user) return;

        channel = supabase.channel('online-users', {
          config: { presence: { key: user.id } },
        });

        channel.on('presence', { event: 'sync' }, () => {
          try {
            const state = channel.presenceState?.() || {};
            const keys = Object.keys(state);
            if (mounted) setActiveUsers(keys.length);
          } catch (_) {}
        });

        channel.subscribe(async (status: string) => {
          if (!mounted) return;
          if (status !== 'SUBSCRIBED') return;
          try {
            await channel.track({ online_at: new Date().toISOString() });
          } catch (_) {}
        });
      } catch (_) {}
    })();

    return () => {
      mounted = false;
      try {
        if (channel) supabase.removeChannel(channel);
      } catch (_) {}
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  useEffect(() => {
    if (isAdmin === false) {
      router.back();
    }
  }, [isAdmin, router]);

  if (isAdmin === false) return null;

  const [statusModalReport, setStatusModalReport] = useState<AdminReportRow | null>(null);

  const getStatusDisplay = (status: string) => {
    if (status === 'resolved') return t('admin.reports.statusResolved');
    if (status === 'rejected') return t('admin.reports.statusReviewed');
    if (status === 'reviewed' || status === 'checked') return t('admin.reports.statusChecked');
    return t('admin.reports.statusPending');
  };

  const getStatusStyle = (status: string) => {
    if (status === 'resolved') return { backgroundColor: '#16a34a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 };
    if (status === 'rejected') return { backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 };
    if (status === 'reviewed' || status === 'checked') return { backgroundColor: '#ea580c', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 };
    return { backgroundColor: '#ea580c', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 };
  };

  const handleStatusPress = (r: AdminReportRow) => {
    if (r.status !== 'pending') return;
    setStatusModalReport(r);
  };

  const handleStatusUpdate = async (status: 'resolved' | 'reviewed' | 'rejected' | 'checked') => {
    if (!statusModalReport) return;
    const { error } = await updateReportStatus(statusModalReport, status);
    setStatusModalReport(null);
    if (!error) loadReports();
  };

  const colWidths = { no: 40, reporter: 85, reported: 85, message: 110, notes: 60, status: 125, date: 72 };

  return (
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
            <Text style={{ fontWeight: '800', color: '#065f46', fontSize: 16 }} numberOfLines={1}>
              {t('admin.reports.title')}
            </Text>
          ),
        }}
      />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16a34a']} />}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            {/* Header row */}
            <View style={{ flexDirection: 'row', backgroundColor: '#065f46', paddingVertical: 10, paddingHorizontal: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
              <Text style={{ width: colWidths.no, color: 'white', fontWeight: '700', fontSize: 12 }}>{t('admin.reports.colNo')}</Text>
              <Text style={{ width: colWidths.reporter, color: 'white', fontWeight: '700', fontSize: 12 }}>{t('admin.reports.colReporter')}</Text>
              <Text style={{ width: colWidths.reported, color: 'white', fontWeight: '700', fontSize: 12 }}>{t('admin.reports.colReported')}</Text>
              <Text style={{ width: colWidths.message, color: 'white', fontWeight: '700', fontSize: 12 }}>{t('admin.reports.colMessage')}</Text>
              <Text style={{ width: colWidths.notes, color: 'white', fontWeight: '700', fontSize: 12 }}>{t('admin.reports.colNotes')}</Text>
              <Text style={{ width: colWidths.status, color: 'white', fontWeight: '700', fontSize: 12 }}>{t('admin.reports.colStatus')}</Text>
              <Text style={{ width: colWidths.date, color: 'white', fontWeight: '700', fontSize: 12, textAlign: 'right' }}>{t('admin.reports.colDate')}</Text>
            </View>
            {reports.length === 0 ? (
              <View style={{ padding: 24, backgroundColor: '#f9fafb', borderWidth: 1, borderTopWidth: 0, borderColor: '#e5e7eb', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                <Text style={{ color: '#6b7280', textAlign: 'center' }}>{t('admin.reports.empty')}</Text>
              </View>
            ) : (
              reports.map((r, i) => (
                <View
                  key={r.id}
                  style={{
                    flexDirection: 'row',
                    paddingVertical: 10,
                    paddingHorizontal: 8,
                    backgroundColor: i % 2 === 0 ? '#ffffff' : '#f9fafb',
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: '#e5e7eb',
                    ...(i === reports.length - 1 ? { borderBottomLeftRadius: 8, borderBottomRightRadius: 8 } : {}),
                  }}
                >
                  <Text style={{ width: colWidths.no, fontSize: 12, color: '#374151' }}>{i + 1}</Text>
                  <Text style={{ width: colWidths.reporter, fontSize: 12, color: '#374151' }} numberOfLines={2}>{fullName(r.reporter)}</Text>
                  <Text style={{ width: colWidths.reported, fontSize: 12, color: '#374151' }} numberOfLines={2}>{fullName(r.reported_user)}</Text>
                  <Text style={{ width: colWidths.message, fontSize: 12, color: '#374151' }} numberOfLines={2}>{r.content_preview || '-'}</Text>
                  <Text style={{ width: colWidths.notes, fontSize: 12, color: '#374151' }} numberOfLines={2}>{r.reason || '-'}</Text>
                  <TouchableOpacity
                    style={[{ width: colWidths.status, alignSelf: 'flex-start' }, getStatusStyle(r.status)]}
                    onPress={() => handleStatusPress(r)}
                    disabled={r.status !== 'pending'}
                    activeOpacity={r.status === 'pending' ? 0.7 : 1}
                  >
                    <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{getStatusDisplay(r.status)}</Text>
                  </TouchableOpacity>
                  <Text style={{ width: colWidths.date, fontSize: 11, color: '#6b7280', textAlign: 'right' }}>{formatDateTime(r.created_at)}</Text>
                </View>
              ))
            )}
          </View>
          </ScrollView>

          {/* İstatistikler: 1 satır, 2 sütun */}
          <View style={{ marginTop: 14, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: '#065f46' }}>
              <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.25)' }}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 12, textAlign: 'center' }}>
                  Toplam Kullanıcı Sayısı
                </Text>
              </View>
              <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 12 }}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 12, textAlign: 'center' }}>
                  Aktif Kullanıcı Sayısı
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', backgroundColor: '#ffffff' }}>
              <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRightWidth: 1, borderRightColor: '#e5e7eb' }}>
                <Text style={{ color: '#111827', fontWeight: '800', fontSize: 18, textAlign: 'center' }}>
                  {typeof totalUsers === 'number' ? totalUsers : '-'}
                </Text>
              </View>
              <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12 }}>
                <Text style={{ color: '#111827', fontWeight: '800', fontSize: 18, textAlign: 'center' }}>
                  {typeof activeUsers === 'number' ? activeUsers : '-'}
                </Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f9fafb', borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
              <Text style={{ color: '#6b7280', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
                Aktif kullanıcı sayısı, uygulamada anlık olarak çevrimiçi olan kullanıcıların sayısıdır.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Durum güncelleme modalı - renkli butonlar */}
      <Modal visible={!!statusModalReport} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          onPress={() => setStatusModalReport(null)}
        >
          <Pressable
            style={{ backgroundColor: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 340 }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 20, textAlign: 'center' }}>
              {t('admin.reports.changeStatusTitle')}
            </Text>
            <TouchableOpacity
              onPress={() => handleStatusUpdate('resolved')}
              style={{ backgroundColor: '#16a34a', borderRadius: 8, padding: 14, marginBottom: 10 }}
            >
              <Text style={{ color: 'white', fontWeight: '600', textAlign: 'center' }}>{t('admin.reports.statusResolved')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleStatusUpdate('rejected')}
              style={{ backgroundColor: '#dc2626', borderRadius: 8, padding: 14, marginBottom: 10 }}
            >
              <Text style={{ color: 'white', fontWeight: '600', textAlign: 'center' }}>{t('admin.reports.statusReviewed')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleStatusUpdate('checked')}
              style={{ backgroundColor: '#ea580c', borderRadius: 8, padding: 14, marginBottom: 16 }}
            >
              <Text style={{ color: 'white', fontWeight: '600', textAlign: 'center' }}>{t('admin.reports.statusChecked')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatusModalReport(null)}
              style={{ backgroundColor: '#9ca3af', borderRadius: 8, padding: 14 }}
            >
              <Text style={{ color: 'white', fontWeight: '600', textAlign: 'center' }}>{t('general.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
