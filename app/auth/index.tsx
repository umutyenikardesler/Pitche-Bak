import { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, ScrollView, Keyboard, Dimensions, Image, FlatList } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, useFrameCallback, withTiming, Easing, runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<"google" | "apple" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardWasOpened, setKeyboardWasOpened] = useState(false); // Klavye bir kere açıldı mı?
  const [isFormExpanded, setIsFormExpanded] = useState(false); // Form genişletilmiş mi?
  const [keyboardHeight, setKeyboardHeight] = useState(0); // iOS için klavye yüksekliği
  
  const passwordInputRef = useRef<TextInput>(null);

  // Form container yükseklik animasyonu - başlangıçta küçük
  const MIN_FORM_HEIGHT = Platform.OS === 'ios' ? 160 : 180;

  // Tanıtım slider'ı (giriş formu başlamadan önceki alanı doldurur)
  const INTRO_SLIDES = [
    { key: 's1', image: require('@/assets/images/screenShot/IMG_4990.PNG'), title: 'Maç Bul', subtitle: 'Yakınındaki maçlara katıl, yeni insanlarla oyna.' },
    { key: 's2', image: require('@/assets/images/screenShot/IMG_4991.PNG'), title: 'Maç Oluştur', subtitle: 'Sahanı seç, saati belirle, ekibini kur.' },
    { key: 's3', image: require('@/assets/images/screenShot/IMG_4992.PNG'), title: 'Kadronu Yönet', subtitle: 'Eksik pozisyonları belirle, talepleri yönet.' },
    { key: 's4', image: require('@/assets/images/screenShot/IMG_4993.PNG'), title: 'Mesajlaş', subtitle: 'Takım arkadaşlarınla ve rakiplerinle sohbet et.' },
    { key: 's5', image: require('@/assets/images/screenShot/IMG_4994.PNG'), title: 'Profilini Doldur', subtitle: 'Kendini tanıt, daha iyi eşleşmeler yakala.' },
  ] as const;
  const introListRef = useRef<any>(null);
  const [introIndex, setIntroIndex] = useState(0);
  const [introWidth, setIntroWidth] = useState(Dimensions.get('window').width);
  const introWidthSV = useSharedValue(Dimensions.get('window').width);
  const introScrollX = useSharedValue(0);
  const activeDotX = useSharedValue(0);

  const DOT_SIZE = 8;
  const DOT_GAP = 8;
  const dotsWidth = INTRO_SLIDES.length * DOT_SIZE + (INTRO_SLIDES.length - 1) * DOT_GAP;

  const introScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      introScrollX.value = event.contentOffset.x;
    },
  });

  const activeDotStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: activeDotX.value }],
    };
  });

  // Header halı saha içinde gezen top animasyonu
  const FIELD_HEIGHT = 90;
  const BALL_SIZE = 12;
  const BALL_PADDING = 6;
  const headerWidthSV = useSharedValue(0);
  const ballX = useSharedValue(0);
  const ballY = useSharedValue(0);
  // px/ms hız bileşenleri
  const ballVX = useSharedValue(0);
  const ballVY = useSharedValue(0);
  const ballRot = useSharedValue(0);

  const rand = (min: number, max: number) => {
    'worklet';
    return min + Math.random() * (max - min);
  };

  const ensureBallInit = () => {
    'worklet';
    const w = headerWidthSV.value || 0;
    if (w <= 0) return;
    if (ballVX.value !== 0 || ballVY.value !== 0) return;

    const minX = BALL_PADDING;
    const maxX = Math.max(minX, w - BALL_SIZE - BALL_PADDING);
    const minY = BALL_PADDING;
    const maxY = Math.max(minY, FIELD_HEIGHT - BALL_SIZE - BALL_PADDING);

    // Başlangıç: ortalara yakın
    ballX.value = (minX + maxX) / 2;
    ballY.value = (minY + maxY) / 2;

    // Rastgele başlangıç hızı (px/ms). 0.06 -> 60px/sn
    const speed = rand(0.05, 0.095);
    const angle = rand(0, Math.PI * 2);
    ballVX.value = Math.cos(angle) * speed;
    ballVY.value = Math.sin(angle) * speed;
  };

  useFrameCallback((frame) => {
    'worklet';
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
      'worklet';
      // Her çarpışmada küçük sapma: “rastgele desen” hissi
      vx *= rand(0.92, 1.08);
      vy *= rand(0.92, 1.08);
      // Diğer eksene küçük itme
      vy += rand(-0.02, 0.02);
      vx += rand(-0.02, 0.02);
      // Çok yavaşlamasın / çok hızlanmasın
      const maxSpeed = 0.12;
      const minSpeed = 0.035;
      const sp = Math.sqrt(vx * vx + vy * vy) || 0.0001;
      const clamped = Math.min(maxSpeed, Math.max(minSpeed, sp));
      vx = (vx / sp) * clamped;
      vy = (vy / sp) * clamped;
    };

    // X çarpışma
    if (x <= minX) {
      x = minX;
      vx = Math.abs(vx);
      bounceJitter();
    } else if (x >= maxX) {
      x = maxX;
      vx = -Math.abs(vx);
      bounceJitter();
    }

    // Y çarpışma
    if (y <= minY) {
      y = minY;
      vy = Math.abs(vy);
      bounceJitter();
    } else if (y >= maxY) {
      y = maxY;
      vy = -Math.abs(vy);
      bounceJitter();
    }

    ballX.value = x;
    ballY.value = y;
    ballVX.value = vx;
    ballVY.value = vy;
    ballRot.value = ballRot.value + (vx * dt) / 6;
  });

  const ballAnimatedStyle = useAnimatedStyle(() => {
    const w = headerWidthSV.value || 0;
    return {
      transform: [
        { translateX: ballX.value },
        { translateY: ballY.value },
        { rotate: `${ballRot.value}rad` },
      ],
      opacity: w > 0 ? 1 : 0,
    };
  });

  // Header ortasında "SAHAYABAK" flash (10-15 sn arası)
  const brandOpacity = useSharedValue(0);
  const brandAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: brandOpacity.value,
      transform: [{ scale: 0.96 + 0.04 * brandOpacity.value }],
    };
  });

  useEffect(() => {
    let mounted = true;
    let nextTimer: any = null;
    let hideTimer: any = null;

    const schedule = () => {
      if (!mounted) return;
      const delay = 10_000 + Math.floor(Math.random() * 5_000); // 10-15sn
      nextTimer = setTimeout(() => {
        // göster
        brandOpacity.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
        // kısa süre sonra gizle
        hideTimer = setTimeout(() => {
          brandOpacity.value = withTiming(0, { duration: 320, easing: Easing.in(Easing.cubic) });
        }, 3500);
        // bir sonraki
        schedule();
      }, delay);
    };

    schedule();

    return () => {
      mounted = false;
      if (nextTimer) clearTimeout(nextTimer);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  const HEADER_HEIGHT = 90;
  // Slider yüksekliği: giriş formunun kapalı halinin üstünde kalan alan
  const introHeight = Math.max(
    0,
    SCREEN_HEIGHT - MIN_FORM_HEIGHT - HEADER_HEIGHT - Math.max(insets.top, 0)
  );

  // Otomatik geçiş yok: kullanıcı kaydırdıkça dots güncellenecek.

  // Form yukarı kayma animasyonu - başlangıçta içerik aşağıda (görünmez)
  const formContentTranslateY = useSharedValue(200);
  const formContentOpacity = useSharedValue(0);
  const formHeight = useSharedValue(MIN_FORM_HEIGHT);

  const getMaxFormHeight = () => {
    // Form içeriğinin (özellikle sosyal giriş + bilgilendirme metni) kesilmemesi için
    // biraz daha yüksek limit veriyoruz.
    if (Platform.OS === "ios") return SCREEN_HEIGHT * 0.67;
    if (Platform.OS === "web") return SCREEN_HEIGHT * 0.55;
    // Android: düşük çözünürlük/ekranlarda sosyal butonlar sığsın diye biraz daha yüksek.
    return SCREEN_HEIGHT * 0.82;
  };

  // Pan gesture handler
  const startHeight = useSharedValue(MIN_FORM_HEIGHT);
  
  const panGesture = Gesture.Pan()
    // Küçük hareketlerde tetiklenmesin; yatay kaydırmaları da daha az yakalasın
    .activeOffsetY([-12, 12])
    .onStart(() => {
      startHeight.value = formHeight.value;
    })
    .onUpdate((event) => {
      // Yukarı çekme (negatif translationY) formu büyütür
      // Aşağı çekme (pozitif translationY) formu küçültür
      const newHeight = startHeight.value - event.translationY;
      // Minimum ve maksimum yükseklik limitleri
      const maxHeight = getMaxFormHeight();
      if (newHeight >= MIN_FORM_HEIGHT && newHeight <= maxHeight) {
        formHeight.value = newHeight;
        // İçerik pozisyonunu da güncelle
        const progress = (newHeight - MIN_FORM_HEIGHT) / (maxHeight - MIN_FORM_HEIGHT);
        formContentTranslateY.value = 200 * (1 - progress);
        formContentOpacity.value = progress;
      }
    })
    .onEnd((event) => {
      // Eğer yukarı çekilmişse (threshold: -50) formu genişlet
      if (event.translationY < -50) {
        const maxHeight = getMaxFormHeight();
        formHeight.value = withTiming(maxHeight, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        formContentTranslateY.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        formContentOpacity.value = withTiming(1, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        runOnJS(setIsFormExpanded)(true);
      } else {
        // Aşağı indir
        formHeight.value = withTiming(MIN_FORM_HEIGHT, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        formContentTranslateY.value = withTiming(200, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        formContentOpacity.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        runOnJS(setIsFormExpanded)(false);
      }
    });

  // Form içeriği animasyon style'ı
  const formContentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: formContentTranslateY.value }],
    opacity: formContentOpacity.value,
  }));
  
  // Form container yükseklik animasyon style'ı
  const formContainerAnimatedStyle = useAnimatedStyle(() => ({
    height: formHeight.value,
  }));

  // Formu genişletme fonksiyonu
  const expandForm = () => {
    if (!isFormExpanded) {
      const maxHeight = getMaxFormHeight();
      formHeight.value = withTiming(maxHeight, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      formContentTranslateY.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      formContentOpacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      setIsFormExpanded(true);
    }
  };

  // Formu genişletme/kapama fonksiyonu (logo ve başlık için)
  const toggleForm = () => {
    if (isFormExpanded) {
      // Formu kapat
      formHeight.value = withTiming(MIN_FORM_HEIGHT, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      formContentTranslateY.value = withTiming(200, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      formContentOpacity.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
      setIsFormExpanded(false);
    } else {
      // Formu aç
      expandForm();
    }
  };

  // Klavye durumunu dinle
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardVisible(true);
      setKeyboardWasOpened(true); // Klavye açıldı, flag'i set et
      // iOS'ta klavye yüksekliğini al
      if (Platform.OS === 'ios') {
        setKeyboardHeight(e.endCoordinates.height);
      }
    });
    const keyboardDidHideListener = Keyboard.addListener("keyboardDidHide", () => {
      // Android'de footer butonlarıyla klavye kapatıldığında da tetiklenmesi için kısa bir gecikme
      if (Platform.OS === 'android') {
        setTimeout(() => {
          setKeyboardVisible(false);
        }, 150);
      } else {
        setKeyboardVisible(false);
        setKeyboardHeight(0); // iOS'ta klavye kapandığında yüksekliği sıfırla
      }
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // İngilizce hata mesajlarını Türkçeye çeviren fonksiyon
  const translateError = (errorMessage: string): string => {
    const translations: Record<string, string> = {
      "Password should be at least 6 characters": "Şifre en az 6 karakter olmalıdır.",
      "Email format is invalid": "Geçersiz e-posta formatı.",
      "User already registered": "Bu e-posta ile kayıtlı bir kullanıcı zaten var.",
      "Invalid login credentials": "E-posta veya şifre hatalı.",
      "Email not confirmed": "E-posta adresinizi doğrulamanız gerekiyor.",
      "User not found": "Kullanıcı bulunamadı.",
      "AuthApiError: User already exists": "Bu e-posta adresiyle bir hesap zaten var.",
      "AuthApiError: Password should be at least 6 characters": "Şifreniz en az 6 karakter olmalıdır.",
      "Unsupported provider: missing OAuth secret": "Apple ile giriş için Supabase'de Apple OAuth ayarlarında 'Client secret' eksik. Supabase Dashboard → Auth → Providers → Apple kısmına Services ID ve Secret girmeniz gerekiyor.",
      "missing OAuth secret": "OAuth için gerekli secret eksik. Supabase Dashboard → Auth → Providers kısmında ilgili sağlayıcı için Client secret tanımlayın.",
    };

    return translations[errorMessage] || `Hata: ${errorMessage}`;
  };

 

  // Başarılı giriş sonrası geçiş
  const navigateTo = (destination: string) => {
    console.log("navigateTo çağrıldı:", destination);
    setIsLoading(false);
    router.replace(destination as any);
  };

  const handlePostLogin = async (userId: string, userEmail?: string | null) => {
    // Kullanıcı ID'sini AsyncStorage içine kaydet
    await AsyncStorage.setItem("userId", userId);

    // Kullanıcının bilgilerini çek
    const { data: userInfo, error: userError } = await supabase
      .from("users")
      .select("name, surname, age, height, weight, description")
      .eq("id", userId)
      .single();

    // Eğer kullanıcı kaydı yoksa oluştur
    if (userError && (userError as any).code === "PGRST116") {
      console.log("Kullanıcı kaydı bulunamadı, oluşturuluyor...");
      const { error: insertError } = await supabase.from("users").insert([
        {
          id: userId,
          email: userEmail ?? null,
          name: "Yeni Kullanıcı",
          surname: "",
          age: null,
          height: null,
          weight: null,
          description: "",
          created_at: new Date(),
        },
      ]);

      if (insertError) {
        console.error("Kullanıcı bilgileri eklenirken hata oluştu:", insertError.message);
        Alert.alert("Hata", "Kullanıcı kaydı oluşturulamadı. Lütfen tekrar deneyin.");
        setIsLoading(false);
        setIsOAuthLoading(null);
        return;
      }

      navigateTo("/(tabs)/profile?firstLogin=true");
      return;
    }

    if (userError) {
      console.error("Kullanıcı bilgileri alınırken hata oluştu:", userError.message);
      navigateTo("/(tabs)/profile?firstLogin=true");
      return;
    }

    const hasMissingFields = !userInfo?.name || !userInfo?.surname || !userInfo?.age ||
      !userInfo?.height || !userInfo?.weight || !userInfo?.description;

    if (hasMissingFields) {
      navigateTo("/(tabs)/profile?firstLogin=true");
    } else {
      navigateTo("/(tabs)/profile");
    }
  };

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const getOAuthRedirectUri = () => {
    // Supabase Auth -> URL Configuration -> Additional Redirect URLs içine eklenmeli.
    // Dev-client / standalone için custom scheme ile doğru deep link üretmek için makeRedirectUri kullan.
    // Web için expo-linking ile site URL üretmek daha doğru.
    if (Platform.OS === "web") return Linking.createURL("auth/callback");

    const scheme =
      (Constants.expoConfig as any)?.scheme ||
      (Constants.expoConfig as any)?.ios?.scheme ||
      (Constants.expoConfig as any)?.android?.scheme ||
      "myapp";

    return makeRedirectUri({ scheme, path: "auth/callback" });
  };

  const createSessionFromRedirectUrl = async (url: string) => {
    const { params, errorCode } = QueryParams.getQueryParams(url);
    if (errorCode) throw new Error(errorCode);

    const code = (params as any)?.code as string | undefined;
    const access_token = (params as any)?.access_token as string | undefined;
    const refresh_token = (params as any)?.refresh_token as string | undefined;

    if (code) {
      const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw exchangeError;
      return exchanged?.session ?? null;
    }

    if (access_token && refresh_token) {
      const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      return data?.session ?? null;
    }

    return null;
  };

  const signInWithOAuth = async (provider: "google" | "apple") => {
    const redirectUri = getOAuthRedirectUri();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    // Native: auth session ile URL'i açıp geri dön
    if (Platform.OS !== "web") {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type !== "success" || !result.url) {
        throw new Error("Giriş iptal edildi.");
      }

      await createSessionFromRedirectUrl(result.url);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData?.user?.id;
      const userEmail = userData?.user?.email;
      if (!userId) throw new Error("Kullanıcı bilgisi alınamadı.");

      await handlePostLogin(userId, userEmail);
      return;
    }

    // Web: supabase redirect yapacağı için burada genelde devam etmeyiz
  };

  const handleGoogleSignIn = async () => {
    if (isOAuthLoading) return;
    setIsOAuthLoading("google");
    try {
      await signInWithOAuth("google");
    } catch (error: any) {
      Alert.alert("Hata", translateError(error?.message || "Bilinmeyen hata"));
    } finally {
      setIsOAuthLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    if (isOAuthLoading) return;
    setIsOAuthLoading("apple");
    try {
      // iOS: native Apple Sign-In
      const isExpoGo = Constants.appOwnership === "expo";

      // Expo Go'da Apple native token aud = host.exp.Exponent olur ve Supabase'de audience mismatch çıkar.
      // Bu yüzden Expo Go'da web OAuth akışına düş.
      if (Platform.OS === "ios" && isExpoGo) {
        await signInWithOAuth("apple");
        return;
      }

      if (Platform.OS === "ios") {
        // Native Apple Sign-In (token Supabase'e gider)
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce
        );
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          ],
          nonce: hashedNonce,
        });

        if (!credential.identityToken) {
          throw new Error("Apple kimlik doğrulama başarısız (token alınamadı).");
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
          nonce: rawNonce,
          access_token: credential.authorizationCode ?? undefined,
        } as any);

        if (error) throw error;

        // Apple isim bilgisini sadece ilk girişte verir; varsa metadata'ya kaydet.
        if (credential.fullName?.givenName || credential.fullName?.familyName) {
          const fullName = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ");
          await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              given_name: credential.fullName.givenName ?? null,
              family_name: credential.fullName.familyName ?? null,
            },
          });
        }

        const userId = data?.user?.id ?? (await supabase.auth.getUser()).data?.user?.id;
        const userEmail = data?.user?.email ?? (await supabase.auth.getUser()).data?.user?.email;
        if (!userId) throw new Error("Kullanıcı bilgisi alınamadı.");

        await handlePostLogin(userId, userEmail);
      } else {
        // Web: OAuth (Apple provider)
        await signInWithOAuth("apple");
      }

    } catch (error: any) {
      Alert.alert("Hata", translateError(error?.message || "Bilinmeyen hata"));
    } finally {
      setIsOAuthLoading(null);
    }
  };

  const handleAuth = async () => {
    Keyboard.dismiss();
    
    if (!email.trim() || !password.trim()) {
      return Alert.alert("Hata", "Lütfen tüm alanları doldurun.");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Alert.alert("Hata", "Geçersiz e-posta formatı.");
    }

    if (password.length < 6) {
      return Alert.alert("Hata", "Şifre en az 6 karakter olmalıdır.");
    }

    setIsLoading(true);

    try {
      let data, error;

      if (isLogin) {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
      } else {
        const redirectUrl = Linking.createURL("/email-confirmed");
        ({ data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectUrl },
        }));

        // Kayıt başarılı olduysa users tablosuna eklemeyi dene
        // (Trigger varsa otomatik oluşur, yoksa ilk girişte oluşturulacak)
        if (!error && data?.user) {
          console.log("Kayıt başarılı, users tablosuna ekleme deneniyor...");
          const { error: insertError } = await supabase.from("users").insert([
            {
              id: data.user.id,
              email: data.user.email,
              name: "Yeni Kullanıcı",
              surname: "",
              age: null,
              height: null,
              weight: null,
              description: "",
              created_at: new Date(),
            },
          ]);

          if (insertError) {
            console.log("Kayıt sırasında users tablosuna eklenemedi (normal, ilk girişte oluşturulacak):", insertError.message);
            // Hata normal, çünkü kullanıcı henüz authenticated değil
            // İlk girişte otomatik oluşturulacak
          } else {
            console.log("Kullanıcı kaydı başarıyla oluşturuldu!");
          }
        }
      }

      if (error) throw error;

      console.log("Auth başarılı, isLogin:", isLogin, "data:", data);
      
      if (isLogin && data?.user) {
        console.log("Login başarılı, user:", data.user.id);
        await handlePostLogin(data.user.id, data.user.email);
      } else {
        // Kayıt başarılı
        setIsLoading(false);
        Alert.alert("Başarılı", "Kayıt başarılı! E-postanızı doğrulamanız gerekmektedir. E-postanızı kontrol ederek mail adresinizi doğrulayınız!");
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert("Hata", translateError(error?.message || "Bilinmeyen hata"));
    }
  };

  return (
    // ÖNEMLİ: NativeWind herhangi bir sebeple çalışmasa bile ekranın "0 yükseklik" kalmaması için
    // kritik layout değerlerini inline style ile garanti ediyoruz. (Beyaz ekranı keser)
    <SafeAreaView
      className="flex-1 bg-gray-100"
      style={{ flex: 1, backgroundColor: "#f3f4f6" }}
      edges={["top"]}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Arka plan içeriği - ScrollView içinde */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          scrollEnabled={false}
        >
          {/* Header */}
          <View 
            className="bg-green-700 px-2"
            style={{
              height: 90,
              position: 'relative',
              overflow: 'hidden',
            }}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w && w > 0) headerWidthSV.value = w;
            }}
          >
            {/* Futbol sahası çizgileri efekti */}
            <View 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                opacity: 0.8,
              }}>
              {/* Üst dış çizgi - 1px boşluk ile */}
              <View style={{ 
                position: 'absolute', 
                top: 1, 
                left: 1, 
                right: 1, 
                height: 2, 
                backgroundColor: 'white',
              }} />
              
              {/* Alt dış çizgi - 1px boşluk ile */}
              <View style={{ 
                position: 'absolute', 
                bottom: 1, 
                left: 1, 
                right: 1, 
                height: 2, 
                backgroundColor: 'white',
              }} />
              
              {/* Sol dış çizgi - 1px boşluk ile */}
              <View style={{ 
                position: 'absolute', 
                top: 1, 
                bottom: 1, 
                left: 1, 
                width: 2, 
                backgroundColor: 'white',
              }} />
              
              {/* Sağ dış çizgi - 1px boşluk ile */}
              <View style={{ 
                position: 'absolute', 
                top: 1, 
                bottom: 1, 
                right: 1, 
                width: 2, 
                backgroundColor: 'white',
              }} />
              
              {/* Orta saha çizgisi */}
              <View style={{ 
                position: 'absolute', 
                left: '50%', 
                top: 1, 
                bottom: 1, 
                width: 2, 
                backgroundColor: 'white',
                transform: [{ translateX: -1 }]
              }} />
              
              {/* Orta yuvarlak */}
              <View style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%', 
                width: 60, 
                height: 60, 
                borderWidth: 2, 
                borderColor: 'white',
                borderRadius: 30,
                transform: [{ translateX: -30 }, { translateY: -30 }]
              }} />
              
              {/* Sol kale - İç çizgiler (file gibi) */}
              <View style={{
                position: 'absolute',
                left: 1,
                top: '25%',
                bottom: '25%',
                width: 25,
                borderWidth: 2,
                borderColor: 'white',
                borderRightWidth: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
              }} />
              
              {/* Sol ceza sahası - Yan çizgiler (kale yan çizgisinden ayrı) */}
              <View style={{
                position: 'absolute',
                left: 3,
                top: '15%',
                width: 40,
                height: 2,
                backgroundColor: 'white',
              }} />
              <View style={{
                position: 'absolute',
                left: 3,
                bottom: '15%',
                width: 40,
                height: 2,
                backgroundColor: 'white',
              }} />
              
              {/* Sol ceza sahası - Ön çizgi (dikey) */}
              <View style={{
                position: 'absolute',
                left: 42,
                top: '15%',
                bottom: '15%',
                width: 2,
                backgroundColor: 'white',
              }} />
              
              {/* Sol penaltı noktası */}
              <View style={{
                position: 'absolute',
                left: 32,
                top: '50%',
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'white',
                transform: [{ translateX: -2 }, { translateY: -2 }],
              }} />
              
              {/* Sağ kale - İç çizgiler (file gibi) */}
              <View style={{
                position: 'absolute',
                right: 1,
                top: '25%',
                bottom: '25%',
                width: 25,
                borderWidth: 2,
                borderColor: 'white',
                borderLeftWidth: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
              }} />
              
              {/* Sağ ceza sahası - Yan çizgiler (kale yan çizgisinden ayrı) */}
              <View style={{
                position: 'absolute',
                right: 3,
                top: '15%',
                width: 40,
                height: 2,
                backgroundColor: 'white',
              }} />
              <View style={{
                position: 'absolute',
                right: 3,
                bottom: '15%',
                width: 40,
                height: 2,
                backgroundColor: 'white',
              }} />
              
              {/* Sağ ceza sahası - Ön çizgi (dikey) */}
              <View style={{
                position: 'absolute',
                right: 42,
                top: '15%',
                bottom: '15%',
                width: 2,
                backgroundColor: 'white',
              }} />
              
              {/* Sağ penaltı noktası */}
              <View style={{
                position: 'absolute',
                right: 32,
                top: '50%',
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: 'white',
                transform: [{ translateX: 2 }, { translateY: -2 }],
              }} />
            </View>
            
            {/* İçerik */}
            <View style={{ width: '100%', height: '100%', zIndex: 1, position: 'relative' }}>
              {/* Orta nokta işareti */}
              <View style={{ 
                position: 'absolute', 
                top: '50%', 
                left: '50%',
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: 'white',
                transform: [{ translateX: -3 }, { translateY: -3 }],
              }} />

              {/* Minik top: saha içinde sürekli gezer */}
              <Animated.Image
                source={require('../../assets/images/ball.png')}
                style={[
                  {
                    position: 'absolute',
                    width: BALL_SIZE,
                    height: BALL_SIZE,
                    zIndex: 2,
                  },
                  ballAnimatedStyle,
                ]}
                resizeMode="contain"
              />

              {/* SAHAYABAK: 10-15sn'de bir kısa flash */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 3,
                }}
              >
                <Animated.Text
                  style={[
                    {
                      color: 'white',
                      fontWeight: '900',
                      letterSpacing: 3,
                      fontSize: 16,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: 'rgba(0,0,0,0.22)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.55)',
                    },
                    brandAnimatedStyle,
                  ]}
                >
                  S A H A Y A B A K
                </Animated.Text>
              </View>
              
            </View>
          </View>
          
          {/* Uygulamayı tanıtan slider (5 slide) */}
          <View
            className="flex-1 pt-4"
            style={{ height: introHeight, paddingHorizontal: 5 }}
          >
            <View
              style={{ flex: 1 }}
              onLayout={(e) => {
                // paddingHorizontal: 5 olduğu için içerik genişliği = layout.width
                const w = e.nativeEvent.layout.width;
                if (w && Math.abs(w - introWidth) > 1) {
                  setIntroWidth(w);
                  introWidthSV.value = w;
                }
              }}
            >
            <View className="bg-white rounded-2xl overflow-hidden shadow-sm" style={{ flex: 1, position: 'relative' }}>
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
                renderItem={({ item }: any) => (
                  <View style={{ width: introWidth, flex: 1 }}>
                    <Image
                      source={item.image}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />

                    <View
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 12,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        zIndex: 2,
                      }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#065f46' }} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={{ color: '#374151', marginTop: 2 }} numberOfLines={2}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </View>
                )}
              />

            </View>
            </View>
          </View>
        </ScrollView>

        {/* Pagination dots (formun hemen üstünde sabit) */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: MIN_FORM_HEIGHT + 12,
            alignItems: 'center',
            zIndex: 15,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderWidth: 2,
              borderColor: '#16a34a',
              ...(Platform.OS === 'android'
                ? { elevation: 6 }
                : {
                    shadowColor: '#000',
                    shadowOpacity: 0.18,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                  }),
            }}
          >
            <View style={{ width: dotsWidth, height: DOT_SIZE, position: 'relative' }}>
              <View style={{ flexDirection: 'row' }}>
                {INTRO_SLIDES.map((s, idx) => (
                  <View
                    key={s.key}
                    style={{
                      width: DOT_SIZE,
                      height: DOT_SIZE,
                      borderRadius: DOT_SIZE / 2,
                      backgroundColor: 'rgba(0,0,0,0.22)',
                      marginRight: idx === INTRO_SLIDES.length - 1 ? 0 : DOT_GAP,
                    }}
                  />
                ))}
              </View>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: DOT_SIZE / 2,
                    backgroundColor: '#16a34a',
                  },
                  activeDotStyle,
                ]}
              />
            </View>
          </View>
        </View>

        {/* Giriş Formu - ScrollView dışında, altta sabit - Animasyonlu */}
        <Animated.View 
            className="bg-white rounded-t-3xl shadow-2xl"
            style={[
              formContainerAnimatedStyle,
              { 
                position: 'absolute',
                bottom: Platform.OS === 'ios' ? keyboardHeight : 0,
                left: 0,
                right: 0,
                zIndex: 20,
                // Web'de (özellikle Animated.View + NativeWind) className'deki bg-white bazen uygulanmıyor.
                // Bu yüzden arka planı inline garanti ediyoruz.
                backgroundColor: '#ffffff',
                // Ayarlar modalındaki gibi çerçeve
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                borderTopWidth: 4,
                borderTopColor: '#16a34a',
                borderLeftWidth: 2,
                borderRightWidth: 2,
                borderLeftColor: '#16a34a',
                borderRightColor: '#16a34a',
                // Üst çizgiye gölge etkisi (container shadow)
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 12,
                // Web'de burada 30px boşluk kalıyordu; web için paddingBottom'u kaldır.
                paddingBottom:
                  Platform.OS === 'web'
                    ? 0
                    : Platform.OS === 'ios'
                      ? 30
                      : (keyboardVisible ? 0 : (keyboardWasOpened ? 30 : 30)),
              }
            ]}
          >
          {/* İçerik (köşeleri düzgün kırpmak için içeride overflow hidden) */}
          <View style={{ flex: 1, overflow: 'hidden', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: isFormExpanded ? 16 : 12,
              paddingBottom: Platform.OS === 'ios' && keyboardVisible && isFormExpanded ? 10 : 0,
            }}
          >
              {/* Drag alanı: sadece üst başlık/handle bölgesi.
                  Android'de alttan yukarı sistem gesture'ı (home) ile çakışmayı engeller. */}
              <GestureDetector gesture={panGesture}>
                <View>
                  {/* Drag indicator */}
                  <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-2" />
                  
                  {/* Logo ve Başlık - Her zaman görünür */}
                  <Pressable onPress={toggleForm}>
                    <View className="items-center" style={{ marginBottom: isFormExpanded ? 12 : 8 }}>
                      <View className="w-16 h-16 bg-green-700 rounded-full items-center justify-center mt-2 mb-3">
                        <Ionicons name="football" size={36} color="white" />
                      </View>
                      <Text className="text-2xl font-bold text-gray-800">
                        {isLogin ? "Hoş Geldin" : "Aramıza Katıl!"}
                      </Text>
                      <Text className="text-gray-700 mt-1">
                        {isLogin ? (
                          <>Sahaya çıkmak için <Text className="text-green-700 font-semibold">giriş yap</Text></>
                        ) : (
                          "Yeni bir hesap oluştur"
                        )}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </GestureDetector>

              {/* Form içeriği - Animasyonla yukarı kayacak */}
              <Animated.View style={formContentAnimatedStyle}>
              {/* E-Posta Girişi */}
              <View className="mb-3">
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                  <Ionicons name="mail-outline" size={20} color="#6B7280" />
                  <TextInput
                    className="flex-1 ml-3 text-gray-800"
                    placeholder="E-posta adresin"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    autoComplete="email"
                    value={email}
                    onChangeText={setEmail}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                    onFocus={() => {
                      // iOS'ta input'a tıklandığında formu genişlet
                      if (Platform.OS === 'ios' && !isFormExpanded) {
                        expandForm();
                      }
                    }}
                    onBlur={() => {
                      // Android'de input focus kaybettiğinde klavye durumunu kontrol et
                      if (Platform.OS === 'android') {
                        setTimeout(() => {
                          Keyboard.dismiss();
                          setKeyboardVisible(false);
                        }, 100);
                      }
                    }}
                  />
                </View>
              </View>

              {/* Şifre Girişi */}
              <View className="mb-4">
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                  <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
                  <TextInput
                    ref={passwordInputRef}
                    className="flex-1 ml-3 text-gray-800"
                    placeholder="Şifren"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="password"
                    autoCorrect={false}
                    value={password}
                    onChangeText={setPassword}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={handleAuth}
                    onFocus={() => {
                      // iOS'ta input'a tıklandığında formu genişlet
                      if (Platform.OS === 'ios' && !isFormExpanded) {
                        expandForm();
                      }
                    }}
                    onBlur={() => {
                      // Android'de input focus kaybettiğinde klavye durumunu kontrol et
                      if (Platform.OS === 'android') {
                        setTimeout(() => {
                          Keyboard.dismiss();
                          setKeyboardVisible(false);
                        }, 100);
                      }
                    }}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons 
                      name={showPassword ? "eye-outline" : "eye-off-outline"} 
                      size={20} 
                      color="#6B7280" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Giriş / Kayıt Butonu */}
              <Pressable 
                className="bg-green-700 py-4 rounded-xl flex-row items-center justify-center"
                onPress={handleAuth}
                disabled={isLoading}
                style={({ pressed }) => pressed && { opacity: 0.8 }}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text className="text-white font-bold text-lg">
                      {isLogin ? "Giriş Yap" : "Kayıt Ol"}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                  </>
                )}
              </Pressable>

              {/* Kayıt / Giriş arasında geçiş */}
              <TouchableOpacity 
                className="mb-0" 
                style={{ 
                  marginTop: Platform.OS === 'ios' && keyboardVisible ? 15 : (Platform.OS === 'android' && keyboardVisible ? 24 : 12),
                  // Web'de form açılınca (isFormExpanded) altta gereksiz boşluk oluşuyor; sadece web'de azalt.
                  paddingBottom:
                    Platform.OS === 'ios' && keyboardVisible
                      ? 8
                      : Platform.OS === 'android' && keyboardVisible
                        ? 0
                        : Platform.OS === 'web' && isFormExpanded
                          ? 0
                          : 12
                }}
                onPress={() => setIsLogin(!isLogin)}
              >
                <Text className="text-center text-gray-600">
                  {isLogin ? (
                    <>Hesabın yok mu? <Text className="text-green-700 font-semibold">Kayıt ol</Text></>
                  ) : (
                    <>Zaten hesabın var mı? <Text className="text-green-700 font-semibold">Giriş yap</Text></>
                  )}
                </Text>
              </TouchableOpacity>

              {/* Sosyal Giriş Butonları (Kayıt/Giriş metninin altında) */}
              {isLogin && (
                <View className="mt-4">
                  <View
                    className="flex-row items-center"
                    style={{ marginBottom: Platform.OS === "android" ? 16 : 32 }}
                  >
                    <View className="flex-1 h-px bg-gray-300" />
                    <Text className="mx-3 text-gray-500 font-semibold">veya</Text>
                    <View className="flex-1 h-px bg-gray-300" />
                  </View>

                  {/* Google (web + iOS + Android) */}
                  <Pressable
                    className="bg-white border-2 border-green-700 py-3 rounded-xl flex-row items-center justify-center mb-3"
                    onPress={handleGoogleSignIn}
                    disabled={isLoading || isOAuthLoading !== null}
                    style={({ pressed }) => pressed && { opacity: 0.85 }}
                  >
                    {isOAuthLoading === "google" ? (
                      <ActivityIndicator color="#15803d" />
                    ) : (
                      <>
                        <Ionicons name="logo-google" size={18} color="#15803d" style={{ marginRight: 10 }} />
                        <Text className="text-green-700 font-bold">
                          Google Hesabıyla Giriş Yap
                        </Text>
                      </>
                    )}
                  </Pressable>

                  {/* Apple (web + iOS) */}
                  {(Platform.OS === "web" || Platform.OS === "ios") && (
                    <Pressable
                      className={`py-3 rounded-xl flex-row items-center justify-center mb-3 ${
                        Platform.OS === "ios" ? (appleAvailable ? "bg-black" : "bg-gray-300") : "bg-black"
                      }`}
                      onPress={handleAppleSignIn}
                      disabled={(Platform.OS === "ios" && !appleAvailable) || isLoading || isOAuthLoading !== null}
                      style={({ pressed }) => pressed && { opacity: 0.85 }}
                    >
                      {isOAuthLoading === "apple" ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <>
                          <Ionicons name="logo-apple" size={18} color="white" style={{ marginRight: 10 }} />
                          <Text className="text-white font-bold">
                            Apple Hesabınla Giriş Yap
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  <Text
                    className="text-center text-xs text-gray-500"
                    style={{ marginTop: Platform.OS === "ios" ? 8 : 16 }}
                  >
                    Giriş yaptıktan sonra profil bilgilerini tamamlayabilirsin.
                  </Text>
                </View>
              )}
              </Animated.View>
          </View>
          </View>
          </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
