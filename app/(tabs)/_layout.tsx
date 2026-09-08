import { Tabs, usePathname } from "expo-router";
import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomHeader from "@/components/CustomHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotification } from "@/components/NotificationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestAuthAlert } from "@/contexts/GuestAuthModalContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { Animated, DeviceEventEmitter, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { MaterialTopTabs } from '@/components/navigation/MaterialTopTabs';
import AppHeader from '@/components/AppHeader';
import { FloatingTabBarContext } from '@/contexts/FloatingTabBarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  FLOATING_TAB_BAR_HEIGHT,
  FLOATING_TAB_BAR_RADIUS,
  FLOATING_TAB_BAR_SIDE_MARGIN,
  floatingTabBarBottomOffset,
} from '@/constants/tabBar';
import { headerTotalHeight } from '@/constants/header';

/**
 * `expo-glass-effect` native bir modüldür ve yalnızca onu içeren bir build'de bulunur.
 * Modülü içermeyen build'lerde import anında hata fırlatır (native view manager modül
 * seviyesinde çözülüyor). Bu yüzden tembel ve korumalı yüklüyoruz: modül ya da Liquid
 * Glass yoksa `null` döner ve arayüz otomatik olarak BlurView'a düşer.
 */
type GlassModule = typeof import('expo-glass-effect');
let glassModuleCache: GlassModule | null | undefined;

function resolveLiquidGlass(): GlassModule | null {
  if (glassModuleCache === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- statik import, modülü içermeyen build'lerde çöker
      glassModuleCache = require('expo-glass-effect') as GlassModule;
    } catch {
      glassModuleCache = null;
    }
  }
  if (!glassModuleCache) return null;
  try {
    return glassModuleCache.isLiquidGlassAvailable() ? glassModuleCache : null;
  } catch {
    return null;
  }
}

/** Tab ikonu: hazır ikon seti + adı, ya da tamamen özel bir render (ör. badge'li ikon). */
type IconSpec =
  | { family: 'ionicons'; name: ComponentProps<typeof Ionicons>['name'] }
  | { family: 'material'; name: ComponentProps<typeof MaterialIcons>['name'] }
  | { render: (args: { focused: boolean; color: string }) => ReactNode };

export default function TabsLayout() {
  const { t } = useLanguage();
  const { isGuest } = useAuth();
  const { showGuestAuthAlert } = useGuestAuthAlert();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const isIos = Platform.OS === 'ios';

  // CustomHeader başlık tıklaması için fonksiyon
  const handleTitlePress = () => {
    console.log('Tab layout CustomHeader başlığına tıklandı');
    // Modal'ları kapatmak için event gönder
    DeviceEventEmitter.emit('closeModals');
  };

  // Tab bar stilleri
  // iOS: eski hali (sadece safe area). Android: ek alttan iç boşluk.
  const tabBarBaseHeight = 52;
  const tabBarBottomInset = Math.max(insets.bottom, 8);
  const tabBarInnerBottomAndroid = 12;
  const tabBarExtraBottom = isWeb ? 0 : isIos ? 0 : tabBarInnerBottomAndroid;
  const tabBarHeight = isWeb
    ? 84
    : isIos
      ? FLOATING_TAB_BAR_HEIGHT
      : tabBarBaseHeight + tabBarBottomInset + tabBarExtraBottom;
  const tabBarStyles = StyleSheet.create({
    tabBar: {
      // iOS'ta cam efektinin altındaki içerik görünsün diye bar saydam;
      // arka planı `tabBarBackground` içindeki cam/blur katmanı çiziyor.
      backgroundColor: isIos ? 'transparent' : colors.surface,
      height: tabBarHeight,
      // Yüzen barda safe-area boşluğu bar'ın İÇİNDE değil, ALTINDA duruyor.
      // iOS'ta alt dolgu üst dolgudan fazla: ikon + etiket hap içinde bir tık yukarıda dursun.
      paddingBottom: isWeb ? 10 : isIos ? 9 : tabBarBottomInset + tabBarExtraBottom,
      // marginBottom verme: altta gri şerit (arka plan görünür)
      marginBottom: 0,
      paddingTop: isWeb ? 6 : isIos ? 3 : 8,
      elevation: isIos ? 0 : 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: isIos ? 0 : 0.1,
      shadowRadius: 4
    },
    // iOS: ekranın altından ayrık, yuvarlak kenarlı yüzen "hap" çubuk.
    tabBarIosGlass: {
      position: 'absolute',
      // NOT: kütüphanenin taban stili `start: 0 / end: 0` kullanıyor ve RN'de mantıksal
      // özellikler `left`/`right`'ı ezer. Bu yüzden yan boşluğu marginHorizontal ile veriyoruz.
      marginHorizontal: FLOATING_TAB_BAR_SIDE_MARGIN,
      bottom: floatingTabBarBottomOffset(insets.bottom),
      borderRadius: FLOATING_TAB_BAR_RADIUS,
      // Marka rengi ince kenarlık. `borderTopWidth` ayrıca veriliyor: kütüphanenin taban
      // stili üst kenara hairline koyuyor ve daha özel olduğu için `borderWidth`i ezerdi.
      borderWidth: 1,
      borderTopWidth: 1,
      borderColor: '#16a34a',
      // Dışa vuran yeşil ışıltı (offset yok, sadece yayılım).
      shadowColor: '#16a34a',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
    },
    // Cam katmanı bar'ın hap şekline kırpılsın.
    // NOT: Kenarlık ve ışıltı bilerek burada değil, bar'ın kendisinde. Bu katmanda
    // `overflow: 'hidden'` var ve iOS'ta clipsToBounds gölgeyi de kırptığı için
    // ışıltı burada görünmezdi.
    tabBarGlassClip: {
      borderRadius: FLOATING_TAB_BAR_RADIUS,
      overflow: 'hidden',
    },
    tabBarBg: {
      flex: 1,
      backgroundColor: colors.surface
    },
    tabBarTopLine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: '#16a34a'
    },
    tabBarLabel: {
      fontWeight: "700",
      fontSize: 10.5,
      marginTop: 2,
      letterSpacing: 0.2,
      // Web'de tab item'lar çok shrink olunca label görünmeyebiliyor
      flexShrink: 0,
    },
    // Yüzen bar daha dar olduğu için 5 etiketin sığması adına yazı ve aralıklar kısılıyor.
    tabBarLabelIos: {
      fontWeight: "700",
      fontSize: 9,
      marginTop: 1,
      letterSpacing: -0.2,
    },
    tabBarItemIos: {
      paddingVertical: 0,
      paddingHorizontal: 0,
      minWidth: 0,
      marginHorizontal: 0,
    },
    tabBarItem: {
      // Mobil: mevcut davranışı bozma
      // Web: her item'a yeterli genişlik ver ki label render edilebilsin
      ...(isWeb
        ? {
            flex: 1,
            flexBasis: 0,
            minWidth: 84,
            paddingVertical: 4,
            paddingHorizontal: 6,
            marginHorizontal: 0,
          }
        : {
            paddingVertical: 2,
            paddingHorizontal: 0,
            minWidth: 0,
            marginHorizontal: 0,
          }),
    }
  });

  // Tüm tab'larda ortak olan tab bar görünümü.
  // iOS 26+: sistemin gerçek Liquid Glass malzemesi (UIGlassEffect).
  // Daha eski iOS: en yakın görünüm olarak sistem "chrome material" blur'u.
  // Diğer platformlar: düz yüzey rengi.
  const renderTabBarBackground = () => {
    if (!isIos) {
      return (
        <View style={tabBarStyles.tabBarBg} pointerEvents="none">
          <View style={tabBarStyles.tabBarTopLine} />
        </View>
      );
    }

    const glass = resolveLiquidGlass();

    // Yüzen hap görünümünde yeşil üst çizgi yok; cam yüzey tek parça kalıyor.
    return (
      <View style={[StyleSheet.absoluteFill, tabBarStyles.tabBarGlassClip]} pointerEvents="none">
        {glass ? (
          <glass.GlassView
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            colorScheme={isDark ? 'dark' : 'light'}
          />
        ) : (
          <BlurView
            tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            intensity={100}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>
    );
  };

  const tabBarStyle = isIos ? [tabBarStyles.tabBar, tabBarStyles.tabBarIosGlass] : tabBarStyles.tabBar;

  /**
   * Sekme butonu: seçili sekmenin İKON + ETİKETİNİN arkasına açık yeşil bir
   * zemin çizer. Varsayılan buton bunu desteklemediği için değiştiriliyor.
   *
   * Gelen props (onPress, accessibilityState, testID vb.) olduğu gibi
   * aktarılıyor; aksi halde misafir kontrolü (tabPress listener) ve
   * erişilebilirlik davranışı bozulurdu.
   */
  const renderTabBarButton = (props: BottomTabBarButtonProps) => {
    const { children, style, accessibilityState, ...rest } = props;
    const focused = accessibilityState?.selected ?? false;

    return (
      <Pressable
        {...(rest as any)}
        accessibilityState={accessibilityState}
        style={[{ flex: 1, alignItems: 'center', justifyContent: 'center' }, style as any]}
      >
        <View
          style={[
            {
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            },
            focused
              ? {
                  // Koyu modda açık yeşil fazla parlak kalıyor; saydam yeşil
                  // cam yüzeye daha iyi oturuyor.
                  backgroundColor: isDark ? 'rgba(22,163,74,0.30)' : '#dcfce7',
                }
              : null,
          ]}
        >
          {children}
        </View>
      </Pressable>
    );
  };

  /**
   * Kaydırmalı navigatördeki sekmeler. Sıra hem pager'daki hem çubuktaki sırayı
   * belirler. `guard` verilen sekmeler misafire kapalı.
   */
  const SWIPE_TABS: {
    name: string;
    label: string;
    title: string;
    icon: IconSpec;
    guard?: string;
    onPress?: () => void;
  }[] = [
    {
      name: 'index',
      // Tab etiketi ile header başlığı bu ekranda kasıtlı olarak farklı
      label: t('home.findMatch'),
      title: t('home.title'),
      icon: { family: 'ionicons', name: 'search-outline' },
      onPress: () => DeviceEventEmitter.emit('closeModals'),
    },
    {
      name: 'pitches',
      label: t('pitches.title'),
      title: t('pitches.title'),
      icon: { family: 'ionicons', name: 'navigate-circle-outline' },
      onPress: () => DeviceEventEmitter.emit('closePitchDetail'),
    },
    {
      name: 'create',
      label: t('create.title'),
      title: t('create.title'),
      icon: { family: 'material', name: 'add-circle-outline' },
      guard: 'auth.guestCreateMatch',
    },
    {
      name: 'message',
      label: t('messages.title'),
      title: t('messages.title'),
      icon: { render: ({ focused, color }) => <MessagesTabIcon focused={focused} color={color} /> },
      guard: 'auth.guestMessage',
    },
    {
      name: 'profile',
      label: t('profile.title'),
      title: t('profile.title'),
      icon: { family: 'ionicons', name: 'person-circle-outline' },
      guard: 'auth.guestProfile',
    },
  ];

  /**
   * Header: material-top-tabs header çizmediği için elle render ediliyor.
   * Ölçüler constants/header.ts'ten geliyor; böylece açılış animasyonundaki
   * logo hedefiyle aynı hesabı paylaşıyor.
   */
  const SwipeTabsHeader = () => {
    const pathname = usePathname();
    const active =
      SWIPE_TABS.find((tab) =>
        tab.name === 'index' ? pathname === '/' : pathname.startsWith(`/${tab.name}`)
      ) ?? SWIPE_TABS[0];

    return <AppHeader title={active.title} />;
  };

  /**
   * Yüzen cam menü. Seçili sekmenin arkasındaki açık yeşil zemin `position`
   * ile sürülüyor: kaydırdıkça zemin de parmakla birlikte komşu sekmeye kayar.
   */
  const SwipeTabBar = ({ state, position, layout, jumpTo }: MaterialTopTabBarProps) => {
    // Genişlik `onLayout` ile ölçülmüyor: kütüphane zaten pager genişliğini
    // (`layout`) veriyor ve çubuk ondan yalnızca yan boşluk kadar dar. Ölçüme
    // dayanmak ilk render'da genişliği 0 bırakıyor, dolayısıyla zeminin
    // interpolasyonu da sıfır çıkıyordu.
    // Sekme butonlarının paylaştığı alan, çubuğun İÇ genişliği: ekran genişliği
    // eksi yan boşluklar EKSİ 1px'lik kenarlıklar. Kenarlık hesaba katılmazsa
    // `itemWidth` bir tık büyük çıkıyor ve zemin her sekmede biraz daha sağa
    // kayarak son sekmede (profil) gözle görülür şekilde şaşıyor.
    const barBorder = isIos ? 2 : 0;
    const barWidth = isIos
      ? Math.max(layout.width - FLOATING_TAB_BAR_SIDE_MARGIN * 2 - barBorder, 0)
      : layout.width;
    const count = state.routes.length;
    const itemWidth = count > 0 ? barWidth / count : 0;
    // Zeminin ikon + etiket bloğuna her yönden yakın durması için: yatayda
    // daraltılıyor, dikeyde ise çubuğun dolgu kutusunun tamamına yayılıyor.
    // Etiket genişlikleri sekmeden sekmeye değiştiği için birebir sarma
    // mümkün değil; bu iki sayı ile denge kuruluyor.
    // Dört kenar ayrı ayarlanıyor: üst oturmuş durumda, sağ 3px, sol ve alt ise
    // 4px genişletildi. Küçük değer = zemin o yönde daha geniş; negatif değer,
    // zeminin çubuğun dolgusuna doğru taştığı anlamına gelir.
    /** "Maç Oluştur" sekmesinde zeminin her yandan fazladan genişliği. */
    const PILL_EXTRA_X_CREATE = 3;
    const PILL_INSET_LEFT = 9;
    const PILL_INSET_RIGHT = 10;
    const PILL_INSET_TOP = 1;
    const PILL_INSET_BOTTOM = -3;
    const pillWidth = Math.max(itemWidth - PILL_INSET_LEFT - PILL_INSET_RIGHT, 0);

    /**
     * Zeminin konumu (sekme indexi cinsinden). İKİ kaynaktan besleniyor:
     *
     *  1. `position` dinleyicisi — kaydırma sırasında parmağı birebir takip
     *     etmek için. Bu kaynak kaydırmada doğru çalışıyor.
     *  2. `state.index` — DOKUNARAK geçişte `position` yeni index'e gitmiyor
     *     (bir önceki değerde kalıyor) ve zemin bir sekme geride kalıyordu.
     *     Bu yüzden index her değiştiğinde zemin doğru sekmeye ayrıca sürülüyor.
     *
     * İki kaynak da aynı hedefe koştuğu için çakışmıyorlar: kaydırma bittiğinde
     * index de zaten aynı değere geliyor.
     */
    const pillIndex = useRef(new Animated.Value(state.index)).current;

    useEffect(() => {
      const id = position.addListener(({ value }) => pillIndex.setValue(value));
      return () => position.removeListener(id);
    }, [position, pillIndex]);

    useEffect(() => {
      Animated.timing(pillIndex, {
        toValue: state.index,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }, [state.index, pillIndex]);

    return (
      <View
        style={[
          {
            flexDirection: 'row',
            height: isIos ? FLOATING_TAB_BAR_HEIGHT : tabBarHeight,
            backgroundColor: isIos ? 'transparent' : colors.surface,
            paddingBottom: isIos ? 9 : tabBarBottomInset + tabBarExtraBottom,
            paddingTop: isIos ? 3 : 8,
            // Android'de menü yüzmüyor, ekranın altına sabit oturuyor; içerikten
            // ayrılsın diye üst kenarına marka rengi çizgi. (iOS'ta bu iş
            // hap çubuğun kendi çepeçevre kenarlığıyla zaten yapılıyor.)
            ...(isIos ? null : { borderTopWidth: 2, borderTopColor: '#16a34a' }),
          },
          // `tabBarIosGlass` position:absolute veriyor ama yatay sınır vermiyor:
          // bottom-tabs kullanırken bunu kütüphanenin taban stili (start/end: 0)
          // sağlıyordu. Kendi çubuğumuzda o taban stil olmadığı için sınırı
          // burada veriyoruz; yoksa çubuk sıfır genişlikte bir çizgiye düşüyor.
          isIos ? [tabBarStyles.tabBarIosGlass, { left: 0, right: 0 }] : null,
        ]}
      >
        {isIos ? renderTabBarBackground() : null}

        {/* Kaydırmayı takip eden yeşil zemin. */}
        {itemWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: (isIos ? 3 : 8) + PILL_INSET_TOP,
              bottom: (isIos ? 9 : tabBarBottomInset + tabBarExtraBottom) + PILL_INSET_BOTTOM,
              // Sol ve sağ payı farklı olabildiği için ortalama yerine doğrudan
              // sol pay veriliyor.
              left: PILL_INSET_LEFT,
              width: pillWidth,
              borderRadius: 14,
              // Saydam siyah zemin. Koyu modda siyah, koyu yüzeyde kaybolacağı
              // için orada aynı yoğunlukta beyaza dönülüyor.
              // Açık yeşil zemin. Koyu modda düz açık yeşil cam yüzeyde fazla
              // parlak kaldığı için saydam marka yeşili kullanılıyor.
              backgroundColor: isDark ? 'rgba(22,163,74,0.30)' : '#dcfce7',
              // Kütüphanenin kendi göstergesiyle aynı yöntem (bkz.
              // react-native-tab-view/TabBarIndicator): `position` doğrudan
              // interpolate ediliyor. `Animated.multiply` ile sürülünce zemin
              // kaydırma boyunca hareket etmiyordu.
              transform: [
                {
                  translateX: pillIndex.interpolate({
                    inputRange: state.routes.map((_, i) => i),
                    outputRange: state.routes.map((_, i) => i * itemWidth),
                    extrapolate: 'clamp',
                  }),
                },
                {
                  // Bazı sekmelerde zemin biraz daha geniş olsun (ör. "Maç
                  // Oluştur"). Genişliği doğrudan animasyonla değiştiremiyoruz:
                  // `position` native sürücüyle çalışıyor ve native sürücü
                  // yalnızca transform/opacity destekliyor. Kütüphanenin kendi
                  // göstergesi de aynı nedenle scaleX kullanıyor.
                  // scaleX merkezden büyüttüğü için fazlalık iki yana eşit dağılır.
                  scaleX: pillIndex.interpolate({
                    inputRange: state.routes.map((_, i) => i),
                    outputRange: state.routes.map((_, i) =>
                      pillWidth > 0
                        ? (pillWidth + (state.routes[i].name === 'create' ? PILL_EXTRA_X_CREATE * 2 : 0)) /
                          pillWidth
                        : 1
                    ),
                    extrapolate: 'clamp',
                  }),
                },
              ],
            }}
          />
        )}

        {state.routes.map((route, index) => {
          const tab = SWIPE_TABS.find((it) => it.name === route.name) ?? SWIPE_TABS[index];
          if (!tab) return null;
          const focused = state.index === index;
          const color = focused ? '#059669' : isDark ? '#d1d5db' : '#374151';

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              onPress={() => {
                if (tab.guard && isGuest) {
                  showGuestAuthAlert(t(tab.guard));
                  return;
                }
                tab.onPress?.();
                // `navigation.navigate` yerine `jumpTo`: navigate yalnızca
                // navigasyon durumunu değiştiriyor, pager'ın `position` değerini
                // sürmüyordu; bu yüzden dokunarak geçişte zemin bir sekme geride
                // kalıyordu. Kütüphanenin kendi çubuğu da jumpTo kullanıyor.
                if (!focused) jumpTo(route.key);
              }}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              {renderTabIcon(tab.icon, { focused, color })}
              <Text style={[tabBarStyles.tabBarLabelIos, { color, marginTop: 1 }]} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const sharedTabBarOptions = {
    tabBarActiveTintColor: "#059669",
    tabBarInactiveTintColor: isDark ? "#d1d5db" : "#374151",
    tabBarStyle,
    tabBarItemStyle: isIos ? tabBarStyles.tabBarItemIos : tabBarStyles.tabBarItem,
    tabBarBackground: renderTabBarBackground,
    tabBarButton: renderTabBarButton,
    ...(isIos ? { tabBarLabelStyle: tabBarStyles.tabBarLabelIos } : {}),
  };

  // Web'de header'ı kendimiz sarmak zorundayız; mobilde headerTitle yeterli.
  const headerOptions = (title: string) =>
    isWeb
      ? {
          header: () => (
            <View style={{ width: '100%', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.primary }}>
              <CustomHeader title={title} onTitlePress={handleTitlePress} />
            </View>
          ),
        }
      : {
          headerTitle: () => <CustomHeader title={title} onTitlePress={handleTitlePress} />,
          // React Navigation'ın başlık kapsayıcısı varsayılan olarak İÇERİK
          // KADAR genişleyip sol/sağ boş kapsayıcılar arasında ortalanır
          // (marginHorizontal: 16 + maxWidth). Bu yüzden CustomHeader ekran
          // genişliğini göremiyor, logo da kapsayıcının sol kenarına göre
          // konumlanınca sağa kayıyordu. Kapsayıcıyı tam genişliğe zorluyoruz
          // ki %25-%50-%25 düzeni gerçek ekran genişliğine göre çalışsın.
          headerTitleContainerStyle: {
            flexGrow: 1,
            flexBasis: 0,
            maxWidth: '100%' as const,
            marginHorizontal: 0,
          },
          headerLeftContainerStyle: { flexGrow: 0, flexBasis: 0, width: 0 },
          headerRightContainerStyle: { flexGrow: 0, flexBasis: 0, width: 0 },
        };

  const renderTabIcon = (icon: IconSpec, { focused, color }: { focused: boolean; color: string }) => {
    if ('render' in icon) return icon.render({ focused, color });
    const size = focused ? 28 : 22;
    // 3px: ikonlar yeşil zeminin içinde bir tık aşağıda dursun.
    const style = { marginTop: 3 };
    return icon.family === 'ionicons' ? (
      <Ionicons name={icon.name} color={color} size={size} style={style} />
    ) : (
      <MaterialIcons name={icon.name} color={color} size={size} style={style} />
    );
  };

  /**
   * Tek bir tab'ın options'ını üretir.
   * headerTitle verilmezse label başlık olarak kullanılır (index hariç hepsi böyle).
   * hidden: true -> tab bar'da görünmez (href: null) ama route erişilebilir kalır.
   */
  const makeTabOptions = ({
    label,
    headerTitle,
    icon,
    hidden,
  }: {
    label: string;
    headerTitle?: string;
    icon: IconSpec;
    hidden?: boolean;
  }) => ({
    ...sharedTabBarOptions,
    tabBarLabel: label,
    ...headerOptions(headerTitle ?? label),
    tabBarIcon: (props: { focused: boolean; color: string }) => renderTabIcon(icon, props),
    ...(hidden ? { href: null } : {}),
  });

  // Misafir kullanıcıya kapalı tab'lar için ortak listener
  const guestBlockedListeners = (alertKey: string) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      if (isGuest) {
        e.preventDefault();
        showGuestAuthAlert(t(alertKey));
      }
    },
  });

  // Mesaj sekmesi için badge'li ikon
  const MessagesTabIcon = ({ focused, color }: { focused: boolean; color: string }) => {
    const { messageCount } = useNotification();

    return (
      <View style={{ position: 'relative' }}>
        <Ionicons
          name="paper-plane-outline"
          color={color}
          size={focused ? 28 : 22}
          // Diğer sekme ikonlarıyla aynı hizada kalmalı (bkz. renderTabIcon).
          style={{ marginTop: 3 }}
        />
        {messageCount > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -10,
              backgroundColor: 'red',
              borderRadius: 10,
              minWidth: 18,
              height: 18,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: 'white', fontSize: 11, fontWeight: 'bold' }}>
              {messageCount}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    isWeb ? (
    <Tabs
      // Web'de per-screen `tabBarShowLabel` bazı durumlarda uygulanmıyor.
      // Mobil davranışını bozmamak için bunu SADECE web'de navigator seviyesinde zorluyoruz.
      screenOptions={{
        sceneStyle: {
          backgroundColor: colors.background,
          // iOS'ta sahneye alt boşluk VERMİYORUZ: içerik cam bar'ın altından aksın diye.
          // Listelerin sonu bar'ın arkasında kalmasın diye ilgili kaydırma kapları
          // `useTabBarBottomInset()` ile kendi alt boşluğunu ekliyor.
        },
        headerStyle: {
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.primary,
          // Yükseklik açıkça veriliyor: varsayılan hesap Dynamic Island'lı
          // cihazlarda içerik alanını ~5px daraltıyor ve logonun konumunu
          // hesaplanamaz kılıyordu (bkz. constants/header.ts).
          ...(isWeb ? {} : { height: headerTotalHeight(insets.top) }),
        },
        headerShadowVisible: false,
        ...(isWeb
          ? {
              tabBarShowLabel: true,
              tabBarLabelPosition: 'below-icon' as const,
              tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '700' as const,
                marginTop: 2,
              },
            }
          : {}),
      }}
    >
      <Tabs.Screen
        name="index"
        options={makeTabOptions({
          // Tab etiketi ile header başlığı bu ekranda kasıtlı olarak farklı
          label: t('home.findMatch'),
          headerTitle: t('home.title'),
          icon: { family: 'ionicons', name: 'search-outline' },
        })}
        listeners={{
          tabPress: () => {
            // Index tab'ına basıldığında (özellikle MatchDetails açıkken)
            // açık olan modal/detayları kapatmak için event gönder.
            DeviceEventEmitter.emit('closeModals');
          },
        }}
      />
      <Tabs.Screen
        name="pitches"
        options={makeTabOptions({
          label: t('pitches.title'),
          icon: { family: 'ionicons', name: 'navigate-circle-outline' },
        })}
        listeners={{
          tabPress: () => {
            // Sahalar tabına basıldığında saha detayını kapat
            DeviceEventEmitter.emit('closePitchDetail');
          },
        }}
      />
      <Tabs.Screen
        name="create"
        listeners={guestBlockedListeners('auth.guestCreateMatch')}
        options={makeTabOptions({
          label: t('create.title'),
          icon: { family: 'material', name: 'add-circle-outline' },
        })}
      />
      <Tabs.Screen
        name="message"
        listeners={guestBlockedListeners('auth.guestMessage')}
        options={makeTabOptions({
          label: t('messages.title'),
          icon: { render: ({ focused, color }) => <MessagesTabIcon focused={focused} color={color} /> },
        })}
      />
      <Tabs.Screen
        name="profile"
        listeners={guestBlockedListeners('auth.guestProfile')}
        options={makeTabOptions({
          label: t('profile.title'),
          icon: { family: 'ionicons', name: 'person-circle-outline' },
        })}
      />
    </Tabs>
    ) : (
      /**
       * Native: sekmeler kaydırarak geçilebilir (bkz.
       * components/navigation/MaterialTopTabs.tsx). Header bu navigatörde
       * bulunmadığı için üstte elle çiziliyor; alttaki yüzen cam menü de
       * `tabBar` ile bizim bileşenimiz.
       *
       * Web bu daldan geçmiyor: `react-native-pager-view` web'i desteklemiyor,
       * o yüzden web tarafı yukarıdaki bottom-tabs ile kalıyor.
       */
      // Ekranların alt boşluğu (menünün altında kalmamaları için) bu context'ten
      // besleniyor; bkz. hooks/useTabBarBottomInset.ts.
      <FloatingTabBarContext.Provider value>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <SwipeTabsHeader />
        <MaterialTopTabs
          tabBarPosition="bottom"
          tabBar={(props) => <SwipeTabBar {...props} />}
          screenOptions={{
            swipeEnabled: true,
            // Ekranlar ilk kez odaklanınca mount edilsin. Varsayılanda pager
            // BEŞ ekranı birden açılışta render ediyor; bu hem başlangıcı
            // yavaşlatıyor hem de ekranların mount anındaki yan etkilerini
            // (ör. Maç Oluştur'daki uyarı modalı) siz o sekmeye girmeden
            // tetikliyordu.
            lazy: true,
            // Komşu ekran önceden hazırlansın: yalnızca `lazy` ile kaydırma
            // sırasında henüz mount olmamış ekran bir an boş görünüyordu.
            // Önceden render edilen ekranın mount yan etkileri sorun çıkarmaz,
            // çünkü ilgili modallar `isFocused` ile korunuyor.
            lazyPreloadDistance: 1,
            sceneStyle: { backgroundColor: colors.background },
          }}
        >
          {SWIPE_TABS.map((tab) => (
            <MaterialTopTabs.Screen key={tab.name} name={tab.name} />
          ))}
        </MaterialTopTabs>
      </View>
      </FloatingTabBarContext.Provider>
    )
  );
}
