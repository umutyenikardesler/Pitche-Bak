import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/services/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ e?: string | string[]; type?: string | string[] }>();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const didUpdateRef = useRef(false);

  const email = useMemo(() => {
    const raw = params.e;
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw) && raw[0]) return raw[0];
    return "";
  }, [params.e]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
    });
    return () => {
      mounted = false;
    };
  }, []);

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
      if (email) q.set("e", email);
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
            <View style={{ backgroundColor: "#f3f4f6", borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 8 }}>
              <TextInput
                placeholder={t("settings.account.newPasswordLabel")}
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                style={{ color: "#111827" }}
              />
            </View>

            <View style={{ backgroundColor: "#f3f4f6", borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 8 }}>
              <TextInput
                placeholder={t("settings.account.newPasswordConfirmLabel")}
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={confirm}
                onChangeText={setConfirm}
                style={{ color: "#111827" }}
              />
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

