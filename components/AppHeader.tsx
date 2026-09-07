import { DeviceEventEmitter, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomHeader from '@/components/CustomHeader';
import { useAppTheme } from '@/contexts/ThemeContext';
import { headerTotalHeight } from '@/constants/header';

/**
 * Uygulama header'ı (durum çubuğu payı + CustomHeader + yeşil alt çizgi).
 *
 * Kaydırmalı sekme navigatörü (material-top-tabs) header çizmediği için header
 * elle render ediliyor. Aynı bileşen, sekme grubunun dışına taşınan
 * ekranlarda da (ör. bildirimler) kullanılıyor; böylece header ölçüsü ve
 * görünümü tek yerden geliyor (bkz. constants/header.ts).
 */
export default function AppHeader({
  title,
  showNotificationIcon = true,
}: {
  title: string;
  showNotificationIcon?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  return (
    <View
      style={{
        height: headerTotalHeight(insets.top),
        paddingTop: insets.top,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.primary,
        justifyContent: 'center',
      }}
    >
      <CustomHeader
        title={title}
        showNotificationIcon={showNotificationIcon}
        // Başlığa dokunma davranışı sekme düzenindekiyle aynı: açık modalları kapat.
        onTitlePress={() => DeviceEventEmitter.emit('closeModals')}
      />
    </View>
  );
}
