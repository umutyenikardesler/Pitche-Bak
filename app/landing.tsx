import { useEffect } from "react";
import { View, Text, TouchableOpacity, Platform, ScrollView, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Karşılama ekranı.
 *
 * Eskiden 6 tam ekran görüntüsünden oluşan, sayfa sayfa kaydırılan bir slider
 * vardı; görüntüler küçük ekranda okunmuyordu ve kullanıcılar ilk slaytı
 * geçip gidiyordu. Artık TEK ekran: uygulamanın ne yaptığı, altı özelliğin
 * hepsi aynı anda ve okunur büyüklükte görünüyor. Hızlı geçen kullanıcı da
 * ilk iki saniyede değeri görüyor. Özellik metinleri eski slayt metinleri.
 *
 * Görünüm temadan bağımsız: marka ekranı olduğu için açık ve koyu modda aynı
 * koyu yeşil. Yeni native paket kullanılmıyor (expo-linear-gradient zaten var).
 */

const FEATURES = [
  { key: "find", icon: "search", titleKey: "auth.slide1.title", subtitleKey: "auth.slide1.subtitle" },
  { key: "create", icon: "add-circle", titleKey: "auth.slide2.title", subtitleKey: "auth.slide2.subtitle" },
  { key: "squad", icon: "people", titleKey: "auth.slide3.title", subtitleKey: "auth.slide3.subtitle" },
  { key: "chat", icon: "chatbubbles", titleKey: "auth.slide4.title", subtitleKey: "auth.slide4.subtitle" },
  { key: "profile", icon: "person-circle", titleKey: "auth.slide5.title", subtitleKey: "auth.slide5.subtitle" },
  { key: "alerts", icon: "notifications", titleKey: "auth.slide6.title", subtitleKey: "auth.slide6.subtitle" },
] as const;

// Koyu zümrüt: beyaz metin bu zeminde rahat okunuyor (açık yeşil #16a34a
// üzerinde küçük beyaz metnin kontrastı yetersiz kalıyordu).
const GRADIENT = ["#022c22", "#064e3b", "#065f46"] as const;
const SHEET_BACKDROP = GRADIENT[GRADIENT.length - 1];
const ACCENT = "#4ade80";
const BRAND_GREEN = "#16a34a";

/** Arkadaki silik halı saha çizgileri (SVG yok; düz View'lar). */
function PitchLines() {
  const line = "rgba(255,255,255,0.09)";
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Ceza sahası (üst) */}
      <View
        style={{
          position: "absolute",
          top: -2,
          left: "18%",
          right: "18%",
          height: 110,
          borderWidth: 2,
          borderTopWidth: 0,
          borderColor: line,
          borderBottomLeftRadius: 6,
          borderBottomRightRadius: 6,
        }}
      />
      {/* Orta saha çizgisi ve orta yuvarlak */}
      <View style={{ position: "absolute", top: "58%", left: 0, right: 0, height: 2, backgroundColor: line }} />
      <View
        style={{
          position: "absolute",
          top: "58%",
          left: "50%",
          width: 200,
          height: 200,
          borderRadius: 100,
          borderWidth: 2,
          borderColor: line,
          transform: [{ translateX: -100 }, { translateY: -100 }],
        }}
      />
      <View
        style={{
          position: "absolute",
          top: "58%",
          left: "50%",
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: line,
          transform: [{ translateX: -4 }, { translateY: -3 }],
        }}
      />
    </View>
  );
}

const BALL_SIZE = 26;
const BOUNCE_HEIGHT = 9;
const BOUNCE_MS = 1100;

/**
 * Marka satırındaki top: yumuşak, doğal bir sektirme.
 *
 * Eskiden yukarı ve aşağı iki ayrı, kısa (360 ms) zamanlama zincirleniyordu;
 * hareket kesik kesik görünüyordu. Artık TEK bir ilerleme değeri (0→1) bütün
 * hareketi sürüyor:
 *  - yükseklik, yerçekimindeki gibi bir parabol: tepede yumuşakça yavaşlıyor,
 *  - yere değerken hafif "ezilme" (basıklaşıp toparlanma),
 *  - topun altında, yükseldikçe küçülüp silikleşen bir gölge.
 * Hepsi aynı değerden türediği için birbirinden kopmuyor.
 */
function DribblingBall() {
  const progress = useSharedValue(0);
  const rot = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: BOUNCE_MS, easing: Easing.linear }), -1);
    rot.value = withRepeat(withTiming(360, { duration: 3200, easing: Easing.linear }), -1);
  }, [progress, rot]);

  const ballStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const h = 4 * t * (1 - t); // 0 → 1 → 0: yerçekimi parabolü
    // Yere yakınken ezilme; yükseldikçe sıfırlanıyor.
    const squash = Math.max(0, 1 - h / 0.25);
    const scaleY = 1 - 0.1 * squash;
    const scaleX = 1 + 0.07 * squash;
    // Ezilirken alt kenar yerde kalsın (ölçek merkeze göre uygulanıyor).
    const sink = ((1 - scaleY) * BALL_SIZE) / 2;
    return {
      // Sıra önemli: top önce kendi etrafında dönüyor, ezilme ise ekran
      // eksenlerinde kalıyor (dönen topla birlikte yan yatmıyor).
      transform: [
        { translateY: -BOUNCE_HEIGHT * h + sink },
        { scaleX },
        { scaleY },
        { rotate: `${rot.value}deg` },
      ],
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const t = progress.value;
    const h = 4 * t * (1 - t);
    return {
      opacity: 0.35 - 0.22 * h,
      transform: [{ scaleX: 1 - 0.45 * h }],
    };
  });

  return (
    <View style={{ width: BALL_SIZE, height: BALL_SIZE + 6, alignItems: "center", justifyContent: "flex-end" }}>
      <Animated.View
        style={[
          { position: "absolute", bottom: 0, width: BALL_SIZE * 0.8, height: 4, borderRadius: 2, backgroundColor: "#000000" },
          shadowStyle,
        ]}
      />
      <Animated.Image
        source={require("../assets/images/ball.png")}
        style={[{ width: BALL_SIZE, height: BALL_SIZE, marginBottom: 3 }, ballStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

export default function LandingScreen() {
  const router = useRouter();
  const { currentLanguage, changeLanguage, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  // Android'de `insets.bottom` JEST NAVİGASYONUNDA 0 dönüyor; alt sınır
  // verilmezse butonlar ekranın en dibine yapışıyordu.
  const sheetBottomPadding =
    Platform.OS === "android" ? Math.max(insets.bottom + 12, 20) : Math.max(insets.bottom + 4, 16);

  const nextLanguage = currentLanguage === "tr" ? "en" : "tr";

  return (
    <View style={{ flex: 1, backgroundColor: SHEET_BACKDROP }}>
      {/* Koyu yeşil zeminde beyaz ikonlar; YALNIZCA bu ekran öndeyken. Ekran
          yığında altta açık kalabiliyor (ör. "Misafir olarak başla" ile ileri
          gidilince); koşulsuz olsaydı beyaz ikonlar sonraki ekranlara sızıp
          gündüz modunda beyaz header'da kayboluyordu. */}
      {isFocused && <StatusBar style="light" />}

      <LinearGradient colors={GRADIENT} style={{ flex: 1 }}>
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          <PitchLines />

          {/* Küçük ekranlarda (ör. iPhone SE) içerik sığmazsa kaydırılabilsin. */}
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Üst satır: top (sol) — logo (orta) — dil (sağ).
                Yan kolonlar EŞİT esniyor, logo kolonu sabit genişlikte; bu simetri
                logoyu yan öğelerin genişliğinden bağımsız olarak ekranın tam
                ortasında tutuyor (header'daki yöntemin aynısı: bkz.
                components/CustomHeader.tsx). */}
            <Animated.View entering={FadeIn.duration(400)} style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}>
                <DribblingBall />
              </View>

              {/* Uygulamanın kendi logosu (header'dakiyle aynı). Beyaz harfleri ve
                  koyu dış çizgisi sayesinde koyu yeşil zeminde net okunuyor.
                  Görsel 480x120 (4:1), saydam. */}
              <Image
                source={require("../assets/images/logo.png")}
                style={{ width: 136, height: 34 }}
                resizeMode="contain"
                accessibilityLabel="SahayaBak"
              />

              <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>
                <TouchableOpacity
                  onPress={() => void changeLanguage(nextLanguage)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={nextLanguage === "en" ? "Switch to English" : "Türkçe'ye geç"}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    height: 32,
                    paddingHorizontal: 10,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.25)",
                  }}
                >
                  <Text style={{ fontSize: 15 }}>{currentLanguage === "tr" ? "🇹🇷" : "🇬🇧"}</Text>
                  <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 12, marginLeft: 6 }}>
                    {currentLanguage.toUpperCase()}
                  </Text>
                  <Ionicons name="swap-horizontal" size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Başlık */}
            <Animated.View entering={FadeInDown.delay(80).duration(450)} style={{ marginTop: 34 }}>
              <Text style={{ color: "#ffffff", fontSize: 34, lineHeight: 40, fontWeight: "900", letterSpacing: -0.5 }}>
                {t("landing.headlineTop")}
                {"\n"}
                <Text style={{ color: ACCENT }}>{t("landing.headlineAccent")}</Text>
              </Text>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(150).duration(450)}>
              <Text style={{ color: "rgba(236,253,245,0.82)", fontSize: 15, lineHeight: 22, marginTop: 12 }}>
                {t("landing.subtitle")}
              </Text>
            </Animated.View>

            {/* Özellikler: altısı birden, okunur büyüklükte */}
            <Animated.Text
              entering={FadeIn.delay(220).duration(400)}
              style={{
                color: ACCENT,
                fontSize: 12,
                fontWeight: "800",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                marginTop: 28,
                marginBottom: 10,
              }}
            >
              {t("landing.featuresTitle")}
            </Animated.Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
              {FEATURES.map((f, i) => (
                <Animated.View
                  key={f.key}
                  entering={FadeInDown.delay(260 + i * 70).duration(420)}
                  style={{ width: "48.5%" }}
                >
                  <View
                    style={{
                      minHeight: 104,
                      padding: 12,
                      borderRadius: 18,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.16)",
                    }}
                  >
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#d1fae5",
                      }}
                    >
                      <Ionicons name={f.icon} size={18} color="#065f46" />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={{ color: "#ffffff", fontSize: 14.5, fontWeight: "800", marginTop: 10 }}
                    >
                      {t(f.titleKey)}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{ color: "rgba(236,253,245,0.78)", fontSize: 12, lineHeight: 16, marginTop: 3 }}
                    >
                      {t(f.subtitleKey)}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      {/* Alt panel: butonlar başparmakla kolay erişilen yerde, alt alta. */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(450)}
        style={{
          backgroundColor: "#ffffff",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: sheetBottomPadding,
        }}
      >
        {/* İki buton tek satırda yan yana, eşit genişlikte. */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TouchableOpacity
            activeOpacity={0.9}
            accessibilityRole="button"
            onPress={() => router.replace("/auth?from=%2Flanding" as any)}
            style={{
              flex: 1,
              height: 54,
              borderRadius: 16,
              paddingHorizontal: 10,
              backgroundColor: BRAND_GREEN,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text numberOfLines={1} style={{ color: "#ffffff", fontWeight: "800", fontSize: 16 }}>
              {t("auth.signInButton")}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.9}
            accessibilityRole="button"
            onPress={() => router.push("/guest-landing" as any)}
            style={{
              flex: 1,
              height: 54,
              borderRadius: 16,
              paddingHorizontal: 10,
              backgroundColor: "#f0fdf4",
              borderWidth: 1.5,
              borderColor: BRAND_GREEN,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Yarım genişlikte "Misafir olarak başla" 16 puntoda sığmayabiliyor;
                tek satırda kalsın diye gerekirse %80'e kadar küçülüyor. */}
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ color: "#166534", fontWeight: "800", fontSize: 16 }}
            >
              {t("landing.guestStart")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tek satır: dar ekranlarda sığmazsa yazı kendiliğinden küçülüyor. */}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{ color: "#6b7280", fontSize: 11, textAlign: "center", marginTop: 10 }}
        >
          {t("landing.guestHint")}
        </Text>
      </Animated.View>
    </View>
  );
}
