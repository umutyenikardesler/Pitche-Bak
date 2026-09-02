import { useContext } from 'react';
import { Platform } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_HEIGHT, floatingTabBarBottomOffset } from '@/constants/tabBar';

/**
 * iOS'ta tab bar, Liquid Glass efekti için ekranın üzerinde yüzen bir çubuk olarak
 * `position: absolute` konumlanır; bu sayede içerik camın altından akar ve efekt
 * gerçek görünür. Karşılığında kaydırılabilir listelerin sonu bar'ın arkasında kalabilir.
 *
 * Bu hook, ilgili ekranın kaydırma kabına eklenmesi gereken alt boşluğu döndürür.
 * Tab navigator dışında (ör. modal içinde) 0 döner, bu yüzden her yerde güvenle kullanılabilir.
 */
export function useTabBarBottomInset(): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();

  if (Platform.OS !== 'ios') return 0;
  // Tab navigator dışında bar yok; boşluk da gerekmez.
  if (tabBarHeight === undefined) return 0;

  // Bar'ın yüksekliği + ekran altına olan mesafesi + son kartın cama yapışmaması için pay.
  return FLOATING_TAB_BAR_HEIGHT + floatingTabBarBottomOffset(insets.bottom) + 8;
}
