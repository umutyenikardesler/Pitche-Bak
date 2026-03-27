import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/services/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAndClearPendingAuthUrl } from "@/lib/pendingAuthUrl";
import {
  AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY,
  PENDING_VERIFICATION_EMAIL_KEY,
} from "@/lib/authVerification";
import { getEmailFromAccessToken } from "@/lib/jwtPayload";
import { getLastNonAuthRoute } from "@/lib/lastNonAuthRoute";
import { lockAuthCallbackFor } from "@/lib/authCallbackLock";

function parseHashParams(url: string): Record<string, string> {
  try {
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) return {};
    const hash = url.substring(hashIndex + 1);
    return parseFragment(hash);
  } catch {
    return {};
  }
}

function parseFragment(fragment: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of fragment.split("&")) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const k = p.substring(0, eq);
    const encoded = p.substring(eq + 1) || "";
    const isJwtParam = k === "access_token" || k === "refresh_token" || k === "provider_token";
    let v: string;
    if (isJwtParam) {
      try {
        v = decodeURIComponent(encoded);
      } catch {
        v = encoded;
      }
    } else {
      try {
        v = decodeURIComponent(encoded.replace(/\+/g, " "));
      } catch {
        v = encoded;
      }
    }
    out[k] = v;
  }
  return out;
}

function parseUrlParams(url: string): Record<string, string> {
  const hashParams = parseHashParams(url);
  let queryParams: Record<string, string> = {};
  
  try {
    const query = QueryParams.getQueryParams(url);
    queryParams = (query.params as Record<string, string>) || {};
  } catch {
    const qStart = url.indexOf("?");
    const hStart = url.indexOf("#");
    const qEnd = hStart > qStart ? hStart : url.length;
    
    if (qStart >= 0) {
      const qs = url.substring(qStart + 1, qEnd);
      queryParams = Object.fromEntries(
        qs.split("&").map((p) => {
          const eq = p.indexOf("=");
          const k = eq > 0 ? decodeURIComponent(p.substring(0, eq)) : p;
          const v = eq > 0 ? decodeURIComponent((p.substring(eq + 1) || "").replace(/\+/g, " ")) : "";
          return [k, v];
        })
      );
    }
  }

  // d = encoded hash (web callback.html'den)
  const encodedData = queryParams.d || hashParams.d;
  if (encodedData) {
    try {
      const decoded = decodeURIComponent(encodedData);
      return { ...queryParams, ...hashParams, ...parseFragment(decoded) };
    } catch { /* ignore */ }
  }

  return { ...queryParams, ...hashParams };
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [callbackType, setCallbackType] = useState<"recovery" | "signup" | "">("");

  /** Query string güvenilir olmayabilir; bayrak + JWT'den e-posta ile giriş ekranını doldurur */
  const goToLoginAfterVerify = async (url: string | null) => {
    if (!url) {
      const from = getLastNonAuthRoute() || "/landing";
      router.replace(`/auth?from=${encodeURIComponent(from)}` as any);
      return;
    }
    await AsyncStorage.setItem(AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY, "1");
    let isRecovery = false;
    if (url) {
      try {
        const p = parseUrlParams(url);
        if (p.type === "recovery") isRecovery = true;
        
        // access_token varsa JWT içinden email'i çıkar
        if (p.access_token) {
          const em = getEmailFromAccessToken(p.access_token);
          if (em) await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, em);
        } 
        // URL içinde doğrudan e-posta parametresi varsa onu kullan (web'den gelen e=...)
        if (p.e) {
          await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, p.e);
        }
      } catch {
        /* ignore */
      }
    }
    // E-posta AsyncStorage ile bazen giriş ekranına taşınmıyor; query ile de ilet
    const pending = (await AsyncStorage.getItem(PENDING_VERIFICATION_EMAIL_KEY))?.trim() ?? "";
    const q = new URLSearchParams();
    q.set("afterVerify", "1");
    if (isRecovery) q.set("type", "recovery");
    if (pending) q.set("e", pending);
    const from = getLastNonAuthRoute() || "/landing";
    q.set("from", from);
    router.replace(`/auth?${q.toString()}` as any);
  };

  const processUrl = async (url: string | null) => {
    if (!url) {
      setStatus("error");
      setErrorMessage(t("auth.userInfoMissing"));
      setErrorHint(t("auth.userInfoMissingHint"));
      return;
    }

    const params = parseUrlParams(url);
    const code = params.code;
    const access_token = params.access_token;
    const refresh_token = params.refresh_token;
    const type = params.type;

    // URL'de e-posta geldiyse en başta sakla (signup doğrulamada input doldurmak için)
    if (params.e) {
      try {
        await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, params.e);
      } catch {
        // ignore
      }
    }

    try {
      // Şifre kurtarma: session gerekli (updateUser için)
      if (type === "recovery") {
        // Eski doğrulama bayrağı recovery akışına karışmasın
        try {
          await AsyncStorage.removeItem(AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY);
        } catch {
          // ignore
        }
        if (code) {
          const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          const em = (params.e || exchanged?.session?.user?.email || "").trim();
          if (em) await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, em);
          lockAuthCallbackFor(8000);
          router.replace(`/auth/reset-password?type=recovery&e=${encodeURIComponent(em)}` as any);
          return;
        }
        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          const em = (params.e || data?.user?.email || "").trim();
          if (em) await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, em);
          lockAuthCallbackFor(8000);
          router.replace(`/auth/reset-password?type=recovery&e=${encodeURIComponent(em)}` as any);
          return;
        }
        // Recovery link'i token/code getirmediyse login'e atmak yerine hata göster
        setStatus("error");
        setErrorMessage(t("auth.userInfoMissing"));
        setErrorHint(t("auth.userInfoMissingHint"));
        return;
      }

      // E-posta doğrulama (signup/email): kullanıcıyı oturum açmış saymayalım.
      // Code varsa e-posta almak için exchange edip ardından signOut ile session'ı temizliyoruz.
      if (code) {
        const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        const em = exchanged?.session?.user?.email ?? "";
        if (em) await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, em);
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }
        await goToLoginAfterVerify(url);
        return;
      }

      // Tokenlar varsa e-postayı JWT'den alıp login ekranına yönlendir (session kurma yok)
      if (access_token) {
        const em = getEmailFromAccessToken(access_token);
        if (em) await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, em);
        await goToLoginAfterVerify(url);
        return;
      }

      await goToLoginAfterVerify(url);
      return;
    } catch (err: any) {
      if (type === "recovery") {
        setStatus("error");
        setErrorMessage(err?.message || t("auth.unknownError"));
        setErrorHint(null);
        return;
      }
      await goToLoginAfterVerify(url);
    }
  };

  useEffect(() => {
    // Web: Supabase hash ile yönlendirir, mobil uygulama hash almaz. Web'de hash'i okuyup
    // query param ile uygulamaya yönlendiriyoruz (myapp://auth/callback?access_token=...).
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const hash = window.location.hash?.slice(1) || "";
      const params = Object.fromEntries(
        hash.split("&").map((p) => {
          const eq = p.indexOf("=");
          const k = eq > 0 ? p.substring(0, eq) : p;
          const v = eq > 0 ? decodeURIComponent(p.substring(eq + 1) || "") : "";
          return [k, v];
        })
      );
      if (params.access_token && params.refresh_token) {
        const scheme = (Constants.expoConfig as any)?.scheme || "myapp";
        const redirectAppUrl = `${scheme}://auth/callback?${hash}`;
        window.location.href = redirectAppUrl;
        return;
      }
    }

    const handleUrl = (url: string | null) => {
      if (url && (url.includes("auth/callback") || url.includes("access_token") || url.includes("code="))) {
        resolved = true;
        // Bazı cihazlarda deep link birden fazla kez gelir; işleme başladığımız anda kilitle
        lockAuthCallbackFor(8000);
        processUrl(url);
      } else {
        resolved = true;
        setStatus("error");
        setErrorMessage(t("auth.userInfoMissing"));
        setErrorHint(t("auth.userInfoMissingHint"));
      }
    };

    let resolved = false;
    const showNoUrlError = () => {
      if (resolved) return;
      resolved = true;
      setStatus("error");
      setErrorMessage(t("auth.userInfoMissing"));
      setErrorHint(t("auth.userInfoMissingHint"));
    };

    // Önce root listener'dan gelen pending URL'i kontrol et (arka plandan açıldıysa)
    const pending = getAndClearPendingAuthUrl();
    if (pending) {
      resolved = true;
      handleUrl(pending);
      return;
    }

    Linking.getInitialURL().then((url) => {
      if (url) {
        resolved = true;
        handleUrl(url);
      } else {
        // Bazı cihazlarda deep link URL'si gecikmeyle geliyor; kısa süre bekleyip tekrar dene
        const tid = setTimeout(showNoUrlError, 1000);
        setTimeout(() => {
          if (resolved) return;
          Linking.getInitialURL().then((retry) => {
            if (retry) {
              resolved = true;
              clearTimeout(tid);
              handleUrl(retry);
            }
          });
        }, 500);
      }
    });

    const sub = Linking.addEventListener("url", (e) => {
      if (!resolved) {
        resolved = true;
        handleUrl(e.url);
      }
    });
    return () => sub.remove();
  }, []);

  if (status === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={{ marginTop: 16, color: "#6b7280", fontSize: 16 }}>{t("auth.guestRedirectNotice")}</Text>
      </SafeAreaView>
    );
  }

  if (status === "success") {
    const isSignup = callbackType === "signup";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
        <View style={{ alignItems: "center", maxWidth: 320 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
            <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "700", color: "#065f46", textAlign: "center", marginBottom: 12 }}>
            {isSignup ? t("auth.emailVerifiedSuccess") : t("auth.passwordResetSuccess")}
          </Text>
          <Text style={{ fontSize: 16, color: "#4b5563", textAlign: "center", marginBottom: 32 }}>
            {isSignup ? t("auth.emailVerifiedSubtitle") : t("auth.passwordResetSuccessSubtitle")}
          </Text>
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)" as any)}
            style={{
              backgroundColor: "#16a34a",
              paddingVertical: 14,
              paddingHorizontal: 32,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}>{t("auth.continueToApp")}</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
      <View style={{ alignItems: "center", maxWidth: 320 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <Ionicons name="alert-circle" size={48} color="#dc2626" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: "600", color: "#374151", textAlign: "center", marginBottom: 12 }}>
          {t("general.error")}
        </Text>
        <Text style={{ fontSize: 14, color: "#6b7280", textAlign: "center", marginBottom: errorHint ? 8 : 24 }}>
          {errorMessage}
        </Text>
        {errorHint ? (
          <Text style={{ fontSize: 13, color: "#16a34a", textAlign: "center", marginBottom: 24, fontWeight: "500" }}>
            {errorHint}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={() => router.replace("/auth")}
          style={{
            backgroundColor: "#16a34a",
            paddingVertical: 14,
            paddingHorizontal: 32,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 16 }}>{t("auth.goToSignIn")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
