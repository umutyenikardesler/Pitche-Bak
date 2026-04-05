import React, { useMemo, useState } from "react";
import { Alert, Modal, Platform, Pressable, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { Match } from "@/components/index/types";
import { Share as NativeShare } from "react-native";

type ShareTarget =
  | "whatsapp"
  | "instagram_story"
  | "instagram_post"
  | "facebook_story"
  | "facebook_post";

interface MatchShareModalProps {
  visible: boolean;
  match: Match | null;
  onClose: () => void;
}

function safeDistrictName(m: Match): string {
  try {
    const p = Array.isArray(m.pitches) ? m.pitches[0] : m.pitches;
    const d = (p as any)?.districts;
    const dist = Array.isArray(d) ? d[0] : d;
    return dist?.name ?? "Bilinmiyor";
  } catch {
    return "Bilinmiyor";
  }
}

function safePitchName(m: Match): string {
  try {
    const p = Array.isArray(m.pitches) ? m.pitches[0] : m.pitches;
    return (p as any)?.name ?? "Bilinmiyor";
  } catch {
    return "Bilinmiyor";
  }
}

export default function MatchShareModal({ visible, match, onClose }: MatchShareModalProps) {
  const [busy, setBusy] = useState<ShareTarget | null>(null);

  const facebookAppId = useMemo(() => {
    const fromExtra = (Constants.expoConfig as any)?.extra?.facebookAppId;
    const fromEnv = (Constants.expoConfig as any)?.extra?.EXPO_PUBLIC_FACEBOOK_APP_ID;
    // Birkaç farklı isimle gelebilir; string değilse yok say.
    const id = typeof fromExtra === "string" && fromExtra.trim().length ? fromExtra.trim() : null;
    const envId = typeof fromEnv === "string" && fromEnv.trim().length ? fromEnv.trim() : null;
    return id || envId || null;
  }, []);

  const shareUrl = useMemo(() => {
    if (!match?.id) return "https://sahayabak.com";
    // Mesajlaşma uygulamalarında en güvenilir tıklanabilir link: https
    // Bu link server tarafında myapp://match/<id> deep-link'e yönlendirecek.
    const baseUrl = match.share_url?.trim?.() || `https://sahayabak.com/m/${encodeURIComponent(match.id)}`;

    // Dev/Prod fark etmeksizin, link hangi build'den paylaşıldıysa o build'in scheme'ini ekle.
    // Böylece cihazda prod yoksa dev açılır; prod varsa prod açılır.
    const configScheme = (Constants.expoConfig as any)?.scheme;
    // Dev-client + Metro'da ( __DEV__ === true ) manifest bazen prod config (myapp) döndürebiliyor.
    // Bu durumda dev build'in scheme'i genelde myapp-dev olduğu için onu tercih ediyoruz.
    const scheme =
      typeof configScheme === "string" && configScheme.length
        ? (__DEV__ && configScheme === "myapp" ? "myapp-dev" : configScheme)
        : (__DEV__ ? "myapp-dev" : "myapp");
    if (typeof scheme === "string" && scheme.length) {
      if (baseUrl.includes("s=")) return baseUrl;
      const joiner = baseUrl.includes("?") ? "&" : "?";
      return `${baseUrl}${joiner}s=${encodeURIComponent(scheme)}`;
    }

    return baseUrl;
  }, [match?.id, match?.share_url]);

  const message = useMemo(() => {
    if (!match) return "";
    const datePart = `${match.formattedDate ?? ""}`.trim();
    const start = `${match.startFormatted ?? ""}`.trim();
    const end = `${match.endFormatted ?? ""}`.trim();
    const timeRange = start && end ? `${start} - ${end}` : (start || end || "");
    const when = datePart && timeRange ? `${datePart} → ${timeRange}` : (datePart || timeRange || "");
    const where = `${safeDistrictName(match)} → ${safePitchName(match)}`;
    // Not: WhatsApp'ta renk desteklenmez. "Yeşil" vurguyu 🟢 + *bold* ile veriyoruz.
    const title = (match.title || "").trim();

    return [
      title ? `🟢 *${title}*` : "🟢 *SahayaBak Maç Daveti*",
      when || null,
      where || null,
      `Detay: ${shareUrl}`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [match, shareUrl]);

  const writeFallbackPng = async (): Promise<string> => {
    // 1x1 PNG (şeffaf) — network gerektirmez.
    const base64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7pWZkAAAAASUVORK5CYII=";
    const path = `${FileSystem.cacheDirectory}share-fallback.png`;
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
    return path;
  };

  const getShareImageUri = async (): Promise<string> => {
    // Instagram/Facebook story/post genelde görsel ister. Uygulama logosunu paylaşım görseli olarak kullanıyoruz.
    try {
      const asset = Asset.fromModule(require("@/assets/images/logo.png"));
      if (!asset.localUri) {
        await asset.downloadAsync(); // dev'de packager'a istek atar; offline olursa hata verebilir
      }
      const uri = asset.localUri || asset.uri;
      if (typeof uri === "string" && uri.length) return uri;
      return await writeFallbackPng();
    } catch {
      return await writeFallbackPng();
    }
  };

  const run = async (target: ShareTarget) => {
    if (!match) return;
    if (Platform.OS === "web") {
      Alert.alert("", "Web'de paylaşım için tarayıcı paylaş menüsü kullanılmalıdır.");
      return;
    }

    setBusy(target);
    try {
      let ShareLib: any = null;
      try {
        // native module yoksa (dev-client rebuild yapılmadıysa) burada patlar
        const mod = require("react-native-share");
        ShareLib = mod?.default ?? mod;
      } catch (_) {
        ShareLib = null;
      }

      // react-native-share yoksa: WhatsApp için native share'a düş,
      // Instagram/Facebook için kullanıcıya rebuild gerektiğini söyle.
      if (!ShareLib) {
        if (target === "whatsapp") {
          await NativeShare.share({ message });
          onClose();
          return;
        }
        Alert.alert(
          "Paylaşım özelliği eksik",
          "Instagram/Facebook paylaşımı için uygulamanın yeniden build edilmesi gerekiyor (dev-client/prod)."
        );
        return;
      }

      const imageUrl = await getShareImageUri();

      if (target === "whatsapp") {
        try {
          await ShareLib.shareSingle({
            social: ShareLib.Social.WHATSAPP,
            message,
          });
          onClose();
          return;
        } catch (e: any) {
          // iOS'ta LSApplicationQueriesSchemes eksikse WhatsApp "yüklü değil" sanılıp App Store'a atabilir.
          // Bu durumda en azından share sheet ile WhatsApp'a paylaşmayı mümkün kıl.
          await NativeShare.share({ message });
          onClose();
          return;
        }
      }

      if (target === "instagram_story") {
        if (!facebookAppId) {
          Alert.alert(
            "Eksik ayar",
            "Instagram Hikaye paylaşımı için Facebook App ID (appId) gerekiyor. app.json → expo.extra.facebookAppId ekleyip yeniden build almalısın."
          );
          return;
        }
        await ShareLib.shareSingle({
          social: ShareLib.Social.INSTAGRAM_STORIES,
          appId: facebookAppId,
          backgroundImage: imageUrl,
          // Not: Instagram story'de metin her cihazda desteklenmez; linki kullanıcı ekleyebilir.
          stickerImage: imageUrl,
          backgroundTopColor: "#16a34a",
          backgroundBottomColor: "#065f46",
        } as any);
        onClose();
        return;
      }

      if (target === "instagram_post") {
        await ShareLib.shareSingle({
          social: ShareLib.Social.INSTAGRAM,
          url: imageUrl,
          type: "image/png",
        } as any);
        onClose();
        return;
      }

      if (target === "facebook_story") {
        if (!facebookAppId) {
          Alert.alert(
            "Eksik ayar",
            "Facebook Hikaye paylaşımı için Facebook App ID (appId) gerekiyor. app.json → expo.extra.facebookAppId ekleyip yeniden build almalısın."
          );
          return;
        }
        await ShareLib.shareSingle({
          social: (ShareLib.Social as any).FACEBOOK_STORIES,
          appId: facebookAppId,
          backgroundImage: imageUrl,
          backgroundTopColor: "#16a34a",
          backgroundBottomColor: "#065f46",
        } as any);
        onClose();
        return;
      }

      if (target === "facebook_post") {
        await ShareLib.shareSingle({
          social: ShareLib.Social.FACEBOOK,
          url: imageUrl,
          type: "image/png",
          message,
          // Bazı cihazlarda message yerine quote daha iyi çalışabiliyor.
          quote: message,
        } as any);
        onClose();
        return;
      }
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      // react-native-share "not installed" hataları cihazdan cihaza değişiyor
      if (msg.toLowerCase().includes("not installed") || msg.toLowerCase().includes("not found")) {
        Alert.alert("Uygulama bulunamadı", "Seçtiğiniz uygulama cihazda yüklü değil.");
      } else if (msg.toLowerCase().includes("provide appid") || msg.toLowerCase().includes("appid")) {
        Alert.alert(
          "Eksik ayar",
          "Instagram/Facebook Hikaye paylaşımı için Facebook App ID (appId) gerekiyor. app.json → expo.extra.facebookAppId ekleyip yeniden build almalısın."
        );
      } else if (msg.toLowerCase().includes("cancel")) {
        // kullanıcı kapattı
      } else {
        Alert.alert("Hata", "Paylaşım başlatılamadı.");
        console.error("[MatchShareModal] share error:", e);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 18 }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: "white", borderRadius: 14, padding: 14 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontWeight: "900", color: "#065f46", fontSize: 15 }}>Paylaş</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color="#374151" />
            </TouchableOpacity>
          </View>

          <View style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={() => run("whatsapp")}
              disabled={busy != null}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(22,163,74,0.10)" }}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#16a34a" />
              <Text style={{ marginLeft: 10, fontWeight: "800", color: "#111827" }}>
                WhatsApp (Sohbet / Durum)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => run("instagram_story")}
              disabled={busy != null}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(234,88,12,0.10)" }}
            >
              <Ionicons name="logo-instagram" size={18} color="#ea580c" />
              <Text style={{ marginLeft: 10, fontWeight: "800", color: "#111827" }}>
                Instagram (Hikaye)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => run("instagram_post")}
              disabled={busy != null}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(234,88,12,0.10)" }}
            >
              <Ionicons name="image-outline" size={18} color="#ea580c" />
              <Text style={{ marginLeft: 10, fontWeight: "800", color: "#111827" }}>
                Instagram (Gönderi)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => run("facebook_story")}
              disabled={busy != null}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(37,99,235,0.10)" }}
            >
              <Ionicons name="logo-facebook" size={18} color="#2563eb" />
              <Text style={{ marginLeft: 10, fontWeight: "800", color: "#111827" }}>
                Facebook (Hikaye)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => run("facebook_post")}
              disabled={busy != null}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "rgba(37,99,235,0.10)" }}
            >
              <Ionicons name="document-text-outline" size={18} color="#2563eb" />
              <Text style={{ marginLeft: 10, fontWeight: "800", color: "#111827" }}>
                Facebook (Gönderi)
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={{ marginTop: 10, color: "#6b7280", fontSize: 11, lineHeight: 16 }}>
            Not: Instagram/Facebook seçenekleri için uygulama cihazda yüklü olmalı.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

