import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '@/contexts/ThemeContext';
import {
  HEADER_LOGO_HEIGHT,
  HEADER_LOGO_WIDTH,
  headerLogoLeft,
  headerLogoTop,
} from '@/constants/header';

/**
 * Açılış geçişi: logo önce ekranın tam ortasında büyük durur (START_HOLD_MS),
 * sonra header'daki yerine küçülerek kayar (MOVE_MS). Logo header'a TAM
 * OTURDUĞU ANDA beyaz zemin transparana geçmeye başlar (FADE_MS) ve altında
 * yüklenmekte olan index sayfası görünür olur. Uygulama bu süre boyunca
 * arkada zaten yüklenmekte olduğu için index normal şartlarda bu ana kadar
 * hazır olur.
 *
 * HEDEF KONUM: CustomHeader ile ORTAK formülden geliyor (constants/header.ts).
 * İki taraf konumu ayrı ayrı hesaplarsa kaçınılmaz olarak sapıyor; zemin
 * kalkınca gerçek logo birkaç piksel farklı yerde belirdiği için sıçrama
 * görünüyordu.
 *
 * Katman yalnızca uygulama açılışında bir kez gösterilir (bkz. app/_layout.tsx).
 */

/** Logonun ekran ortasındayken kaplayacağı genişlik oranı. */
const START_WIDTH_RATIO = 0.72;
/** Ortada bekleme ve header'a kayma süreleri (ms). */
const START_HOLD_MS = 500;
const MOVE_MS = 1000;
/** Logo header'a oturur oturmaz zeminin beyazdan transparana geçiş süresi. */
const FADE_MS = 250;

type Props = {
  /** Geçiş bittiğinde çağrılır; katman bundan sonra kaldırılmalı. */
  onDone: () => void;
};

export default function LaunchLogoOverlay({ onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  // `progress`: logonun ortadan header'a hareketi (0 = ortada, 1 = header'da).
  const progress = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);
  // Devir anında kopya logo da sönüyor: konumlar birebir örtüşmezse sert bir
  // sıçrama yerine yumuşak bir çapraz geçiş oluyor.
  const logoOpacity = useSharedValue(1);

  // Hedef: header'daki logonun konumu (CustomHeader ile aynı formül).
  const targetLeft = headerLogoLeft(width);
  const targetTop = headerLogoTop(insets.top);
  const targetCenterX = targetLeft + HEADER_LOGO_WIDTH / 2;
  const targetCenterY = targetTop + HEADER_LOGO_HEIGHT / 2;

  // Başlangıç: ekranın tam ortası, ekrana sığacak büyüklükte.
  const startScale = (width * START_WIDTH_RATIO) / HEADER_LOGO_WIDTH;
  const startCenterX = width / 2;
  const startCenterY = height / 2;

  useEffect(() => {
    progress.value = withDelay(
      START_HOLD_MS,
      withTiming(1, { duration: MOVE_MS, easing: Easing.inOut(Easing.cubic) })
    );
    backdropOpacity.value = withDelay(
      START_HOLD_MS + MOVE_MS,
      withTiming(0, { duration: FADE_MS }, (finished) => {
        if (finished) runOnJS(onDone)();
      })
    );
    logoOpacity.value = withDelay(
      START_HOLD_MS + MOVE_MS,
      withTiming(0, { duration: FADE_MS })
    );
    // Sadece ilk montajda çalışmalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Konumun tamamı transform ile veriliyor (statik left/top = 0).
  const logoStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const centerX = targetCenterX + (1 - p) * (startCenterX - targetCenterX);
    const centerY = targetCenterY + (1 - p) * (startCenterY - targetCenterY);

    return {
      opacity: logoOpacity.value,
      transform: [
        { translateX: centerX - HEADER_LOGO_WIDTH / 2 },
        { translateY: centerY - HEADER_LOGO_HEIGHT / 2 },
        { scale: interpolate(p, [0, 1], [startScale, 1]) },
      ],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.background, zIndex: 100 },
        backdropStyle,
      ]}
      // Geçiş sürerken alttaki yarı hazır arayüze dokunulmasın; katman bitince kaldırılıyor.
      pointerEvents="auto"
    >
      <Animated.Image
        source={require('@/assets/images/logo.png')}
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: HEADER_LOGO_WIDTH,
            height: HEADER_LOGO_HEIGHT,
            resizeMode: 'contain',
          },
          logoStyle,
        ]}
      />
    </Animated.View>
  );
}
