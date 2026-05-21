import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  Switch,
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/services/supabase";
import PolicyModal from "./PolicyModal";
import { POLICY_KEYS, PolicyKey } from "@/constants/policies";
import { getPasswordChecks, getPasswordViolations } from "@/lib/passwordPolicy";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  visible,
  onClose,
}: SettingsModalProps) {
  const router = useRouter();
  const { currentLanguage, changeLanguage, t } = useLanguage();
  const { colors, isDark, toggleTheme } = useAppTheme();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [languageOptionsVisible, setLanguageOptionsVisible] = useState(false);
  const [agreementsVisible, setAgreementsVisible] = useState(false);
  const [policyModalKey, setPolicyModalKey] = useState<PolicyKey | null>(null);
  const [accountInfoVisible, setAccountInfoVisible] = useState(false);
  const [deviceInfoVisible, setDeviceInfoVisible] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [accountUserId, setAccountUserId] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);

  const [editEmailVisible, setEditEmailVisible] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [editPasswordVisible, setEditPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [updateCheckLoading, setUpdateCheckLoading] = useState(false);
  const [latestStoreVersion, setLatestStoreVersion] = useState<string | null>(null);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean | null>(null);
  const [updateCheckError, setUpdateCheckError] = useState<string | null>(null);

  const passwordChecks = useMemo(() => getPasswordChecks(newPassword), [newPassword]);

  const appName = Constants.expoConfig?.name ?? "Uygulama";
  const appVersion =
    Constants.nativeAppVersion ??
    Constants.expoConfig?.version ??
    (Constants as any)?.manifest?.version ??
    "-";
  const buildVersion = Constants.nativeBuildVersion ?? "-";
  const deviceBrand = Device.brand ?? "-";
  const deviceModel = Device.modelName ?? Device.modelId ?? "-";
  const osName = Device.osName ?? Platform.OS;
  const osVersion = Device.osVersion ?? String(Platform.Version ?? "-");
  const iosBundleId =
    Constants.expoConfig?.ios?.bundleIdentifier ??
    (Constants as any)?.manifest?.ios?.bundleIdentifier ??
    null;

  const normalizeVersion = (v: string) => (v || "").trim().replace(/^v/i, "");
  const compareVersions = (aRaw: string, bRaw: string) => {
    const a = normalizeVersion(aRaw);
    const b = normalizeVersion(bRaw);
    const aParts = a.split(".").map((x) => parseInt(x.replace(/\D/g, "") || "0", 10));
    const bParts = b.split(".").map((x) => parseInt(x.replace(/\D/g, "") || "0", 10));
    const len = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < len; i++) {
      const av = aParts[i] ?? 0;
      const bv = bParts[i] ?? 0;
      if (av > bv) return 1;
      if (av < bv) return -1;
    }
    return 0;
  };

  useEffect(() => {
    const fetchAccountInfo = async () => {
      if (!visible) return;

      setAccountLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const userId = authData?.user?.id;
        const authEmail = authData?.user?.email ?? null;
        setAccountUserId(userId ?? null);

        if (!userId) {
          setAccountEmail(authEmail);
          setUserRole(null);
          return;
        }

        const { data: userRow, error: userError } = await supabase
          .from("users")
          .select("email, role")
          .eq("id", userId)
          .single();

        if (userError) {
          // DB'den alamazsak auth e-postasına düş
          setAccountEmail(authEmail);
          return;
        }

        setAccountEmail(userRow?.email ?? authEmail);
        setUserRole(userRow?.role ?? null);
      } catch {
        // Sessizce geç; UI'da "-" görünecek
        setAccountUserId(null);
        setAccountEmail(null);
        setUserRole(null);
      } finally {
        setAccountLoading(false);
      }
    };

    fetchAccountInfo();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    // Modal her açıldığında form state'lerini sıfırla
    setEditEmailVisible(false);
    setEditPasswordVisible(false);
    setAgreementsVisible(false);
    setPolicyModalKey(null);
    setDeviceInfoVisible(false);
    setSavingEmail(false);
    setSavingPassword(false);
    setShowNewPassword(false);
    setShowNewPasswordConfirm(false);
    setNewPassword("");
    setNewPasswordConfirm("");
    setNewEmail(accountEmail ?? "");
    setUpdateCheckLoading(false);
    setLatestStoreVersion(null);
    setStoreUrl(null);
    setUpdateAvailable(null);
    setUpdateCheckError(null);
    // accountEmail fetch'i async olduğu için ayrıca aşağıdaki effect'te güncelliyoruz
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setNewEmail(accountEmail ?? "");
  }, [accountEmail, visible]);

  useEffect(() => {
    const checkUpdate = async () => {
      if (!visible || !deviceInfoVisible) return;

      // Şimdilik App Store kontrolünü sadece iOS'ta yapıyoruz.
      if (Platform.OS !== "ios") {
        setUpdateAvailable(null);
        setUpdateCheckError(null);
        return;
      }

      if (!iosBundleId) {
        setUpdateAvailable(null);
        setUpdateCheckError("bundleId_not_found");
        return;
      }

      setUpdateCheckLoading(true);
      setUpdateCheckError(null);
      try {
        const url = `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(iosBundleId)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`http_${res.status}`);
        const json: any = await res.json();
        const item = json?.results?.[0];
        const storeVer = item?.version ? String(item.version) : null;
        const trackUrl = item?.trackViewUrl ? String(item.trackViewUrl) : null;

        setLatestStoreVersion(storeVer);
        setStoreUrl(trackUrl);

        const current = normalizeVersion(String(appVersion));
        if (!storeVer || !current || current === "-") {
          setUpdateAvailable(null);
          return;
        }

        setUpdateAvailable(compareVersions(storeVer, current) === 1);
      } catch (e: any) {
        setUpdateAvailable(null);
        setUpdateCheckError(e?.message || "unknown");
      } finally {
        setUpdateCheckLoading(false);
      }
    };

    checkUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceInfoVisible, visible]);

  const handleUpdateEmail = async () => {
    const email = newEmail.trim();
    if (!email || !email.includes("@")) {
      Alert.alert(t("general.error"), t("settings.invalidEmail"));
      return;
    }

    setSavingEmail(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ email });
      if (error) throw error;

      // users tablosunu da güncelle (varsa)
      if (accountUserId) {
        await supabase.from("users").update({ email }).eq("id", accountUserId);
      }

      setAccountEmail(email);
      setEditEmailVisible(false);

      // Supabase çoğu zaman e-posta değişimi için doğrulama ister
      const maybeEmail = data?.user?.email;
      Alert.alert(
        t("general.success"),
        maybeEmail && maybeEmail !== email
          ? t("settings.emailUpdateRequestedVerifyInbox")
          : t("settings.emailUpdatedMaybeVerify")
      );
    } catch (e: any) {
      Alert.alert(t("general.error"), e?.message || t("settings.emailUpdateFailed"));
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    const violations = getPasswordViolations(newPassword);
    if (violations.length > 0) {
      Alert.alert(
        t("general.error"),
        [
          "Şifreniz en az 8 karakter olmalıdır.",
          "En az 1 büyük harf, 1 küçük harf, sembol ve sayılardan oluşmalıdır.",
          "Ardaşık sayılar olmamalıdır.",
        ].join("\n")
      );
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      Alert.alert(t("general.error"), t("settings.passwordsMismatch"));
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setEditPasswordVisible(false);
      setNewPassword("");
      setNewPasswordConfirm("");
      Alert.alert(t("general.success"), t("settings.passwordUpdated"));
    } catch (e: any) {
      Alert.alert(t("general.error"), e?.message || t("settings.passwordUpdateFailed"));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccountPress = () => setDeleteConfirmVisible(true);

  const handleConfirmDeleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      const { error } = await supabase.rpc("delete_user_account");
      if (error) throw error;

      // Session invalid olabileceği için hata verse bile sorun etmiyoruz
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }

      setDeleteConfirmVisible(false);
      Alert.alert(t("general.success"), t("settings.accountDeleted"));
      onClose();
    } catch (e: any) {
      Alert.alert(
        t("general.error"),
        e?.message ||
          t("settings.accountDeleteFailed")
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleLanguageChange = async (language: "tr" | "en") => {
    try {
      await changeLanguage(language);
      setLanguageOptionsVisible(false);
      Alert.alert(
        t("language.changed"),
        language === "tr" 
          ? t("language.changedToTurkish")
          : t("language.changedToEnglish")
      );
    } catch (error) {
      Alert.alert(
        t("general.error"),
        t("language.changeFailed")
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        // Offset küçüldükçe sheet daha fazla yukarı çıkar (input klavyenin üstünde kalır)
        keyboardVerticalOffset={0}
        // Web'de modal portal olduğu için tüm sayfayı kaplıyor gibi görünür.
        // Görünümü bozmadan sadece sheet'i "app container" gibi ortada %50 genişlikte tutuyoruz.
        style={Platform.OS === "web" ? { alignItems: "center" } : undefined}
      >
        {/* Hesap Silme Onayı (stil için custom modal) */}
        <PolicyModal
          visible={policyModalKey !== null}
          onClose={() => setPolicyModalKey(null)}
          policyKey={policyModalKey}
        />

        <Modal
          visible={deleteConfirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteConfirmVisible(false)}
          presentationStyle="overFullScreen"
        >
          <View className="flex-1 justify-center items-center bg-black/50 px-6">
            <View
              className="rounded-2xl w-full p-5"
              style={{
                backgroundColor: colors.surface,
                ...(Platform.OS === "web"
                  ? { maxWidth: 520, minWidth: 320 }
                  : null),
              }}
            >
              <Text className="text-lg font-bold mb-3" style={{ color: colors.text }}>
                {t("settings.delete.title")}
              </Text>

              <Text style={{ color: colors.textSecondary }}>
                {t("settings.delete.description")}
              </Text>
              <Text className="font-semibold mt-3" style={{ color: colors.danger }}>
                {t("settings.delete.irreversible")}
              </Text>
              <Text className="font-bold mt-3" style={{ color: colors.text }}>
                {t("settings.delete.confirmQuestion")}
              </Text>

              <View className="flex-row mt-5">
                <TouchableOpacity
                  className="rounded-lg p-3 flex-1 mr-2 items-center"
                  style={{ backgroundColor: colors.surfaceAlt }}
                  onPress={() => setDeleteConfirmVisible(false)}
                  disabled={deletingAccount}
                >
                  <Text className="font-semibold" style={{ color: colors.text }}>
                    {t("general.cancel")}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-red-600 rounded-lg p-3 flex-1 ml-2 items-center"
                  onPress={handleConfirmDeleteAccount}
                  disabled={deletingAccount}
                >
                  <Text className="text-white font-semibold">
                    {deletingAccount ? t("general.loading") : t("settings.delete.confirmButton")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-3xl h-1/2"
          style={{
            backgroundColor: colors.surface,
            borderTopWidth: 4,
            borderTopColor: "#16a34a",
            borderLeftWidth: 2,
            borderLeftColor: "#16a34a",
            borderRightWidth: 2,
            borderRightColor: "#16a34a",
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: -6,
            },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 12,
            ...(Platform.OS === "web"
              ? {
                  width: "50%",
                  minWidth: 360,
                  maxWidth: 520,
                  alignSelf: "center",
                }
              : null),
          }}
        >
          {/* Header */}
          <View
            className="flex-row items-center justify-between p-4"
            style={{ borderBottomWidth: 1, borderColor: colors.border, position: "relative" }}
          >
            <View style={{ minWidth: 84 }}>
              <Text className="text-xl font-bold" style={{ color: colors.primary }}>
                {t("profile.settings")}
              </Text>
            </View>
            <View
              pointerEvents="box-none"
              style={{ position: "absolute", left: 0, right: 0, alignItems: "center" }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
              >
                <Text style={{ color: !isDark ? colors.primary : colors.textMuted, fontSize: 12, fontWeight: "700" }}>
                  {t("settings.themeDay")}
                </Text>
                <Switch
                  value={isDark}
                  onValueChange={() => { void toggleTheme(); }}
                  trackColor={{ false: "#bbf7d0", true: "#166534" }}
                  thumbColor={isDark ? "#16a34a" : "#f9fafb"}
                  ios_backgroundColor={colors.border}
                />
                <Text style={{ color: isDark ? colors.primary : colors.textMuted, fontSize: 12, fontWeight: "700" }}>
                  {t("settings.themeNight")}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="bg-green-600 p-2 rounded-full"
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* İçerik */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
          >
              {/* Hesap Bilgilerim */}
              <TouchableOpacity
                className="flex-row items-center justify-between p-3 bg-green-600 rounded-lg mb-3"
                activeOpacity={1}
                onPress={() => setAccountInfoVisible(!accountInfoVisible)}
              >
                <View className="flex-row items-center">
                  <Ionicons name="person-circle-outline" size={24} color="white" />
                  <Text className="text-white font-semibold text-lg ml-3">
                    {t("settings.account.title")}
                  </Text>
                </View>
                <Ionicons
                  name={accountInfoVisible ? "chevron-up" : "chevron-down"}
                  size={24}
                  color="white"
                />
              </TouchableOpacity>

            {accountInfoVisible && (
              <View className="mb-3">
                <View className="rounded-lg p-3" style={{ backgroundColor: colors.surfaceAlt }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold" style={{ color: colors.textSecondary }}>{t("settings.account.emailLabel")}</Text>
                    <Text className="font-semibold ml-3" style={{ color: colors.text }} numberOfLines={1}>
                      {accountLoading ? t("general.loading") : accountEmail || "-"}
                    </Text>
                  </View>

                  <View className="h-px my-3" style={{ backgroundColor: colors.border }} />

                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold" style={{ color: colors.textSecondary }}>{t("settings.account.passwordLabel")}</Text>
                    <Text className="font-semibold" style={{ color: colors.text }}>********</Text>
                  </View>
                  <Text className="text-xs mt-2" style={{ color: colors.textMuted }}>
                    {t("settings.account.passwordHiddenNote")}
                  </Text>

                  {/* Güncelleme seçenekleri */}
                  <View className="flex-row mt-4">
                    <TouchableOpacity
                      className={`flex-row items-center justify-center rounded-lg p-3 flex-1 mr-2 ${
                        editEmailVisible ? "bg-green-700" : "bg-green-600"
                      }`}
                      onPress={() => {
                        setEditPasswordVisible(false);
                        setEditEmailVisible(!editEmailVisible);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="mail-outline" size={18} color="white" />
                      <Text className="text-white font-semibold ml-2">
                        {t("settings.account.updateEmail")}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className={`flex-row items-center justify-center rounded-lg p-3 flex-1 ml-2 ${
                        editPasswordVisible ? "bg-green-700" : "bg-green-600"
                      }`}
                      onPress={() => {
                        setEditEmailVisible(false);
                        setEditPasswordVisible(!editPasswordVisible);
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="key-outline" size={18} color="white" />
                      <Text className="text-white font-semibold ml-2">
                        {t("settings.account.changePassword")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {editEmailVisible && (
                    <View className="mt-3 rounded-lg p-3 border" style={{ backgroundColor: colors.surface, borderColor: colors.primary }}>
                      <Text className="font-semibold mb-2" style={{ color: colors.textSecondary }}>{t("settings.account.newEmailLabel")}</Text>
                      <TextInput
                        className="rounded-lg p-3"
                        style={{ backgroundColor: colors.inputBackground, color: colors.text, borderWidth: 1, borderColor: colors.inputBorder }}
                        value={newEmail}
                        onChangeText={setNewEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        placeholder={t("settings.account.emailPlaceholder")}
                        placeholderTextColor={colors.textMuted}
                        editable={!savingEmail}
                      />

                      <View className="flex-row mt-3">
                        <TouchableOpacity
                          className="rounded-lg p-3 flex-1 mr-2 items-center"
                          style={{ backgroundColor: colors.surfaceAlt }}
                          onPress={() => setEditEmailVisible(false)}
                          disabled={savingEmail}
                        >
                          <Text className="font-semibold" style={{ color: colors.text }}>{t("general.cancel")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="bg-green-600 rounded-lg p-3 flex-1 ml-2 items-center"
                          onPress={handleUpdateEmail}
                          disabled={savingEmail}
                        >
                          <Text className="text-white font-semibold">
                            {savingEmail ? t("general.loading") : t("general.save")}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text className="text-xs mt-2" style={{ color: colors.textMuted }}>
                        {t("settings.account.emailVerifyNote")}
                      </Text>
                    </View>
                  )}

                  {editPasswordVisible && (
                    <View className="mt-3 rounded-lg p-3 border" style={{ backgroundColor: colors.surface, borderColor: colors.primary }}>
                      <Text className="font-semibold mb-2" style={{ color: colors.textSecondary }}>{t("settings.account.newPasswordLabel")}</Text>
                      <View className="flex-row items-center rounded-lg" style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder }}>
                        <TextInput
                          className="p-3 flex-1"
                          style={{ color: colors.text }}
                          value={newPassword}
                          onChangeText={setNewPassword}
                          secureTextEntry={!showNewPassword}
                          placeholder="••••••••"
                          placeholderTextColor={colors.textMuted}
                          editable={!savingPassword}
                        />
                        <TouchableOpacity
                          className="px-3"
                          onPress={() => setShowNewPassword(!showNewPassword)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={showNewPassword ? "eye-outline" : "eye-off-outline"}
                            size={20}
                            color="#16a34a"
                          />
                        </TouchableOpacity>
                      </View>

                      <Text className="font-semibold mt-3 mb-2" style={{ color: colors.textSecondary }}>{t("settings.account.newPasswordConfirmLabel")}</Text>
                      <View className="flex-row items-center rounded-lg" style={{ backgroundColor: colors.inputBackground, borderWidth: 1, borderColor: colors.inputBorder }}>
                        <TextInput
                          className="p-3 flex-1"
                          style={{ color: colors.text }}
                          value={newPasswordConfirm}
                          onChangeText={setNewPasswordConfirm}
                          secureTextEntry={!showNewPasswordConfirm}
                          placeholder="••••••••"
                          placeholderTextColor={colors.textMuted}
                          editable={!savingPassword}
                        />
                        <TouchableOpacity
                          className="px-3"
                          onPress={() => setShowNewPasswordConfirm(!showNewPasswordConfirm)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={showNewPasswordConfirm ? "eye-outline" : "eye-off-outline"}
                            size={20}
                            color="#16a34a"
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={{ marginTop: 8 }}>
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

                      <View className="flex-row mt-3">
                        <TouchableOpacity
                          className="rounded-lg p-3 flex-1 mr-2 items-center"
                          style={{ backgroundColor: colors.surfaceAlt }}
                          onPress={() => setEditPasswordVisible(false)}
                          disabled={savingPassword}
                        >
                          <Text className="font-semibold" style={{ color: colors.text }}>{t("general.cancel")}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="bg-green-600 rounded-lg p-3 flex-1 ml-2 items-center"
                          onPress={handleUpdatePassword}
                          disabled={savingPassword}
                        >
                          <Text className="text-white font-semibold">
                            {savingPassword ? t("general.loading") : t("general.save")}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Hesabı Sil */}
                  <TouchableOpacity
                    className="bg-red-600 rounded-lg p-3 items-center mt-4"
                    onPress={handleDeleteAccountPress}
                    activeOpacity={0.85}
                  >
                    <Text className="text-white font-semibold">{t("settings.delete.title")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              className="flex-row items-center justify-between p-3 bg-green-600 rounded-lg mb-3"
              activeOpacity={1}
              onPress={() =>
                setLanguageOptionsVisible(!languageOptionsVisible)
              }
            >
              <View className="flex-row items-center">
                <Ionicons name="language" size={24} color="white" />
                <Text className="text-white font-semibold text-lg ml-3">
                  {t("language.settings")}
                </Text>
              </View>
              <Ionicons
                name={
                  languageOptionsVisible ? "chevron-up" : "chevron-down"
                }
                size={24}
                color="white"
              />
            </TouchableOpacity>

            {/* Dil Seçenekleri */}
            {languageOptionsVisible && (
              <View className="mb-3">
                <View className="flex-row">
                  <TouchableOpacity
                    className={`flex-row items-center justify-between p-3 rounded-lg flex-1 mr-2 ${
                      currentLanguage === "tr"
                        ? "bg-green-100 border-2 border-green-600"
                        : "bg-gray-100"
                    }`}
                    style={currentLanguage === "tr" ? undefined : { backgroundColor: colors.surfaceAlt }}
                    onPress={() => handleLanguageChange("tr")}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                        🇹🇷 {t("language.turkish")}
                      </Text>
                    </View>
                    {currentLanguage === "tr" && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#16a34a"
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    className={`flex-row items-center justify-between p-3 rounded-lg flex-1 ml-2 ${
                      currentLanguage === "en"
                        ? "bg-green-100 border-2 border-green-600"
                        : "bg-gray-100"
                    }`}
                    style={currentLanguage === "en" ? undefined : { backgroundColor: colors.surfaceAlt }}
                    onPress={() => handleLanguageChange("en")}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-lg font-semibold" style={{ color: colors.text }}>
                        🇬🇧 {t("language.english")}
                      </Text>
                    </View>
                    {currentLanguage === "en" && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#16a34a"
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Sözleşmelerim */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-3 bg-green-600 rounded-lg mb-3"
              activeOpacity={1}
              onPress={() => setAgreementsVisible(!agreementsVisible)}
            >
              <View className="flex-row items-center">
                <Ionicons name="document-text-outline" size={24} color="white" />
                <Text className="text-white font-semibold text-lg ml-3">
                  {t("settings.agreements.title")}
                </Text>
              </View>
              <Ionicons
                name={agreementsVisible ? "chevron-up" : "chevron-down"}
                size={24}
                color="white"
              />
            </TouchableOpacity>

            {agreementsVisible && (
              <View className="mb-3">
                <View className="rounded-lg p-2" style={{ backgroundColor: colors.surfaceAlt }}>
                  {POLICY_KEYS.map((key) => (
                    <TouchableOpacity
                      key={key}
                      className="flex-row items-center justify-between p-3 rounded-lg active:bg-gray-200"
                      onPress={() => setPolicyModalKey(key)}
                      activeOpacity={0.7}
                    >
                      <Text className="font-medium" style={{ color: colors.text }}>
                        {t(`settings.agreements.${key}`)}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color="#16a34a" />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Raporlarım - sadece admin için */}
            {userRole === "admin" && (
              <TouchableOpacity
                className="flex-row items-center justify-between p-3 bg-green-600 rounded-lg mb-3"
                activeOpacity={1}
                onPress={() => {
                  onClose();
                  router.push("/admin/reports");
                }}
              >
                <View className="flex-row items-center">
                  <Ionicons name="flag-outline" size={24} color="white" />
                  <Text className="text-white font-semibold text-lg ml-3">
                    {t("settings.reports.title")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="white" />
              </TouchableOpacity>
            )}

            {/* Cihaz Bilgileri */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-3 bg-green-600 rounded-lg mb-3"
              activeOpacity={1}
              onPress={() => setDeviceInfoVisible(!deviceInfoVisible)}
            >
              <View className="flex-row items-center">
                <Ionicons name="phone-portrait-outline" size={24} color="white" />
                <Text className="text-white font-semibold text-lg ml-3">
                  {t("settings.device.title")}
                </Text>
              </View>
              <Ionicons
                name={deviceInfoVisible ? "chevron-up" : "chevron-down"}
                size={24}
                color="white"
              />
            </TouchableOpacity>

            {deviceInfoVisible && (
              <View className="mb-3">
                <View className="rounded-lg p-3" style={{ backgroundColor: colors.surfaceAlt }}>
                  <Text className="font-bold mb-3" style={{ color: colors.text }}>
                    {t("settings.device.appInfoTitle")}
                  </Text>

                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold" style={{ color: colors.textSecondary }}>{t("settings.device.appLabel")}</Text>
                    <Text className="font-semibold ml-3" style={{ color: colors.text }} numberOfLines={1}>
                      {appName}
                    </Text>
                  </View>

                  <View className="h-px my-3" style={{ backgroundColor: colors.border }} />

                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold" style={{ color: colors.textSecondary }}>{t("settings.device.versionLabel")}</Text>
                    <Text className="font-semibold" style={{ color: colors.text }}>{appVersion}</Text>
                  </View>

                  <View className="h-px my-3" style={{ backgroundColor: colors.border }} />

                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold" style={{ color: colors.textSecondary }}>{t("settings.device.deviceLabel")}</Text>
                    <Text className="font-semibold ml-3" style={{ color: colors.text }} numberOfLines={1}>
                      {deviceBrand} {deviceModel}
                    </Text>
                  </View>

                  <View className="h-px my-3" style={{ backgroundColor: colors.border }} />

                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold" style={{ color: colors.textSecondary }}>{t("settings.device.osLabel")}</Text>
                    <Text className="font-semibold" style={{ color: colors.text }}>
                      {osName} {osVersion}
                    </Text>
                  </View>

                  <View className="h-px my-3" style={{ backgroundColor: colors.border }} />

                  <View className="flex-row items-center justify-between">
                    <Text className="font-semibold" style={{ color: colors.textSecondary }}>{t("settings.device.updateStatusLabel")}</Text>
                    <View className="flex-row items-center">
                      {Platform.OS !== "ios" ? (
                        <>
                          <Ionicons name="help-circle-outline" size={18} color="#6b7280" />
                          <Text className="font-semibold ml-2" style={{ color: colors.textMuted }}>
                            {t("settings.device.updateNotSupported")}
                          </Text>
                        </>
                      ) : updateCheckLoading ? (
                        <>
                          <Ionicons name="time-outline" size={18} color="#6b7280" />
                          <Text className="font-semibold ml-2" style={{ color: colors.textMuted }}>
                            {t("settings.device.updateChecking")}
                          </Text>
                        </>
                      ) : updateCheckError ? (
                        <>
                          <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
                          <Text className="text-red-600 font-semibold ml-2">
                            {t("settings.device.updateCheckFailed")}
                          </Text>
                        </>
                      ) : updateAvailable === true ? (
                        <>
                          <Ionicons name="alert-circle-outline" size={18} color="#f59e0b" />
                          <Text className="text-amber-600 font-semibold ml-2">
                            {t("settings.device.updateAvailable")}
                            {latestStoreVersion ? ` (v${latestStoreVersion})` : ""}
                          </Text>
                        </>
                      ) : updateAvailable === false ? (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
                          <Text className="text-green-700 font-semibold ml-2">
                            {t("settings.device.upToDate")}
                            {latestStoreVersion ? ` (v${latestStoreVersion})` : ""}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="help-circle-outline" size={18} color="#6b7280" />
                          <Text className="font-semibold ml-2" style={{ color: colors.textMuted }}>{t("settings.device.unknown")}</Text>
                        </>
                      )}
                    </View>
                  </View>

                  {Platform.OS === "ios" && updateAvailable === true && storeUrl ? (
                    <TouchableOpacity
                      className="bg-green-600 rounded-lg p-3 items-center mt-4"
                      onPress={() => Linking.openURL(storeUrl)}
                      activeOpacity={0.85}
                    >
                      <Text className="text-white font-semibold">{t("settings.device.goToStore")}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}

            {/* Diğer ayar seçenekleri buraya eklenebilir */}
          </ScrollView>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}
