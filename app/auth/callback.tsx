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
  return Object.fromEntries(
    fragment.split("&").map((p) => {
      const eq = p.indexOf("=");
      const k = eq > 0 ? p.substring(0, eq) : p;
      const v = eq > 0 ? decodeURIComponent((p.substring(eq + 1) || "").replace(/\+/g, " ")) : "";
      return [k, v];
    })
  );
}

function parseUrlParams(url: string): Record<string, string> {
  // Web callback.html tek parametreyle yönlendiriyor: ?d=encodeURIComponent(hash)
  let params: Record<string, string> = {};
  try {
    const query = QueryParams.getQueryParams(url);
    params = (query.params as Record<string, string>) || {};
  } catch {
    // getQueryParams custom scheme'de bazen hata verebilir, manuel parse dene
    const qStart = url.indexOf("?");
    if (qStart >= 0) {
      const qs = url.substring(qStart + 1);
      params = Object.fromEntries(
        qs.split("&").map((p) => {
          const eq = p.indexOf("=");
          const k = eq > 0 ? decodeURIComponent(p.substring(0, eq)) : p;
          const v = eq > 0 ? decodeURIComponent((p.substring(eq + 1) || "").replace(/\+/g, " ")) : "";
          return [k, v];
        })
      );
    }
  }
  const encodedData = params.d;
  if (encodedData) {
    try {
      const decoded = decodeURIComponent(encodedData);
      return parseFragment(decoded);
    } catch {
      // fallback
    }
  }
  const hashParams = parseHashParams(url);
  return Object.keys(hashParams).length ? hashParams : params;
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [callbackType, setCallbackType] = useState<"recovery" | "signup" | "">("");

  const processUrl = async (url: string | null) => {
    if (!url) {
      setStatus("error");
      setErrorMessage(t("auth.unknownError"));
      return;
    }

    const params = parseUrlParams(url);
    const code = params.code;
    const access_token = params.access_token;
    const refresh_token = params.refresh_token;
    const type = params.type;

    try {
      if (code) {
        const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        if (exchanged?.session?.user?.id) {
          const uid = exchanged.session.user.id;
          await AsyncStorage.setItem("userId", uid);
          // OAuth ile giriş: kullanıcı auth sayfasında sözleşmeyi kabul etmiş olmalı (buton açılmadan önce zorunlu)
          await AsyncStorage.setItem(`ugc_messaging_agreed_${uid}`, "1");
        }
      } else if (access_token && refresh_token) {
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
        if (data?.user?.id) {
          const uid = data.user.id;
          await AsyncStorage.setItem("userId", uid);
          // OAuth veya email doğrulama: auth sayfasında sözleşme kabul edilmiş
          if (type !== "recovery") {
            await AsyncStorage.setItem(`ugc_messaging_agreed_${uid}`, "1");
          }
        }
      } else {
        setStatus("error");
        setErrorMessage(t("auth.userInfoMissing"));
        setErrorHint(t("auth.userInfoMissingHint"));
        return;
      }

      // recovery: şifre sıfırlama; signup/email: e-posta doğrulama
      setCallbackType((type === "recovery" ? "recovery" : type === "signup" || type === "email" ? "signup" : "") as "recovery" | "signup" | "");
      setStatus("success");
      return;
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err?.message || t("auth.unknownError"));
      setErrorHint(null);
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
      setStatus("error");
      setErrorMessage(t("auth.userInfoMissing"));
      setErrorHint(t("auth.userInfoMissingHint"));
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        resolved = true;
        handleUrl(url);
      } else {
        // Bazı cihazlarda deep link URL'si gecikmeyle geliyor; kısa süre bekleyip tekrar dene
        const tid = setTimeout(showNoUrlError, 2000);
        setTimeout(() => {
          if (resolved) return;
          Linking.getInitialURL().then((retry) => {
            if (retry) {
              resolved = true;
              clearTimeout(tid);
              handleUrl(retry);
            }
          });
        }, 800);
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
