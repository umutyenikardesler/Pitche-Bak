import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
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
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/services/supabase";

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({
  visible,
  onClose,
}: SettingsModalProps) {
  const { currentLanguage, changeLanguage, t } = useLanguage();
  const [languageOptionsVisible, setLanguageOptionsVisible] = useState(false);
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
          return;
        }

        const { data: userRow, error: userError } = await supabase
          .from("users")
          .select("email")
          .eq("id", userId)
          .single();

        if (userError) {
          // DB'den alamazsak auth e-postasına düş
          setAccountEmail(authEmail);
          return;
        }

        setAccountEmail(userRow?.email ?? authEmail);
      } catch {
        // Sessizce geç; UI'da "-" görünecek
        setAccountUserId(null);
        setAccountEmail(null);
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
      Alert.alert("Hata", "Lütfen geçerli bir e-posta adresi girin.");
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
        "Başarılı",
        maybeEmail && maybeEmail !== email
          ? "E-posta değişikliği isteği alındı. Lütfen gelen kutunu kontrol edip doğrulama adımını tamamla."
          : "E-posta güncellendi. Eğer doğrulama gerekiyorsa e-posta gönderilmiş olabilir."
      );
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "E-posta güncellenemedi. Lütfen tekrar deneyin.");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Hata", "Şifre en az 6 karakter olmalı.");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      Alert.alert("Hata", "Şifreler eşleşmiyor.");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setEditPasswordVisible(false);
      setNewPassword("");
      setNewPasswordConfirm("");
      Alert.alert("Başarılı", "Şifre güncellendi.");
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Şifre güncellenemedi. Lütfen tekrar deneyin.");
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
      Alert.alert("Başarılı", "Hesabınız silindi.");
      onClose();
    } catch (e: any) {
      Alert.alert(
        "Hata",
        e?.message ||
          "Hesap silinemedi. Lütfen tekrar deneyin veya destek ile iletişime geçin."
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
        language === "tr" 
          ? "Dil değiştirilemedi"
          : "Language could not be changed"
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
        <Modal
          visible={deleteConfirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteConfirmVisible(false)}
          presentationStyle="overFullScreen"
        >
          <View className="flex-1 justify-center items-center bg-black/50 px-6">
            <View
              className="bg-white rounded-2xl w-full p-5"
              style={{
                ...(Platform.OS === "web"
                  ? { maxWidth: 520, minWidth: 320 }
                  : null),
              }}
            >
              <Text className="text-lg font-bold text-gray-900 mb-3">
                Hesabı Sil
              </Text>

              <Text className="text-gray-700">
                Hesabınızı sildiğiniz taktirde profiliniz, mesajlarınız,
                bildirimleriniz ve diğer verileriniz kalıcı olarak silinecektir.
              </Text>
              <Text className="text-red-600 font-semibold mt-3">
                Bu işlem geri alınamaz.
              </Text>
              <Text className="text-gray-900 font-bold mt-3">
                Devam etmek istiyor musunuz?
              </Text>

              <View className="flex-row mt-5">
                <TouchableOpacity
                  className="bg-gray-200 rounded-lg p-3 flex-1 mr-2 items-center"
                  onPress={() => setDeleteConfirmVisible(false)}
                  disabled={deletingAccount}
                >
                  <Text className="text-gray-800 font-semibold">
                    İptal et
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-red-600 rounded-lg p-3 flex-1 ml-2 items-center"
                  onPress={handleConfirmDeleteAccount}
                  disabled={deletingAccount}
                >
                  <Text className="text-white font-semibold">
                    {deletingAccount ? t("general.loading") : "Evet sil"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          className="bg-white rounded-t-3xl h-1/2"
          style={{
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
          <View className="flex-row items-center justify-between p-4 border-b border-gray-200">
            <Text className="text-xl font-bold text-green-600">
              {t("profile.settings")}
            </Text>
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
                    Hesap Bilgilerim
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
                <View className="bg-gray-100 rounded-lg p-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-700 font-semibold">Eposta</Text>
                    <Text className="text-gray-900 font-semibold ml-3" numberOfLines={1}>
                      {accountLoading ? t("general.loading") : accountEmail || "-"}
                    </Text>
                  </View>

                  <View className="h-px bg-gray-200 my-3" />

                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-700 font-semibold">Şifre</Text>
                    <Text className="text-gray-900 font-semibold">********</Text>
                  </View>
                  <Text className="text-xs text-gray-500 mt-2">
                    Şifre güvenlik nedeniyle gösterilmez.
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
                        E-postayı Güncelle
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
                        Şifreyi Değiştir
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {editEmailVisible && (
                    <View className="mt-3 bg-white rounded-lg p-3 border border-green-200">
                      <Text className="text-gray-700 font-semibold mb-2">Yeni Eposta</Text>
                      <TextInput
                        className="bg-gray-100 rounded-lg p-3 text-gray-900"
                        value={newEmail}
                        onChangeText={setNewEmail}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        placeholder="ornek@mail.com"
                        placeholderTextColor="#9ca3af"
                        editable={!savingEmail}
                      />

                      <View className="flex-row mt-3">
                        <TouchableOpacity
                          className="bg-gray-200 rounded-lg p-3 flex-1 mr-2 items-center"
                          onPress={() => setEditEmailVisible(false)}
                          disabled={savingEmail}
                        >
                          <Text className="text-gray-800 font-semibold">Vazgeç</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="bg-green-600 rounded-lg p-3 flex-1 ml-2 items-center"
                          onPress={handleUpdateEmail}
                          disabled={savingEmail}
                        >
                          <Text className="text-white font-semibold">
                            {savingEmail ? t("general.loading") : "Kaydet"}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text className="text-xs text-gray-500 mt-2">
                        Not: E-posta değişimi için doğrulama maili gerekebilir.
                      </Text>
                    </View>
                  )}

                  {editPasswordVisible && (
                    <View className="mt-3 bg-white rounded-lg p-3 border border-green-200">
                      <Text className="text-gray-700 font-semibold mb-2">Yeni Şifre</Text>
                      <View className="flex-row items-center bg-gray-100 rounded-lg">
                        <TextInput
                          className="p-3 text-gray-900 flex-1"
                          value={newPassword}
                          onChangeText={setNewPassword}
                          secureTextEntry={!showNewPassword}
                          placeholder="••••••••"
                          placeholderTextColor="#9ca3af"
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

                      <Text className="text-gray-700 font-semibold mt-3 mb-2">Yeni Şifre (Tekrar)</Text>
                      <View className="flex-row items-center bg-gray-100 rounded-lg">
                        <TextInput
                          className="p-3 text-gray-900 flex-1"
                          value={newPasswordConfirm}
                          onChangeText={setNewPasswordConfirm}
                          secureTextEntry={!showNewPasswordConfirm}
                          placeholder="••••••••"
                          placeholderTextColor="#9ca3af"
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

                      <View className="flex-row mt-3">
                        <TouchableOpacity
                          className="bg-gray-200 rounded-lg p-3 flex-1 mr-2 items-center"
                          onPress={() => setEditPasswordVisible(false)}
                          disabled={savingPassword}
                        >
                          <Text className="text-gray-800 font-semibold">Vazgeç</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="bg-green-600 rounded-lg p-3 flex-1 ml-2 items-center"
                          onPress={handleUpdatePassword}
                          disabled={savingPassword}
                        >
                          <Text className="text-white font-semibold">
                            {savingPassword ? t("general.loading") : "Kaydet"}
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
                    <Text className="text-white font-semibold">Hesabı Sil</Text>
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
                    onPress={() => handleLanguageChange("tr")}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-lg font-semibold text-gray-800">
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
                    onPress={() => handleLanguageChange("en")}
                  >
                    <View className="flex-row items-center">
                      <Text className="text-lg font-semibold text-gray-800">
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

            {/* Cihaz Bilgileri */}
            <TouchableOpacity
              className="flex-row items-center justify-between p-3 bg-green-600 rounded-lg mb-3"
              activeOpacity={1}
              onPress={() => setDeviceInfoVisible(!deviceInfoVisible)}
            >
              <View className="flex-row items-center">
                <Ionicons name="phone-portrait-outline" size={24} color="white" />
                <Text className="text-white font-semibold text-lg ml-3">
                  Cihaz Bilgileri
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
                <View className="bg-gray-100 rounded-lg p-3">
                  <Text className="text-gray-900 font-bold mb-3">
                    Uygulama Bilgileri
                  </Text>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-700 font-semibold">Uygulama</Text>
                    <Text className="text-gray-900 font-semibold ml-3" numberOfLines={1}>
                      {appName}
                    </Text>
                  </View>

                  <View className="h-px bg-gray-200 my-3" />

                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-700 font-semibold">Sürüm</Text>
                    <Text className="text-gray-900 font-semibold">{appVersion}</Text>
                  </View>

                  <View className="h-px bg-gray-200 my-3" />

                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-700 font-semibold">Cihaz</Text>
                    <Text className="text-gray-900 font-semibold ml-3" numberOfLines={1}>
                      {deviceBrand} {deviceModel}
                    </Text>
                  </View>

                  <View className="h-px bg-gray-200 my-3" />

                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-700 font-semibold">İşletim Sistemi</Text>
                    <Text className="text-gray-900 font-semibold">
                      {osName} {osVersion}
                    </Text>
                  </View>

                  <View className="h-px bg-gray-200 my-3" />

                  <View className="flex-row items-center justify-between">
                    <Text className="text-gray-700 font-semibold">Güncelleme Durumu</Text>
                    <View className="flex-row items-center">
                      {Platform.OS !== "ios" ? (
                        <>
                          <Ionicons name="help-circle-outline" size={18} color="#6b7280" />
                          <Text className="text-gray-600 font-semibold ml-2">
                            Bu cihazda kontrol edilemiyor
                          </Text>
                        </>
                      ) : updateCheckLoading ? (
                        <>
                          <Ionicons name="time-outline" size={18} color="#6b7280" />
                          <Text className="text-gray-600 font-semibold ml-2">
                            Kontrol ediliyor...
                          </Text>
                        </>
                      ) : updateCheckError ? (
                        <>
                          <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
                          <Text className="text-red-600 font-semibold ml-2">
                            Kontrol edilemedi
                          </Text>
                        </>
                      ) : updateAvailable === true ? (
                        <>
                          <Ionicons name="alert-circle-outline" size={18} color="#f59e0b" />
                          <Text className="text-amber-600 font-semibold ml-2">
                            Güncelleme var{latestStoreVersion ? ` (v${latestStoreVersion})` : ""}
                          </Text>
                        </>
                      ) : updateAvailable === false ? (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
                          <Text className="text-green-700 font-semibold ml-2">
                            Güncel{latestStoreVersion ? ` (v${latestStoreVersion})` : ""}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="help-circle-outline" size={18} color="#6b7280" />
                          <Text className="text-gray-600 font-semibold ml-2">Bilinmiyor</Text>
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
                      <Text className="text-white font-semibold">App Store’a Git</Text>
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
