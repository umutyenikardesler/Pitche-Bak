import { View, Text, TouchableOpacity, Image, Dimensions, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  scrollTo,
  runOnUI,
  withTiming,
} from "react-native-reanimated";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLanguage } from "@/contexts/LanguageContext";

const INTRO_SLIDES = [
  { key: "s1", image: require("@/assets/images/screenShot/slide1.png"), titleKey: "auth.slide1.title", subtitleKey: "auth.slide1.subtitle" },
  { key: "s2", image: require("@/assets/images/screenShot/slide2.png"), titleKey: "auth.slide2.title", subtitleKey: "auth.slide2.subtitle" },
  { key: "s3", image: require("@/assets/images/screenShot/slide3.png"), titleKey: "auth.slide3.title", subtitleKey: "auth.slide3.subtitle" },
  { key: "s4", image: require("@/assets/images/screenShot/slide4.png"), titleKey: "auth.slide4.title", subtitleKey: "auth.slide4.subtitle" },
  { key: "s5", image: require("@/assets/images/screenShot/slide5.png"), titleKey: "auth.slide5.title", subtitleKey: "auth.slide5.subtitle" },
  { key: "s6", image: require("@/assets/images/screenShot/slide6.png"), titleKey: "auth.slide6.title", subtitleKey: "auth.slide6.subtitle" },
] as const;

const DOT_SIZE = 8;
const DOT_GAP = 8;
const FIELD_HEIGHT = 90;
const BALL_SIZE = 12;
const BALL_PADDING = 6;

export default function LandingScreen() {
  const router = useRouter();
  const { currentLanguage, changeLanguage, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [introWidth, setIntroWidth] = useState(Dimensions.get("window").width);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);

  const introListRef = useAnimatedRef<Animated.FlatList<any>>();
  const introScrollX = useSharedValue(0);
  const activeDotX = useSharedValue(0);
  const headerWidthSV = useSharedValue(0);
  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  const ballVX = useSharedValue(0);
  const ballVY = useSharedValue(0);
  const ballRot = useSharedValue(0);
  const [introIndex, setIntroIndex] = useState(0);

  const dotsWidth = INTRO_SLIDES.length * DOT_SIZE + (INTRO_SLIDES.length - 1) * DOT_GAP;
  const introImageHeight = Platform.OS === "android" ? "83%" : "88%";
  const ctaBottomPadding =
    Platform.OS === "android"
      ? (insets.bottom > 0 ? insets.bottom + 8 : 0)
      : Math.max(insets.bottom, 8);

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
    transform: [{ translateX: ballX.value }, { translateY: ballY.value }, { rotate: `${ballRot.value}rad` }],
    opacity: headerWidthSV.value > 0 ? 1 : 0,
  }));

  const activeDotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activeDotX.value }],
  }));

  const introScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      introScrollX.value = event.contentOffset.x;
    },
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }} edges={["top"]}>
      {/* Header - halı saha */}
      <View
        style={{ height: FIELD_HEIGHT, position: "relative", overflow: "hidden", backgroundColor: "#15803d", paddingHorizontal: 8 }}
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
            source={require("../assets/images/ball.png")}
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

      {/* Slider */}
      <View
        style={{ flex: 1, backgroundColor: "#ffffff", paddingTop: Platform.OS === "ios" ? 6 : 6 }}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && Math.abs(w - introWidth) > 1) setIntroWidth(w);
        }}
      >
        <Animated.FlatList
          ref={introListRef}
          data={INTRO_SLIDES as any}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(it: any) => it.key}
          onScroll={introScrollHandler}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
          onMomentumScrollEnd={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            const idx = introWidth > 0 ? Math.round(x / introWidth) : 0;
            const clamped = Math.max(0, Math.min(idx, INTRO_SLIDES.length - 1));
            setIntroIndex(clamped);
            activeDotX.value = withTiming(clamped * (DOT_SIZE + DOT_GAP), { duration: 180 });
          }}
          renderItem={({ item, index }: any) => (
            <View style={{ width: introWidth, flex: 1 }}>
              <Image
                source={item.image}
                style={{ width: "89%", height: introImageHeight, alignSelf: "center", marginTop: 4 }}
                resizeMode="contain"
              />

              {/* İlk slide: sol boşlukta dil bayrakları (Auth ekranındaki gibi) */}
              {index === 0 && (
                <View style={{ position: "absolute", left: 15, top: 8, zIndex: 6, alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => setLanguageMenuOpen((v) => !v)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={currentLanguage === "tr" ? "Türkçe" : "English"}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 28,
                        borderRadius: 9,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(22,163,74,0.16)",
                        borderWidth: 1,
                        borderColor: "#16a34a",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.25,
                        shadowRadius: 6,
                        elevation: 4,
                      }}
                    >
                      <Text style={{ fontSize: 19, opacity: 1 }}>
                        {currentLanguage === "tr" ? "🇹🇷" : "🇬🇧"}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {languageMenuOpen && (
                    <View style={{ marginTop: 2 }}>
                      <TouchableOpacity
                        onPress={() => {
                          const next = currentLanguage === "tr" ? "en" : "tr";
                          setLanguageMenuOpen(false);
                          void changeLanguage(next);
                        }}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={currentLanguage === "tr" ? "English" : "Türkçe"}
                      >
                        <View
                          style={{
                            width: 34,
                            height: 26,
                            borderRadius: 9,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "rgba(0,0,0,0.06)",
                            borderWidth: 1,
                            borderColor: "rgba(17,24,39,0.15)",
                          }}
                        >
                          <Text style={{ fontSize: 17, opacity: 0.9 }}>
                            {currentLanguage === "tr" ? "🇬🇧" : "🇹🇷"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {index > 0 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    runOnUI((x: number) => {
                      "worklet";
                      scrollTo(introListRef, x, 0, true);
                    })((index - 1) * introWidth);
                  }}
                  style={{
                    position: "absolute",
                    left: 16,
                    top: 6,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(22, 163, 74, 0.25)",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 5,
                  }}
                >
                  <Ionicons name="chevron-back" size={20} color="#16a34a" />
                </TouchableOpacity>
              )}

              {index < INTRO_SLIDES.length - 1 && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    runOnUI((x: number) => {
                      "worklet";
                      scrollTo(introListRef, x, 0, true);
                    })((index + 1) * introWidth);
                  }}
                  style={{
                    position: "absolute",
                    right: 15,
                    top: 6,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "rgba(22, 163, 74, 0.25)",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 5,
                  }}
                >
                  <Ionicons name="chevron-forward" size={20} color="#16a34a" />
                </TouchableOpacity>
              )}

              <View style={{ position: "absolute", left: 0, right: 0, bottom: Platform.OS === "android" ? 0 : 6, paddingHorizontal: 10, paddingTop: 4, paddingBottom: Platform.OS === "android" ? 2 : 8, zIndex: 2, alignItems: "center", pointerEvents: "none" }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#065f46", textAlign: "center" }} numberOfLines={1}>
                  {t(item.titleKey)}
                </Text>
                <Text style={{ color: "#374151", marginTop: 2, textAlign: "center" }} numberOfLines={2}>
                  {t(item.subtitleKey)}
                </Text>
              </View>
            </View>
          )}
        />

        {/* Dots */}
        <View style={{ paddingTop: 2, paddingBottom: Platform.OS === "ios" ? 6 : 6, paddingHorizontal: 6, alignItems: "center" }}>
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.95)",
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 2,
              borderColor: "#16a34a",
              ...(Platform.OS === "android" ? { elevation: 6 } : { shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }),
            }}
          >
            <View style={{ width: dotsWidth, height: DOT_SIZE, position: "relative" }}>
              <View style={{ flexDirection: "row" }}>
                {INTRO_SLIDES.map((s, idx) => (
                  <View key={s.key} style={{ width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: "rgba(0,0,0,0.22)", marginRight: idx === INTRO_SLIDES.length - 1 ? 0 : DOT_GAP }} />
                ))}
              </View>
              <Animated.View style={[{ position: "absolute", left: 0, top: 0, width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: "#16a34a" }, activeDotStyle]} />
            </View>
          </View>
        </View>

        {/* Bottom CTAs */}
        <View style={{ paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 6 : 2, paddingBottom: ctaBottomPadding, flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.replace("/auth?from=%2Flanding" as any)}
            style={{
              backgroundColor: "#16a34a",
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              flex: 1,
            }}
          >
            <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>{t("auth.signInButton")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push("/(tabs)/guest-landing" as any)}
            style={{
              backgroundColor: "#ffffff",
              borderWidth: 2,
              borderColor: "#16a34a",
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              flex: 1,
            }}
          >
            <Text style={{ color: "#166534", fontWeight: "800", fontSize: 16 }}>Misafir olarak başla</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

