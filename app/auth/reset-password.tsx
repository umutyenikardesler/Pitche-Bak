import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/services/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { lockAuthCallbackFor } from "@/lib/authCallbackLock";
import { AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY, PENDING_VERIFICATION_EMAIL_KEY } from "@/lib/authVerification";
import { Ionicons } from "@expo/vector-icons";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ e?: string | string[]; type?: string | string[] }>();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const didUpdateRef = useRef(false);

  const emailFromParams = useMemo(() => {
    const raw = params.e;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw) && raw[0]) return raw[0];
    return "";
  }, [params.e]);
  const [resolvedEmail, setResolvedEmail] = useState(emailFromParams);

  useEffect(() => {
    let mounted = true;
    // Reset ekranındayken gelebilecek tekrar deep link'leri bloke et
    lockAuthCallbackFor(8000);
    // Eski doğrulama bayrağı recovery akışına karışmasın
    void AsyncStorage.removeItem(AUTH_REDIRECT_TO_LOGIN_AFTER_VERIFY_KEY);
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
    });
    // URL'den e-posta gelmediyse session'dan çek (login ekranında prefill için)
    if (!emailFromParams) {
      supabase.auth
        .getUser()
        .then(async ({ data }) => {
          if (!mounted) return;
          const em = data?.user?.email?.trim() ?? "";
          if (!em) return;
          setResolvedEmail(em);
          await AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, em);
        })
        .catch(() => {});
    } else {
      void AsyncStorage.setItem(PENDING_VERIFICATION_EMAIL_KEY, emailFromParams);
    }
    return () => {
      mounted = false;
    };
  }, [emailFromParams]);

  // Kullanıcı şifreyi güncellemeden bu ekrandan çıkarsa recovery session'ı kalmasın
  useEffect(() => {
    return () => {
      if (didUpdateRef.current) return;
      const rawType = params.type;
      const isRecovery =
        rawType === "recovery" || (Array.isArray(rawType) && rawType[0] === "recovery");
      if (!isRecovery) return;
      void supabase.auth.signOut();
    };
  }, [params.type]);

  const submit = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t("general.error"), t("settings.passwordMin"));
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert(t("general.error"), t("settings.passwordsMismatch"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      didUpdateRef.current = true;

      Alert.alert(t("general.success"), t("settings.passwordUpdated"));

      // Güvenli akış: yeni şifre ile tekrar giriş ekranına dön
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }

      const q = new URLSearchParams();
      q.set("afterVerify", "1");
      q.set("type", "recovery");
      q.set("recoveryDone", "1");
      const em = (resolvedEmail || emailFromParams || "").trim();
      if (em) q.set("e", em);
      router.replace(`/auth?${q.toString()}` as any);
    } catch (e: any) {
      Alert.alert(t("general.error"), e?.message || t("auth.unknownError"));
    } finally {
      setLoading(false);
    }
  };

  if (hasSession === false) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff", justifyContent: "center", paddingHorizontal: 18 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827", textAlign: "center" }}>
          {t("general.error")}
        </Text>
        <Text style={{ marginTop: 10, color: "#6b7280", textAlign: "center" }}>
          {t("auth.userInfoMissingHint")}
        </Text>
        <TouchableOpacity
          onPress={() => router.replace("/auth" as any)}
          style={{ marginTop: 18, backgroundColor: "#16a34a", paddingVertical: 12, borderRadius: 12, alignItems: "center" }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>{t("auth.goToSignIn")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }} edges={["top"]}>
      <View style={{ padding: 18, flex: 1, justifyContent: "center" }}>
        <View style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#e5e7eb" }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: "#065f46", textAlign: "center" }}>
            {t("auth.passwordResetSuccess")}
          </Text>
          <Text style={{ marginTop: 8, color: "#4b5563", textAlign: "center" }}>
            {t("auth.passwordResetSuccessSubtitle")}
          </Text>

          <View style={{ marginTop: 16, gap: 10 }}>
            <View
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: Platform.OS === "ios" ? 12 : 8,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <TextInput
                placeholder={t("settings.account.newPasswordLabel")}
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
                style={{ color: "#111827", flex: 1, paddingRight: 10 }}
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showNewPassword ? t("settings.hidePassword") : t("settings.showPassword")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={showNewPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View
              style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: Platform.OS === "ios" ? 12 : 8,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <TextInput
                placeholder={t("settings.account.newPasswordConfirmLabel")}
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showConfirmPassword}
                value={confirm}
                onChangeText={setConfirm}
                style={{ color: "#111827", flex: 1, paddingRight: 10 }}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showConfirmPassword ? t("settings.hidePassword") : t("settings.showPassword")}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={submit}
            disabled={loading}
            style={{ marginTop: 14, backgroundColor: "#16a34a", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: loading ? 0.7 : 1 }}
          >
            <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 16 }}>
              {t("guest.landing.start")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

