import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Match } from "@/components/index/types";

type Props = {
  match: Match;
  shareUrl: string;
};

export default function MatchShareCard({ match, shareUrl }: Props) {
  const title = useMemo(() => (match.title || "").trim() || "SahayaBak Maçı", [match.title]);
  const date = (match.formattedDate || "").trim();
  const start = (match.startFormatted || "").trim();
  const end = (match.endFormatted || "").trim();
  const timeRange = start && end ? `${start} - ${end}` : start || end || "";
  const when = date && timeRange ? `${date} → ${timeRange}` : date || timeRange || "—";

  const pitchName = Array.isArray(match.pitches) ? match.pitches[0]?.name : (match.pitches as any)?.name;
  const district = Array.isArray(match.pitches)
    ? (match.pitches?.[0] as any)?.districts?.name
    : (match.pitches as any)?.districts?.name;
  const where = [district, pitchName].filter(Boolean).join(" • ") || "—";

  return (
    <View
      style={{
        width: 1080,
        height: 1920,
        padding: 72,
        backgroundColor: "#0b1220",
        justifyContent: "space-between",
      }}
    >
      <View>
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: "rgba(22,163,74,0.18)",
            borderWidth: 1,
            borderColor: "rgba(34,197,94,0.35)",
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 999,
            marginBottom: 24,
          }}
        >
          <Text style={{ color: "#86efac", fontWeight: "800", letterSpacing: 0.3 }}>SahayaBak</Text>
        </View>

        <Text style={{ color: "#22c55e", fontWeight: "900", fontSize: 64, lineHeight: 72 }}>
          {title}
        </Text>

        <View style={{ height: 26 }} />

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            borderRadius: 24,
            padding: 28,
          }}
        >
          <Text style={{ color: "#e5e7eb", fontWeight: "800", fontSize: 28, marginBottom: 10 }}>
            {when}
          </Text>
          <Text style={{ color: "#cbd5e1", fontWeight: "700", fontSize: 24 }}>{where}</Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 24,
          padding: 28,
        }}
      >
        <Text style={{ color: "#e5e7eb", fontWeight: "900", fontSize: 26, marginBottom: 10 }}>
          Maç Detayı
        </Text>
        <Text style={{ color: "#93c5fd", fontWeight: "800", fontSize: 22 }} numberOfLines={2}>
          {shareUrl}
        </Text>
        <Text style={{ color: "#9ca3af", marginTop: 10, fontSize: 18, lineHeight: 22 }}>
          Link açılmazsa Safari/Chrome’da açmayı dene.
        </Text>
      </View>
    </View>
  );
}

