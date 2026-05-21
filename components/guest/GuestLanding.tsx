import { View, Text, TouchableOpacity, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";

const FIELD_HEIGHT = 90;
const BALL_SIZE = 12;
const BALL_PADDING = 6;

interface GuestLandingProps {
  onContinue: () => void;
}

export default function GuestLanding({ onContinue }: GuestLandingProps) {
  const { t } = useLanguage();
  const { colors, isDark } = useAppTheme();
  const headerWidthSV = useSharedValue(0);
  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const ballVX = useSharedValue(0);
  const ballVY = useSharedValue(0);
  const ballRot = useSharedValue(0);
  // (state placeholder yok)

  const rand = (min: number, max: number) => {
    "worklet";
    return min + Math.random() * (max - min);
  };

  const ensureBallInit = () => {
    "worklet";
    const w = headerWidthSV.value || 0;
    if (w <= 0) return;
    if (ballVX.value !== 0 || ballVY.value !== 0) return;
    const minX = BALL_PADDING;
    const maxX = Math.max(minX, w - BALL_SIZE - BALL_PADDING);
    const minY = BALL_PADDING;
    const maxY = Math.max(minY, FIELD_HEIGHT - BALL_SIZE - BALL_PADDING);
    ballX.value = (minX + maxX) / 2;
    ballY.value = (minY + maxY) / 2;
    const speed = rand(0.05, 0.095);
    const angle = rand(0, Math.PI * 2);
    ballVX.value = Math.cos(angle) * speed;
    ballVY.value = Math.sin(angle) * speed;
  };

  useFrameCallback((frame) => {
    "worklet";
    ensureBallInit();
    const w = headerWidthSV.value || 0;
    if (w <= 0) return;
    const dt = frame.timeSincePreviousFrame ?? 16;
    const minX = BALL_PADDING;
    const maxX = Math.max(minX, w - BALL_SIZE - BALL_PADDING);
    const minY = BALL_PADDING;
    const maxY = Math.max(minY, FIELD_HEIGHT - BALL_SIZE - BALL_PADDING);
    let x = ballX.value + ballVX.value * dt;
    let y = ballY.value + ballVY.value * dt;
    let vx = ballVX.value;
    let vy = ballVY.value;
    const bounceJitter = () => {
      "worklet";
      vx *= rand(0.92, 1.08);
      vy *= rand(0.92, 1.08);
      vy += rand(-0.02, 0.02);
      vx += rand(-0.02, 0.02);
      const maxSpeed = 0.12;
      const minSpeed = 0.035;
      const sp = Math.sqrt(vx * vx + vy * vy) || 0.0001;
      const clamped = Math.min(maxSpeed, Math.max(minSpeed, sp));
      vx = (vx / sp) * clamped;
      vy = (vy / sp) * clamped;
    };
    if (x <= minX) { x = minX; vx = Math.abs(vx); bounceJitter(); } else if (x >= maxX) { x = maxX; vx = -Math.abs(vx); bounceJitter(); }
    if (y <= minY) { y = minY; vy = Math.abs(vy); bounceJitter(); } else if (y >= maxY) { y = maxY; vy = -Math.abs(vy); bounceJitter(); }
    ballX.value = x;
    ballY.value = y;
    ballVX.value = vx;
    ballVY.value = vy;
    ballRot.value = ballRot.value + (vx * dt) / 6;
  });

  const ballAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: ballX.value },
      { translateY: ballY.value },
      { rotate: `${ballRot.value}rad` },
    ],
    opacity: headerWidthSV.value > 0 ? 1 : 0,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
      {/* Header - Halı saha (normal giriş sayfası gibi üst boşluk) */}
      <View
        className="bg-green-700 px-2"
        style={{ height: FIELD_HEIGHT, position: "relative", overflow: "hidden" }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w > 0) headerWidthSV.value = w;
        }}
      >
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.8 }}>
          <View style={{ position: "absolute", top: 1, left: 1, right: 1, height: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", bottom: 1, left: 1, right: 1, height: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", top: 1, bottom: 1, left: 1, width: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", top: 1, bottom: 1, right: 1, width: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", left: "50%", top: 1, bottom: 1, width: 2, backgroundColor: "white", transform: [{ translateX: -1 }] }} />
          <View style={{ position: "absolute", top: "50%", left: "50%", width: 60, height: 60, borderWidth: 2, borderColor: "white", borderRadius: 30, transform: [{ translateX: -30 }, { translateY: -30 }] }} />
          <View style={{ position: "absolute", left: 1, top: "25%", bottom: "25%", width: 25, borderWidth: 2, borderColor: "white", borderRightWidth: 0, backgroundColor: "rgba(255, 255, 255, 0.15)" }} />
          <View style={{ position: "absolute", left: 3, top: "15%", width: 40, height: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", left: 3, bottom: "15%", width: 40, height: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", left: 42, top: "15%", bottom: "15%", width: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", left: 32, top: "50%", width: 4, height: 4, borderRadius: 2, backgroundColor: "white", transform: [{ translateX: -2 }, { translateY: -2 }] }} />
          <View style={{ position: "absolute", right: 1, top: "25%", bottom: "25%", width: 25, borderWidth: 2, borderColor: "white", borderLeftWidth: 0, backgroundColor: "rgba(255, 255, 255, 0.15)" }} />
          <View style={{ position: "absolute", right: 3, top: "15%", width: 40, height: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", right: 3, bottom: "15%", width: 40, height: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", right: 42, top: "15%", bottom: "15%", width: 2, backgroundColor: "white" }} />
          <View style={{ position: "absolute", right: 32, top: "50%", width: 4, height: 4, borderRadius: 2, backgroundColor: "white", transform: [{ translateX: 2 }, { translateY: -2 }] }} />
        </View>
        <View style={{ width: "100%", height: "100%", zIndex: 1, position: "relative" }}>
          <Animated.Image
            source={require("../../assets/images/ball.png")}
            style={[{ position: "absolute", width: BALL_SIZE, height: BALL_SIZE, zIndex: 2 }, ballAnimatedStyle]}
            resizeMode="contain"
          />
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 3 }} pointerEvents="none">
            <Text
              style={{
                color: "white",
                fontWeight: "900",
                letterSpacing: 3,
                fontSize: 20,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: "rgba(0,0,0,0.22)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.55)",
              }}
            >
              {t("auth.brand")}
            </Text>
          </View>
        </View>
      </View>

      {/* İçerik - slider yerine misafir açıklaması */}
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 18 }}>
        <View style={{ paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", color: colors.primaryDark, textAlign: "center" }}>
            {t("guest.landing.title")}
          </Text>
          <Text style={{ marginTop: 8, color: colors.textSecondary, textAlign: "center", fontSize: 14, lineHeight: 20 }}>
            {t("guest.landing.subtitle")}
          </Text>
        </View>

        <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {[
            { icon: "football-outline" as const, text: t("guest.landing.item1") },
            { icon: "map-outline" as const, text: t("guest.landing.item2") },
            { icon: "people-outline" as const, text: t("guest.landing.item3") },
            { icon: "information-circle-outline" as const, text: t("guest.landing.item4") },
            { icon: "funnel-outline" as const, text: t("guest.landing.item5") },
            { icon: "lock-closed-outline" as const, text: t("guest.landing.item6") },
          ].map((it, idx) => (
            <View
              key={idx}
              style={{
                width: "48%",
                backgroundColor: colors.surfaceAlt,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: isDark ? colors.border : "rgba(22, 163, 74, 0.22)",
                padding: 12,
                alignItems: "center",
                ...(Platform.OS === "android"
                  ? { elevation: 3 }
                  : { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }),
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: isDark ? "rgba(22, 163, 74, 0.24)" : "rgba(22, 163, 74, 0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: isDark ? colors.border : "rgba(22, 163, 74, 0.22)",
                }}
              >
                <Ionicons name={it.icon} size={18} color={colors.primary} />
              </View>
              <Text style={{ marginTop: 10, color: colors.text, fontSize: 14, fontWeight: "800", lineHeight: 20, textAlign: "center" }}>
                {it.text}
              </Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onContinue}
          style={{
            backgroundColor: "#16a34a",
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: "center",
            ...(Platform.OS === "android" ? { elevation: 6 } : { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }),
          }}
        >
          <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{t("guest.landing.start")}</Text>
        </TouchableOpacity>

        {/* Tab bar için biraz boşluk */}
        <View style={{ height: 18 }} />
      </View>
    </SafeAreaView>
  );
}
