import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Pressable, ActivityIndicator, ScrollView, Keyboard, Dimensions, BackHandler } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/services/supabase";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { runOnJS } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPasswordChecks, getPasswordViolations } from "@/lib/passwordPolicy";
import {
  AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
} from "@/lib/authVerification";
import PolicyModal from "@/components/modals/PolicyModal";
import AuthFieldHeader from "@/components/auth/AuthFieldHeader";
import { translateAuthError } from "@/lib/authErrorMessages";
import {
  getOAuthRedirectUri,
  getOAuthSupabaseRedirectUrl,
  createSessionFromRedirectUrl,
} from "@/lib/oauthRedirect";
import type { PolicyKey } from "@/constants/policies";
import { getLastNonAuthRoute } from "@/lib/lastNonAuthRoute";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

WebBrowser.maybeCompleteAuthSession();

function decodeSearchParam(s: string): string {
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return s.trim();
  }
}

export default function AuthScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{
    afterVerify?: string | string[];
    e?: string | string[];
    type?: string | string[];
    from?: string | string[];
    recoveryDone?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const { currentLanguage, changeLanguage, t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [showAfterVerifyHint, setShowAfterVerifyHint] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isRecoveryDone, setIsRecoveryDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<"google" | "apple" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [policyModalKey, setPolicyModalKey] = useState<PolicyKey | null>(null);

  const passwordInputRef = useRef<TextInput>(null);

  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);

  // Native-stack'te beforeRemove ile prevent etmek uyarı üretebiliyor.
  // Bu yüzden native swipe/back'i kapatıp kendi geri davranışımızı uyguluyoruz.
  const isLeavingRef = useRef(false);
  const getBackTarget = useCallback(() => {
    const rawFrom = params.from;
    const from =
      typeof rawFrom === "string"
        ? decodeSearchParam(rawFrom)
        : Array.isArray(rawFrom) && rawFrom[0]
          ? decodeSearchParam(rawFrom[0])
          : "";
    return from || getLastNonAuthRoute() || "/(tabs)?guest=1";
  }, [params.from]);

  const goBackToOrigin = useCallback(() => {
    if (isLeavingRef.current) return;
    isLeavingRef.current = true;
    router.replace(getBackTarget() as any);
  }, [getBackTarget, router]);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: false,
    });
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      goBackToOrigin();
      return true;
    });
    return () => sub.remove();
  }, [goBackToOrigin]);

  const backSwipeGesture = Gesture.Pan()
    .activeOffsetX(18)
    .failOffsetY([-12, 12])
    .onEnd((event) => {
      if (event.translationX > 90 && Math.abs(event.translationY) < 80) {
        runOnJS(goBackToOrigin)();
      }
    });


  // Klavye durumunu dinle
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener("keyboardDidHide", () => {
      // Android'de footer butonlarıyla klavye kapatıldığında da tetiklenmesi için kısa bir gecikme
      if (Platform.OS === 'android') {
        setTimeout(() => {
          setKeyboardVisible(false);
        }, 150);
      } else {
        setKeyboardVisible(false);
      }
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Auth hata mesajlarını seçili dile göre çevir (eşleme tablosu lib/authErrorMessages.ts'te)
  const translateError = (errorMessage: string): string =>
    translateAuthError(errorMessage, t, currentLanguage);

  // Başarılı giriş sonrası geçiş
  const navigateTo = (destination: string) => {
    console.log("navigateTo çağrıldı:", destination);
    setIsLoading(false);
    router.replace(destination as any);
  };

  const handlePostLogin = async (userId: string, userEmail?: string | null) => {
    await AsyncStorage.removeItem(PENDING_VERIFICATION_EMAIL_KEY);
    setShowAfterVerifyHint(false);
    // Kullanıcı ID'sini AsyncStorage içine kaydet
    await AsyncStorage.setItem("userId", userId);
    // Giriş sayfasında zaten sözleşme onayı alındı; Mesajlar sayfasında tekrar modal gösterme
    await AsyncStorage.setItem(`ugc_messaging_agreed_${userId}`, "1");

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
        Alert.alert(t("general.error"), t("auth.userCreateFailed"));
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

  const resolveAndSetEmail = useCallback(async () => {
    const raw = params.afterVerify;
    const fromQuery = raw === "1" || (Array.isArray(raw) && raw[0] === "1");
    const redirectFlag = await AsyncStorage.getItem(AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY);
    const fromStorageFlag = redirectFlag === "1";
    if (!fromQuery && !fromStorageFlag) return;

    const rawE = params.e;
    const rawType = params.type;
    const isRecovery = rawType === "recovery" || (Array.isArray(rawType) && rawType[0] === "recovery");
    const rawDone = params.recoveryDone;
    const recoveryDone = rawDone === "1" || (Array.isArray(rawDone) && rawDone[0] === "1");
    
    const fromUrl =
      typeof rawE === "string"
        ? decodeSearchParam(rawE)
        : Array.isArray(rawE) && rawE[0]
          ? decodeSearchParam(rawE[0])
          : "";
    const stored = (await AsyncStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY))?.trim() ?? "";
    const resolvedEmail = fromUrl || stored;

    if (resolvedEmail) {
      setEmail(resolvedEmail);
    } else {
      // Son çare: mevcut session varsa e-postayı Supabase'den oku (oturum açmaz, sadece okur)
      try {
        const { data } = await supabase.auth.getUser();
        const em = data?.user?.email?.trim() ?? "";
        if (em) {
          setEmail(em);
          await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, em);
        }
      } catch {
        // ignore
      }
    }

    // E-posta doğrulama sonrası kullanıcıyı oturum açmış sayma; e-postayı çözdükten sonra session varsa temizle
    if (!isRecovery) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    setIsLogin(true);
    setAgreedToTerms(true);
    setShowAfterVerifyHint(true);
    setIsRecoveryMode(isRecovery);
    setIsRecoveryDone(isRecovery && recoveryDone);

    if (fromStorageFlag) {
      await AsyncStorage.removeItem(AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY);
    }
  }, [params.afterVerify, params.e, params.type, params.recoveryDone]);

  useEffect(() => {
    resolveAndSetEmail();
  }, [resolveAndSetEmail]);

  // E-posta doğrulama sonrası giriş: bayrak + e-posta.
  useFocusEffect(
    useCallback(() => {
      resolveAndSetEmail();
    }, [resolveAndSetEmail])
  );

  const signInWithOAuth = async (provider: "google" | "apple") => {
    const redirectUri = getOAuthRedirectUri();
    const supabaseRedirectTo = getOAuthSupabaseRedirectUrl();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: supabaseRedirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    // Native: auth session ile URL'i açıp geri dön
    if (Platform.OS !== "web") {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      if (result.type !== "success" || !result.url) {
        throw new Error(t("auth.signInCancelled"));
      }

      await createSessionFromRedirectUrl(result.url);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userData?.user?.id;
      const userEmail = userData?.user?.email;
      if (!userId) throw new Error(t("auth.userInfoMissing"));

      await handlePostLogin(userId, userEmail);
      return;
    }

    // Web: supabase redirect yapacağı için burada genelde devam etmeyiz
  };

  const handleGoogleSignIn = async () => {
    if (isOAuthLoading) return;
    if (!agreedToTerms) {
      Alert.alert(t("general.error"), t("auth.agreeToTermsRequired"));
      return;
    }
    setIsOAuthLoading("google");
    try {
      await signInWithOAuth("google");
    } catch (error: any) {
      Alert.alert(t("general.error"), translateError(error?.message || t("auth.unknownError")));
    } finally {
      setIsOAuthLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    if (isOAuthLoading) return;
    if (!agreedToTerms) {
      Alert.alert(t("general.error"), t("auth.agreeToTermsRequired"));
      return;
    }
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
          throw new Error(t("auth.appleAuthFailed"));
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
        if (!userId) throw new Error(t("auth.userInfoMissing"));

        await handlePostLogin(userId, userEmail);
      } else {
        // Web: OAuth (Apple provider)
        await signInWithOAuth("apple");
      }

    } catch (error: any) {
      Alert.alert(t("general.error"), translateError(error?.message || t("auth.unknownError")));
    } finally {
      setIsOAuthLoading(null);
    }
  };

  const handleAuth = async () => {
    Keyboard.dismiss();

    if (!agreedToTerms) {
      return Alert.alert(t("general.error"), t("auth.agreeToTermsRequired"));
    }
    
    if (!email.trim() || !password.trim()) {
      return Alert.alert(t("general.error"), t("auth.fillAllFields"));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Alert.alert(t("general.error"), t("auth.invalidEmail"));
    }

    if (!isLogin) {
      const violations = getPasswordViolations(password);
      if (violations.length > 0) {
        return Alert.alert(
          t("general.error"),
          [
            "Şifreniz en az 8 karakter olmalıdır.",
            "En az 1 büyük harf, 1 küçük harf, sembol ve sayılardan oluşmalıdır.",
            "Ardaşık sayılar olmamalıdır.",
          ].join("\n")
        );
      }
    } else {
      // login'de sadece minimum kontrol (eski davranış)
      if (password.length < 6) {
        return Alert.alert(t("general.error"), t("auth.passwordMin"));
      }
    }

    setIsLoading(true);

    try {
      let data, error;

      if (isLogin) {
        ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
      } else {
        // E-posta doğrulama linki tarayıcıda açılır; web callback hash'i alıp uygulamaya yönlendirir.
        const webBaseUrl = (Constants.expoConfig as any)?.extra?.webBaseUrl;
        const eVal = email.trim();
        const normalizedEmail = eVal.toLowerCase();
        const scheme = ((Constants.expoConfig as any)?.scheme as string) || "myapp";
        let redirectUrl =
          Platform.OS === "web"
            ? Linking.createURL("auth/callback")
            : webBaseUrl
              ? `${webBaseUrl.replace(/\/$/, "")}/auth/callback.html`
              : Linking.createURL("/email-confirmed");

        // dev/prod ayrımı: callback.html?s=myapp-dev → doğru uygulamayı açar
        redirectUrl += (redirectUrl.includes("?") ? "&" : "?") + `s=${encodeURIComponent(scheme)}`;

        if (eVal) {
          redirectUrl += (redirectUrl.includes("?") ? "&" : "?") + `e=${encodeURIComponent(eVal)}`;
        }

        // Kayıt öncesi users tablosunda aynı e-posta var mı kontrol et.
        // Varsa kullanıcıyı yeni kayıt yerine şifre sıfırlamaya yönlendir.
        const { data: existingUser, error: existingUserError } = await supabase
          .from("users")
          .select("id")
          .ilike("email", normalizedEmail)
          .limit(1)
          .maybeSingle();

        if (existingUserError) throw existingUserError;

        if (existingUser) {
          setIsLoading(false);
          Alert.alert(
            t("general.error"),
            t("auth.signupEmailExistsResetHint"),
            [
              { text: t("general.cancel"), style: "cancel" },
              { text: t("auth.forgotPassword"), onPress: () => handleForgotPassword() },
            ]
          );
          return;
        }

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

      // Kayıt sonrası doğrulama akışı: e-posta her zaman saklansın (data.user yoksa bile formdaki email)
      if (!isLogin) {
        const signupEmail = (data?.user?.email ?? email).trim();
        if (signupEmail) {
          await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, signupEmail);
        }
        // Kayıt sonrası e-posta doğrulaması beklenirken yerel oturumu temizle
        // Bu sayede AuthContext kullanıcıyı hemen "giriş yapmış" görmez.
        await supabase.auth.signOut();
      }

      console.log("Auth başarılı, isLogin:", isLogin, "data:", data);
      
      if (isLogin && data?.user) {
        console.log("Login başarılı, user:", data.user.id);
        await handlePostLogin(data.user.id, data.user.email);
      } else {
        setIsLoading(false);
        Alert.alert(t("general.success"), t("auth.signupSuccessVerifyEmail"));
      }
    } catch (error: any) {
      setIsLoading(false);
      Alert.alert(t("general.error"), translateError(error?.message || t("auth.unknownError")));
    }
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();
    const normalizedEmail = trimmedEmail.toLowerCase();
    if (!trimmedEmail) {
      Alert.alert(t("general.error"), t("auth.forgotPasswordEnterEmail"));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert(t("general.error"), t("auth.invalidEmail"));
      return;
    }

    const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
    const RATE_MAX = 2; // Supabase rate limit: 2 emails/hour (project setting)
    const MIN_SPACING_MS = 60 * 1000; // some flows also enforce ~60s spacing
    const rlKey = `rate_limit:reset_password:${trimmedEmail.toLowerCase()}`;

    const formatRemaining = (ms: number) => {
      const s = Math.max(0, Math.ceil(ms / 1000));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if (currentLanguage === "en") {
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${sec}s`;
        return `${sec}s`;
      }
      // tr
      if (h > 0) return `${h} saat ${m} dk`;
      if (m > 0) return `${m} dk ${sec} sn`;
      return `${sec} sn`;
    };

    const isEmailRateLimitError = (msg: string) => {
      const s = (msg || "").toLowerCase();
      return s.includes("rate limit") || s.includes("60 seconds") || s.includes("email rate limit exceeded");
    };

    const readAttempts = async (): Promise<number[]> => {
      try {
        const raw = await AsyncStorage.getItem(rlKey);
        const arr = raw ? (JSON.parse(raw) as any[]) : [];
        const nums = arr
          .map((x) => (typeof x === "number" ? x : typeof x === "string" ? parseInt(x, 10) : NaN))
          .filter((n) => Number.isFinite(n)) as number[];
        nums.sort((a, b) => a - b);
        return nums;
      } catch {
        return [];
      }
    };

    const writeAttempts = async (attempts: number[]) => {
      try {
        await AsyncStorage.setItem(rlKey, JSON.stringify(attempts));
      } catch {
        // ignore
      }
    };

    const prune = (attempts: number[], now: number) =>
      attempts.filter((ts) => ts >= now - RATE_WINDOW_MS).sort((a, b) => a - b);

    const computeRemainingMs = (attempts: number[], now: number) => {
      const pruned = prune(attempts, now);
      // hourly limit
      if (pruned.length >= RATE_MAX) {
        return pruned[0] + RATE_WINDOW_MS - now;
      }
      // short spacing
      if (pruned.length >= 1) {
        const last = pruned[pruned.length - 1];
        const rem = last + MIN_SPACING_MS - now;
        if (rem > 0) return rem;
      }
      return 0;
    };

    // Client-side: show exact remaining time for this device/email
    const now = Date.now();
    const attemptsBefore = await readAttempts();
    const remBefore = computeRemainingMs(attemptsBefore, now);
    if (remBefore > 0) {
      const timeText = formatRemaining(remBefore);
      const msg =
        currentLanguage === "en"
          ? `Too many attempts. Please try again in ${timeText}.`
          : `Çok fazla deneme yaptınız. Güvenlik nedeniyle ${timeText} sonra tekrar deneyin.`;
      Alert.alert(t("general.error"), msg);
      return;
    }

    setIsLoading(true);
    try {
      const { data: existingUser, error: existingUserError } = await supabase
        .from("users")
        .select("id")
        .in("email", [trimmedEmail, normalizedEmail])
        .maybeSingle();

      if (existingUserError) throw existingUserError;
      if (!existingUser) {
        Alert.alert(t("general.error"), t("auth.forgotPasswordEmailNotFound"));
        return;
      }

      // Native'de hash fragment mobilde kaybolduğu için önce web sayfamıza yönlendiriyoruz.
      // Web sayfası hash'i okuyup myapp://auth/callback?access_token=... olarak uygulamaya yönlendirir.
      const webBaseUrl = (Constants.expoConfig as any)?.extra?.webBaseUrl;
      const scheme = ((Constants.expoConfig as any)?.scheme as string) || "myapp";
      const redirectTo =
        Platform.OS === "web"
          ? Linking.createURL("auth/callback")
          : webBaseUrl
            ? `${webBaseUrl.replace(/\/$/, "")}/auth/callback.html`
            : getOAuthRedirectUri();
      // dev/prod ayrımı: callback.html?s=myapp-dev → doğru uygulamayı açar
      const redirectToWithScheme = redirectTo + (redirectTo.includes("?") ? "&" : "?") + `s=${encodeURIComponent(scheme)}`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo: redirectToWithScheme });
      if (error) throw error;
      // record successful request time for remaining-time messaging
      const after = prune([...attemptsBefore, now], now);
      await writeAttempts(after);
      Alert.alert(t("general.success"), t("auth.forgotPasswordSuccess"));
    } catch (error: any) {
      const errMsg = error?.message || "";
      if (isEmailRateLimitError(errMsg)) {
        const attempts = prune([...attemptsBefore, now], now);
        await writeAttempts(attempts);
        const rem = computeRemainingMs(attempts, now);
        const timeText = rem > 0 ? formatRemaining(rem) : (currentLanguage === "en" ? "a while" : "bir süre");
        const msg =
          currentLanguage === "en"
            ? `Too many attempts. Please try again in ${timeText}.`
            : `Çok fazla deneme yaptınız. Güvenlik nedeniyle ${timeText} sonra tekrar deneyin.`;
        Alert.alert(t("general.error"), msg);
      } else {
        const msg = errMsg ? translateError(errMsg) : t("auth.forgotPasswordError");
        Alert.alert(t("general.error"), msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GestureDetector gesture={backSwipeGesture}>
      {/* ÖNEMLİ: NativeWind herhangi bir sebeple çalışmasa bile ekranın "0 yükseklik" kalmaması için
          kritik layout değerlerini inline style ile garanti ediyoruz. (Beyaz ekranı keser) */}
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
          <AuthFieldHeader />
          
          {/* Beyaz alan - kenarlıksız, tüm alanı kaplayan giriş formu */}
          <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
            <ScrollView
              contentContainerStyle={{ 
                flexGrow: 1, 
                minHeight: Math.max(400, SCREEN_HEIGHT - 90 - 80),
                paddingBottom:
                  Platform.OS === 'web'
                    ? 48
                    : Platform.OS === 'android'
                      ? (insets.bottom > 0 ? insets.bottom + 8 : 0)
                      : 0
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
            >
              <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, flex: 1 }}>
                  {/* Logo ve Başlık */}
                  <View className="items-center" style={{ marginBottom: 18, width: '100%', position: 'relative' }}>
                      {/* Dil seçimi (tek buton + açılır menü) */}
                      <View style={{ position: 'absolute', right: 0, top: 0, alignItems: 'flex-end', zIndex: 50 }}>
                        <TouchableOpacity
                          onPress={() => setLanguageMenuOpen(v => !v)}
                          activeOpacity={0.85}
                          accessibilityRole="button"
                          accessibilityLabel={currentLanguage === 'tr' ? 'Türkçe' : 'English'}
                        >
                          <View
                            style={{
                              width: 30,
                              height: 24,
                              borderRadius: 7,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(22,163,74,0.16)',
                              borderWidth: 1,
                              borderColor: '#16a34a',
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.25,
                              shadowRadius: 6,
                              elevation: 4,
                            }}
                          >
                            <Text style={{ fontSize: 18, opacity: 1 }}>
                              {currentLanguage === 'tr' ? '🇹🇷' : '🇬🇧'}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {languageMenuOpen && (
                          <View style={{ marginTop: 2 }}>
                            <TouchableOpacity
                              onPress={() => {
                                const next = currentLanguage === 'tr' ? 'en' : 'tr';
                                setLanguageMenuOpen(false);
                                void changeLanguage(next);
                              }}
                              activeOpacity={0.85}
                              accessibilityRole="button"
                              accessibilityLabel={currentLanguage === 'tr' ? 'English' : 'Türkçe'}
                            >
                              <View
                                style={{
                                  width: 30,
                                  height: 22,
                                  borderRadius: 7,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: 'rgba(0,0,0,0.06)',
                                  borderWidth: 1,
                                  borderColor: 'rgba(17,24,39,0.15)',
                                }}
                              >
                                <Text style={{ fontSize: 16, opacity: 0.9 }}>
                                  {currentLanguage === 'tr' ? '🇬🇧' : '🇹🇷'}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Text className="text-2xl font-bold text-gray-800">
                        {isLogin ? t('auth.welcomeTitle') : t('auth.joinTitle')}
                      </Text>
                      {showAfterVerifyHint ? (
                        <View
                          style={{
                            marginTop: 6,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            backgroundColor: "#dcfce7",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#86efac",
                            width: "100%",
                            maxWidth: 400,
                          }}
                        >
                          <Text style={{ color: "#166534", fontSize: 14, textAlign: "center", fontWeight: "600" }}>
                            {isRecoveryMode
                              ? (isRecoveryDone
                                  ? t("auth.passwordResetCompletedHint")
                                  : t("auth.passwordResetSuccessHint"))
                              : t("auth.afterVerifySignInHint")}
                          </Text>
                        </View>
                      ) : null}
                      <Text className="text-gray-700 mt-1">
                        {isLogin ? (
                          <>
                            {t('auth.subtitleLoginPrefix')}{' '}
                            <Text className="text-green-700 font-semibold">{t('auth.subtitleLoginAction')}</Text>
                          </>
                        ) : (
                          t('auth.subtitleSignup')
                        )}
                      </Text>
                    </View>
                  </View>

              {/* Form içeriği */}
              <View>
              {/* E-Posta Girişi */}
              <View style={{ marginBottom: 8 }}>
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                  <Ionicons name="mail-outline" size={20} color="#6B7280" />
                  <TextInput
                    className="flex-1 ml-3 text-gray-800"
                    placeholder={t('auth.emailPlaceholder')}
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
                    onFocus={() => {}}
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
              <View style={{ marginBottom: 8 }}>
                <View className="flex-row items-center bg-gray-100 rounded-xl px-4 py-3">
                  <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
                  <TextInput
                    ref={passwordInputRef}
                    className="flex-1 ml-3 text-gray-800"
                    placeholder={t('auth.passwordPlaceholder')}
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
                    onFocus={() => {}}
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

              {/* Kayıt modunda şifre kriterleri */}
              {!isLogin && (
                <View style={{ marginBottom: 10, marginTop: 2 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {[
                      { ok: passwordChecks.min8, text: "En az 8 karakter olmalı" },
                      { ok: passwordChecks.upper, text: "En az 1 büyük harf içermeli" },
                      { ok: passwordChecks.lower, text: "En az 1 küçük harf içermeli" },
                      { ok: passwordChecks.digit, text: "En az 1 sayı içermeli" },
                      { ok: passwordChecks.symbol, text: "En az 1 sembol içermeli" },
                      { ok: passwordChecks.noSequentialNumbers, text: "Ardaşık sayı olmayacaktır" },
                    ].map((it, idx) => (
                      <View
                        key={idx}
                        style={{
                          width: "50%",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <Ionicons
                          name={it.ok ? "checkmark-circle" : "close-circle-outline"}
                          size={14}
                          color={it.ok ? "#16a34a" : "#dc2626"}
                        />
                        <Text
                          style={{
                            color: it.ok ? "#16a34a" : "#dc2626",
                            fontSize: 12,
                            lineHeight: 18,
                            flexShrink: 1,
                          }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {it.text}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Şifremi Unuttum - sadece giriş modunda */}
              {isLogin && (
                <TouchableOpacity
                  onPress={handleForgotPassword}
                  disabled={isLoading}
                  style={{ alignSelf: 'flex-end', marginBottom: 16, marginTop: -4 }}
                >
                  <Text className="text-green-700 font-semibold text-sm">
                    {t('auth.forgotPassword')}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Kullanıcı Sözleşmesi ve Topluluk İlkeleri checkbox */}
              <Pressable
                onPress={() => setAgreedToTerms((prev) => !prev)}
                style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, marginTop: 3 }}
              >
                <View style={{ width: 22, height: 22, borderWidth: 2, borderColor: agreedToTerms ? '#16a34a' : '#9ca3af', borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 2 }}>
                  {agreedToTerms && <Ionicons name="checkmark" size={16} color="#16a34a" />}
                </View>
                <Text style={{ flex: 1, color: '#374151', fontSize: 13 }}>
                  <Text onPress={() => setPolicyModalKey('terms')} style={{ color: '#16a34a', fontWeight: '600', textDecorationLine: 'underline' }}>
                    {t('settings.agreements.terms')}
                  </Text>
                  {' ve '}
                  <Text onPress={() => setPolicyModalKey('community')} style={{ color: '#16a34a', fontWeight: '600', textDecorationLine: 'underline' }}>
                    {t('settings.agreements.community')}
                  </Text>
                  {' '}
                  {t('auth.agreeToTermsSuffix')}
                </Text>
              </Pressable>

              {/* Giriş / Kayıt Butonu */}
              <Pressable 
                className="bg-green-700 py-4 rounded-xl flex-row items-center justify-center"
                onPress={handleAuth}
                disabled={isLoading}
                style={({ pressed }) => ({ marginBottom: 8, ...(pressed && { opacity: 0.8 }) })}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text className="text-white font-bold text-lg">
                      {isLogin ? t('auth.signInButton') : t('auth.signUpButton')}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                  </>
                )}
              </Pressable>

              {/* Kayıt / Giriş arasında geçiş */}
              <TouchableOpacity 
                className="mb-0" 
                activeOpacity={0.85}
                style={{ 
                  marginTop: Platform.OS === 'ios' && keyboardVisible ? 15 : (Platform.OS === 'android' && keyboardVisible ? 24 : 20),
                  paddingBottom:
                    Platform.OS === 'ios' && keyboardVisible
                      ? 8
                      : Platform.OS === 'android' && keyboardVisible
                        ? 0
                        : 12
                }}
                onPress={() => setIsLogin(!isLogin)}
              >
                <Text className="text-center text-gray-800" style={{ opacity: 1 }}>
                  {isLogin ? (
                    <>
                      {t('auth.noAccountQuestion')}{' '}
                      <Text className="text-green-700 font-semibold" style={{ opacity: 1 }}>
                        {t('auth.signUpLink')}
                      </Text>
                    </>
                  ) : (
                    <>
                      {t('auth.haveAccountQuestion')}{' '}
                      <Text className="text-green-700 font-semibold" style={{ opacity: 1 }}>
                        {t('auth.signInLink')}
                      </Text>
                    </>
                  )}
                </Text>
              </TouchableOpacity>

              {/* Sosyal Giriş Butonları (Kayıt/Giriş metninin altında) */}
              {isLogin && (
                <View style={{ marginTop: 28 }}>
                  <View
                    className="flex-row items-center"
                    style={{ marginBottom: Platform.OS === "android" ? 16 : 32 }}
                  >
                    <View className="flex-1 h-px bg-gray-300" />
                    <Text className="mx-3 text-gray-500 font-semibold">{t('auth.or')}</Text>
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
                          {t('auth.googleSignIn')}
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
                            {t('auth.appleSignIn')}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}

                  <Text
                    className="text-center text-xs text-gray-500"
                    style={{ marginTop: Platform.OS === "ios" ? 8 : 16 }}
                  >
                    {t('auth.completeProfileNote')}
                  </Text>
                </View>
              )}
              </View>
            </View>
          </ScrollView>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PolicyModal
        visible={policyModalKey !== null}
        onClose={() => setPolicyModalKey(null)}
        policyKey={policyModalKey}
      />
      </SafeAreaView>
    </GestureDetector>
  );
}
