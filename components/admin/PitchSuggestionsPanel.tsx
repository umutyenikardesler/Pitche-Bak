import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import PitchForm, { toPitchInput, type PitchFormValues } from '@/components/pitches/PitchForm';
import {
  approvePitchSuggestion,
  fetchPitchSuggestions,
  rejectPitchSuggestion,
  type PitchSuggestionRow,
} from '@/services/pitches';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';

function suggesterName(row: PitchSuggestionRow): string {
  const n = [row.users?.name, row.users?.surname].filter(Boolean).join(' ');
  return n || '-';
}

/**
 * Bekleyen saha önerileri. Öneri doğrudan sahaya dönüşmüyor: admin önce
 * düzenleme formunda eksikleri (özellikle koordinat) tamamlıyor, sonra onaylıyor.
 */
/** Klavye ile içerik arasında bırakılan pay. */
const KEYBOARD_GAP = 10;

type Props = {
  /** Kuyruk değişince (onay/ret) çağrılır; sekmedeki sayacı tazelemek için. */
  onChanged?: () => void;
};

export default function PitchSuggestionsPanel({ onChanged }: Props) {
  const { colors } = useAppTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  // Gövde klavye kadar kısalsın: form bütünüyle klavyenin üstünde kalıyor.
  const keyboardHeight = useKeyboardHeight();
  // Tam ekran modal durum çubuğunun altına uzanıyor (bkz. SuggestPitchModal).
  const safeTop = Platform.OS === 'web' ? 0 : insets.top;

  const [rows, setRows] = useState<PitchSuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PitchSuggestionRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await fetchPitchSuggestions('pending'));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reject = (row: PitchSuggestionRow) => {
    Alert.alert(t('admin.suggestions.rejectTitle'), row.name, [
      { text: t('general.cancel'), style: 'cancel' },
      {
        text: t('admin.suggestions.reject'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await rejectPitchSuggestion(row.id);
          if (error) Alert.alert(t('admin.pitches.failedTitle'), error.message);
          load();
          onChanged?.();
        },
      },
    ]);
  };

  const approve = async (values: PitchFormValues) => {
    if (!editing) return;
    setSubmitting(true);
    try {
      const { error } = await approvePitchSuggestion(editing.id, toPitchInput(values));
      if (error) {
        Alert.alert(t('admin.pitches.failedTitle'), error.message);
        return;
      }
      setEditing(null);
      Alert.alert(t('admin.pitches.addedTitle'), t('admin.pitches.addedBody'));
      load();
      onChanged?.();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />;
  }

  return (
    <View>
      {rows.length === 0 ? (
        <Text className="text-center py-6" style={{ color: colors.textMuted }}>
          {t('admin.suggestions.empty')}
        </Text>
      ) : (
        rows.map((row) => (
          <View
            key={row.id}
            className="rounded-lg p-3 mb-3"
            style={{ backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}
          >
            <Text className="font-bold text-base" style={{ color: colors.text }}>
              {row.name}
            </Text>
            <Text className="text-sm mt-0.5" style={{ color: colors.textSecondary }}>
              {(row.districts?.name || t('admin.suggestions.noDistrict')) +
                (row.address ? ' · ' + row.address : '')}
            </Text>
            <Text className="text-xs mt-1" style={{ color: colors.textMuted }}>
              {t('admin.suggestions.by')}: {suggesterName(row)}
              {row.latitude == null ? ' · ' + t('admin.suggestions.noCoords') : ''}
            </Text>

            <View className="flex-row mt-3">
              <TouchableOpacity
                onPress={() => setEditing(row)}
                className="flex-row items-center justify-center rounded-lg py-2 flex-1 mr-1"
                style={{ backgroundColor: colors.primary }}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="white" />
                <Text className="text-white font-semibold ml-1">
                  {t('admin.suggestions.review')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => reject(row)}
                className="flex-row items-center justify-center rounded-lg py-2 flex-1 ml-1"
                style={{ backgroundColor: colors.danger }}
              >
                <Ionicons name="close-circle-outline" size={18} color="white" />
                <Text className="text-white font-semibold ml-1">
                  {t('admin.suggestions.reject')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Onay öncesi düzenleme */}
      {/* presentationStyle="overFullScreen": bkz. SuggestPitchModal. */}
      <Modal
        visible={!!editing}
        animationType="slide"
        presentationStyle="overFullScreen"
        onRequestClose={() => setEditing(null)}
      >
        {/* Stiller satır içi: bkz. SuggestPitchModal. */}
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            // Klavyenin tam üstüne yapışmasın (bkz. SuggestPitchModal).
            paddingBottom: keyboardHeight ? keyboardHeight + KEYBOARD_GAP : 0,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingBottom: 12,
              backgroundColor: colors.primary,
              paddingTop: safeTop + 12,
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 18 }}>
              {t('admin.suggestions.reviewTitle')}
            </Text>
            <TouchableOpacity onPress={() => setEditing(null)}>
              <Ionicons name="close" size={26} color="white" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          >
            {editing && (
              <PitchForm
                variant="admin"
                submitting={submitting}
                submitLabel={t('admin.suggestions.approve')}
                initial={{
                  name: editing.name,
                  districtId: editing.district_id,
                  address: editing.address ?? '',
                  phone: editing.phone ?? '',
                  price: editing.price != null ? String(editing.price) : '',
                  features: editing.features ?? [],
                  latitude: editing.latitude,
                  longitude: editing.longitude,
                }}
                onSubmit={approve}
              />
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
