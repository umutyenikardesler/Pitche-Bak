import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Dimensions, Platform, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * "Uçan emoji" katmanı: Instagram'daki gibi tepki animasyonu.
 *
 * Katman kök düzende, bütün ekranların ÜSTÜNDE ve kökün (0,0) noktasında
 * çiziliyor. Dokunma olaylarının `pageX/pageY` değerleri de köke göre olduğu
 * için hiçbir dönüşüm ya da ölçüm gerekmeden doğrudan kullanılabiliyor.
 *
 * Neden ölçüm yok: ilk sürümde konumlar sohbet ekranında ref + measure ile
 * alınıyordu. NativeWind'in JSX sarmalayıcısı yüzünden ref'ler bağlanmadı,
 * ölçüm 0x0 döndü ve animasyon hiç başlamadı. Bu katman yalnızca dokunma
 * koordinatlarıyla çalışıyor. Açılış logosu da kökte aynı yöntemle çiziliyor
 * (bkz. components/LaunchLogoOverlay.tsx).
 */

export type Point = { x: number; y: number };

type FlyRequest = {
  emoji: string;
  /** Başlangıç (sayfa koordinatı): seçicide dokunulan emoji. */
  from: Point;
  /** Hedef (sayfa koordinatı): mesajdaki rozetin merkezi. */
  to: Point;
  /** Emoji hedefe indiğinde çağrılır. */
  onLanded?: () => void;
};

// Seçilen emoji ekranın ortasına doğru büyüyerek geliyor, kısa bir an duruyor,
// sonra rozete küçülerek iniyor. Android'de aynı süreler cihazda belirgin
// şekilde hızlı algılandı; orada biraz daha yavaş oynatılıyor.
const SPEED = Platform.OS === 'android' ? 1.35 : 1;
const GROW_MS = Math.round(260 * SPEED);
const HOLD_MS = Math.round(140 * SPEED);
const FLY_MS = Math.round(340 * SPEED);
const FONT_SIZE = 28;
/** Rozetteki emoji 14 punto; inişte bu orana küçülüyor. */
const LANDED_SCALE = 14 / FONT_SIZE;
const BOX = 48;

const FlyContext = createContext<(req: FlyRequest) => void>(() => {});

/** Tepki animasyonunu başlatır. Sağlayıcı yoksa hiçbir şey yapmaz. */
export function useFlyingEmoji() {
  return useContext(FlyContext);
}

/**
 * Sağlayıcı, uçan emojiyi çocuklarının SONRASINA (yani üstlerine) çizer. Bu
 * yüzden kök düzende, ekranların (Stack) kardeşi olarak ve ekranı (0,0)'dan
 * itibaren tamamen kaplayan bir kapsayıcının içine yerleştirilmeli.
 */
export function FlyingEmojiProvider({ children }: { children: ReactNode }) {
  const [emoji, setEmoji] = useState<string | null>(null);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fly = useCallback((req: FlyRequest) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const { width, height } = Dimensions.get('window');
    const centerX = width / 2;
    const centerY = height * 0.42;

    setEmoji(req.emoji);
    opacity.value = 1;
    x.value = req.from.x;
    y.value = req.from.y;
    scale.value = 1;

    x.value = withSequence(
      withTiming(centerX, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }),
      withDelay(HOLD_MS, withTiming(req.to.x, { duration: FLY_MS, easing: Easing.inOut(Easing.cubic) }))
    );
    y.value = withSequence(
      withTiming(centerY, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }),
      withDelay(HOLD_MS, withTiming(req.to.y, { duration: FLY_MS, easing: Easing.inOut(Easing.cubic) }))
    );
    scale.value = withSequence(
      // Hafif taşma: büyüyüp bir tık geri oturuyor.
      withTiming(3, { duration: GROW_MS, easing: Easing.out(Easing.back(1.8)) }),
      withDelay(HOLD_MS, withTiming(LANDED_SCALE, { duration: FLY_MS, easing: Easing.in(Easing.cubic) }))
    );

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      opacity.value = 0;
      setEmoji(null);
      req.onLanded?.();
    }, GROW_MS + HOLD_MS + FLY_MS);
  }, [x, y, scale, opacity]);

  return (
    <FlyContext.Provider value={fly}>
      {children}
      <FlyingEmojiHost emoji={emoji} x={x} y={y} scale={scale} opacity={opacity} />
    </FlyContext.Provider>
  );
}

function FlyingEmojiHost({
  emoji,
  x,
  y,
  scale,
  opacity,
}: {
  emoji: string | null;
  x: SharedValue<number>;
  y: SharedValue<number>;
  scale: SharedValue<number>;
  opacity: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  if (!emoji) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000, elevation: 10000 }}
    >
      {/* 48x48 kutu (0,0) etrafında ortalı; translate, kutunun merkezini hedefe taşıyor. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: -BOX / 2,
            top: -BOX / 2,
            width: BOX,
            height: BOX,
            alignItems: 'center',
            justifyContent: 'center',
          },
          style,
        ]}
      >
        <Text style={{ fontSize: FONT_SIZE }}>{emoji}</Text>
      </Animated.View>
    </View>
  );
}
