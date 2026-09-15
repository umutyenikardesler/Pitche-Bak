import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/services/supabase";
import { getBlockedUsers, unblockUser, BlockedUser } from "@/services/blocks";
import { hideAllChatsWithUser } from "@/lib/hiddenChats";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppTheme } from "@/contexts/ThemeContext";

function formatBlockedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      timeZone: "Europe/Istanbul",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function fullName(u: BlockedUser): string {
  return [u.name, u.surname].filter(Boolean).join(" ").trim();
}

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useAppTheme();

  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Kaldırma sırasında o satırın butonu kilitlenir; art arda dokunma iki
  // istek göndermesin.
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setUsers([]);
      return;
    }
    setUsers(await getBlockedUsers(user.id));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleUnblock = useCallback(
    (target: BlockedUser) => {
      const displayName = fullName(target) || t("blocked.unknownUser");
      Alert.alert(
        t("blocked.removeTitle"),
        t("blocked.removeConfirm").replace("{name}", displayName),
        [
          { text: t("general.cancel"), style: "cancel" },
          {
            text: t("blocked.remove"),
            onPress: async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              setRemovingId(target.id);
              const { error } = await unblockUser(user.id, target.id);
              setRemovingId(null);
              if (error) {
                Alert.alert(t("general.error"), t("blocked.removeFailed"));
                return;
              }
              // Engel kalkınca önceki sohbet geçmişi geri gelmez; yalnızca
              // bundan sonraki mesajlar görünür (bkz. lib/hiddenChats.ts).
              await hideAllChatsWithUser(user.id, target.id);
              setUsers((prev) => prev.filter((u) => u.id !== target.id));
            },
          },
        ]
      );
    },
    [t]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitleAlign: "center",
          headerStyle: { backgroundColor: colors.surface },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ paddingHorizontal: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.primaryDark} />
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <Text
              style={{ fontWeight: "800", color: colors.primaryDark, fontSize: 16 }}
              numberOfLines={1}
            >
              {t("blocked.title")}
            </Text>
          ),
        }}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />
          }
        >
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
            {t("blocked.description")}
          </Text>

          {users.length === 0 ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 48 }}>
              <Ionicons name="ban-outline" size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 15 }}>
                {t("blocked.empty")}
              </Text>
            </View>
          ) : (
            users.map((u) => (
              <View
                key={u.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <Image
                  source={u.profile_image ? { uri: u.profile_image } : require("@/assets/images/ball.png")}
                  style={{ width: 48, height: 48, borderRadius: 24, resizeMode: "cover" }}
                />

                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <Text
                    style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}
                    numberOfLines={1}
                  >
                    {fullName(u) || t("blocked.unknownUser")}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {formatBlockedAt(u.blockedAt)}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleUnblock(u)}
                  disabled={removingId === u.id}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: removingId === u.id ? colors.textMuted : "#16a34a",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                    marginLeft: 8,
                  }}
                >
                  {removingId === u.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 13 }}>
                      {t("blocked.remove")}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}
