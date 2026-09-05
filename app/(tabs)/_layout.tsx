import { Tabs } from "expo-router";
import { type ComponentProps, type ReactNode } from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomHeader from "@/components/CustomHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotification } from "@/components/NotificationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useGuestAuthAlert } from "@/contexts/GuestAuthModalContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { DeviceEventEmitter, Platform, StyleSheet, Text, View } from 'react-native';
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

  const sharedTabBarOptions = {
    tabBarActiveTintColor: "#059669",
    tabBarInactiveTintColor: isDark ? "#d1d5db" : "#374151",
    tabBarStyle,
    tabBarItemStyle: isIos ? tabBarStyles.tabBarItemIos : tabBarStyles.tabBarItem,
    tabBarBackground: renderTabBarBackground,
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
    const style = { marginTop: 2 };
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
          style={{ marginTop: 2 }}
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
      <Tabs.Screen
        name="notifications"
        listeners={guestBlockedListeners('auth.guestNotifications')}
        options={makeTabOptions({
          label: t('notifications.title'),
          icon: { family: 'ionicons', name: 'notifications-outline' },
          hidden: true,
        })}
      />

      {/* Tab bar'da görünmesin (Landing -> Misafir akışı için) */}
      <Tabs.Screen
        name="guest-landing"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle,
          tabBarBackground: renderTabBarBackground,
        }}
      />
    </Tabs>
  );
}
