import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, Text, View } from "react-native";

import MatchDetailsModal from "@/components/index/MatchDetails";
import { Match } from "@/components/index/types";
import { supabase } from "@/services/supabase";

type MatchDetailsData = Match;

export default function MatchDeepLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params?.id === "string" ? params.id : "";

  const [match, setMatch] = useState<MatchDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    router.back();
  }, [router]);

  const title = useMemo(() => {
    if (match?.title) return match.title;
    return "Maç Detayı";
  }, [match?.title]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!id) {
        if (!alive) return;
        setError("Maç bulunamadı.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: qErr } = await supabase
          .from("match")
          .select(
            `
              id, title, time, date, prices, share_url, share_code, share_short_url, missing_groups, create_user, match_format,
              pitches (id, name, address, price, phone, features, district_id, latitude, longitude, districts (name)),
              users (id, name, surname, profile_image)
            `
          )
          .eq("id", id)
          .maybeSingle();

        if (qErr) throw qErr;
        if (!data) throw new Error("Maç bulunamadı.");

        if (!alive) return;

        const m = data as unknown as Match;
        const formattedDate = m?.date ? new Date(m.date).toLocaleDateString("tr-TR") : "";
        const hh = String(m?.time || "").split(":")[0] || "";
        const mm = String(m?.time || "").split(":")[1] || "";
        const startFormatted = hh && mm ? `${hh}:${mm}` : "";
        const endFormatted =
          hh && mm && Number.isFinite(parseInt(hh, 10)) ? `${parseInt(hh, 10) + 1}:${mm}` : "";

        setMatch({
          ...m,
          formattedDate,
          startFormatted,
          endFormatted,
        });
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Maç yüklenemedi.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <Stack.Screen options={{ title }} />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={{ marginTop: 12, color: "#6b7280" }}>Yükleniyor…</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }}>
          <Text style={{ color: "#dc2626", fontWeight: "700", fontSize: 16, textAlign: "center" }}>{error}</Text>
          <Text style={{ marginTop: 8, color: "#6b7280", textAlign: "center" }}>
            Paylaşım linki hatalı olabilir veya maç silinmiş olabilir.
          </Text>
        </View>
      ) : match ? (
        <MatchDetailsModal match={match} visible onClose={close} />
      ) : null}
    </SafeAreaView>
  );
}

