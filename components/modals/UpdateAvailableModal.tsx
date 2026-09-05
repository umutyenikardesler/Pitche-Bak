import { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppTheme } from '@/contexts/ThemeContext';
import { checkForAppUpdate } from '@/services/appUpdate';

/**
 * Uygulama açılışında mağazada daha yeni bir sürüm varsa ekranın ortasında
 * gösterilen uyarı. Boşluğa dokununca kapanır (zorunlu güncelleme değil).
 *
 * Yalnızca uygulama başına bir kez gösterilir; kapatıldıktan sonra o oturumda
 * tekrar açılmaz.
 */
export default function UpdateAvailableModal() {
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const [releaseNotes, setReleaseNotes] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    checkForAppUpdate()
      .then((info) => {
        if (!active) return;
        if (info.updateAvailable !== true) return;
        setLatestVersion(info.latestVersion);
        setStoreUrl(info.storeUrl);
        setReleaseNotes(info.releaseNotes);
        setVisible(true);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleOpenStore = () => {
    if (!storeUrl) return;
    Linking.openURL(storeUrl).catch(() => {});
    setVisible(false);
  };

  const storeButtonLabel =
    Platform.OS === 'android'
      ? t('update.goToPlayStore')
      : t('update.goToAppStore');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
      presentationStyle="overFullScreen"
    >
      {/* Boşluğa dokununca kapanır. */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setVisible(false)}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
      >
        {/* Kartın kendisine dokunuş kapatmasın. */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: 16,
            padding: 22,
            alignItems: 'center',
            backgroundColor: colors.surface,
            // Uygulamadaki diğer kartlarla aynı yeşil ışıltı.
            borderWidth: 1,
            borderColor: colors.primary,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 6,
            elevation: 6,
          }}
        >
          <Ionicons name="rocket-outline" size={40} color={colors.primary} />

          <Text
            style={{
              marginTop: 12,
              fontSize: 18,
              fontWeight: '700',
              textAlign: 'center',
              color: colors.primaryDark,
            }}
          >
            {t('update.title')}
          </Text>

          <Text
            style={{
              marginTop: 10,
              fontSize: 14,
              lineHeight: 21,
              textAlign: 'center',
              color: colors.textSecondary,
            }}
          >
            {/* Tabloya (app_versions.release_notes) özel metin girildiyse o
                gösterilir; yoksa varsayılan açıklama kullanılır. */}
            {releaseNotes?.trim()
              ? releaseNotes.trim()
              : latestVersion
                ? t('update.descriptionWithVersion').replace('{version}', latestVersion)
                : t('update.description')}
          </Text>

          <TouchableOpacity
            onPress={handleOpenStore}
            activeOpacity={0.85}
            disabled={!storeUrl}
            style={{
              marginTop: 18,
              alignSelf: 'stretch',
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingVertical: 13,
              alignItems: 'center',
              opacity: storeUrl ? 1 : 0.5,
            }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
              {storeButtonLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setVisible(false)}
            activeOpacity={0.7}
            style={{ marginTop: 12, paddingVertical: 4 }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {t('update.later')}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
