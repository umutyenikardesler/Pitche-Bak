import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type {
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { withLayoutContext } from 'expo-router';

/**
 * Sekmeleri kaydırarak geçilebilir hale getiren navigatör (Instagram'daki gibi).
 *
 * `@react-navigation/bottom-tabs` kaydırmayı desteklemiyor; material-top-tabs
 * ise altta `react-native-pager-view` kullandığı için sayfa parmağı birebir
 * takip ediyor ve yarıda bırakılınca geri yaslanıyor.
 *
 * `tabBarPosition="bottom"` ile çubuk alta alınıyor ve `tabBar` ile kendi
 * yüzen cam menümüz çiziliyor; navigatörün kendi çubuğu kullanılmıyor.
 *
 * NOT: material-top-tabs header ÇİZMEZ. Header (bkz. app/(tabs)/_layout.tsx)
 * navigatörün üstünde elle render ediliyor.
 */
const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);
