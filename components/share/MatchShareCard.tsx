import React, { useMemo } from "react";
import { Text, View } from "react-native";
import { Match } from "@/components/index/types";

type Props = {
  match: Match;
  shareUrl: string;
  displayUrl?: string;
};

export default function MatchShareCard({ match, shareUrl, displayUrl }: Props) {
  const title = useMemo(() => (match.title || "").trim() || "SahayaBak Maçı", [match.title]);
  const date = (match.formattedDate || "").trim();
  const start = (match.startFormatted || "").trim();
  const end = (match.endFormatted || "").trim();
  const timeRange = start && end ? `${start} - ${end}` : start || end || "";
  const when = date && timeRange ? `${date} → ${timeRange}` : date || timeRange || "—";

  const pitchName = Array.isArray(match.pitches) ? match.pitches[0]?.name : (match.pitches as any)?.name;
  const pitchAddress = Array.isArray(match.pitches) ? match.pitches[0]?.address : (match.pitches as any)?.address;
  const pitchPhone = Array.isArray(match.pitches) ? match.pitches[0]?.phone : (match.pitches as any)?.phone;
  const pitchPrice = Array.isArray(match.pitches) ? match.pitches[0]?.price : (match.pitches as any)?.price;
  const rawFeatures = Array.isArray(match.pitches) ? match.pitches[0]?.features : (match.pitches as any)?.features;
  const district = Array.isArray(match.pitches)
    ? (match.pitches?.[0] as any)?.districts?.name
    : (match.pitches as any)?.districts?.name;
  const where = [district, pitchName].filter(Boolean).join(" → ") || "—";
  const shownUrl = (displayUrl || shareUrl || "").trim();
  const featureText = Array.isArray(rawFeatures) && rawFeatures.length > 0 ? rawFeatures.join(" • ") : "Belirtilmedi";
  const formattedPitchPrice = useMemo(() => {
    if (pitchPrice === null || pitchPrice === undefined) return "Belirtilmedi";

    const value = String(pitchPrice).trim();
    if (!value) return "Belirtilmedi";

    return value.includes("₺") ? value : `${value} ₺`;
  }, [pitchPrice]);
  const missingBadges = useMemo(() => {
    const raw = Array.isArray(match.missing_groups) ? match.missing_groups : [];
    const styleMap: Record<string, { short: string; backgroundColor: string; borderColor: string }> = {
      kaleci: { short: "KL", backgroundColor: "#dc2626", borderColor: "#f87171" },
      k: { short: "KL", backgroundColor: "#dc2626", borderColor: "#f87171" },
      defans: { short: "DF", backgroundColor: "#2563eb", borderColor: "#60a5fa" },
      d: { short: "DF", backgroundColor: "#2563eb", borderColor: "#60a5fa" },
      ortaSaha: { short: "OS", backgroundColor: "#16a34a", borderColor: "#4ade80" },
      ortasaha: { short: "OS", backgroundColor: "#16a34a", borderColor: "#4ade80" },
      o: { short: "OS", backgroundColor: "#16a34a", borderColor: "#4ade80" },
      forvet: { short: "FV", backgroundColor: "#ea580c", borderColor: "#fb923c" },
      f: { short: "FV", backgroundColor: "#ea580c", borderColor: "#fb923c" },
    };

    return raw
      .map((group) => {
        const [position, count] = String(group || "").split(":");
        const safeCount = Number.parseInt(count || "0", 10);
        const normalizedPosition = String(position || "").trim().toLowerCase().replace(/\s+/g, "");
        const badgeStyle = styleMap[normalizedPosition];
        if (!badgeStyle || !Number.isFinite(safeCount) || safeCount <= 0) return null;
        return {
          key: `${normalizedPosition}-${safeCount}`,
          text: `${badgeStyle.short} x ${safeCount}`,
          backgroundColor: badgeStyle.backgroundColor,
          borderColor: badgeStyle.borderColor,
        };
      })
      .filter(Boolean) as { key: string; text: string; backgroundColor: string; borderColor: string }[];
  }, [match.missing_groups]);

  return (
    <View
      style={{
        width: 1080,
        height: 1920,
        paddingHorizontal: 72,
        paddingTop: 82,
        paddingBottom: 74,
        backgroundColor: "#061018",
        justifyContent: "space-between",
      }}
    >
      <View>
        <View
          style={{
            alignSelf: "center",
            backgroundColor: "rgba(22,163,74,0.24)",
            borderWidth: 2,
            borderColor: "rgba(34,197,94,0.65)",
            paddingVertical: 18,
            paddingHorizontal: 30,
            borderRadius: 999,
            marginBottom: 38,
            shadowColor: "#22c55e",
            shadowOpacity: 0.28,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 10 },
          }}
        >
          <Text style={{ color: "#dcfce7", fontWeight: "900", fontSize: 56, letterSpacing: 0.8, textAlign: "center" }}>SahayaBak</Text>
        </View>

        <Text style={{ color: "#22c55e", fontWeight: "900", fontSize: 86, lineHeight: 100, textAlign: "center" }}>
          {title}
        </Text>

        <View style={{ height: 34 }} />

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            borderRadius: 30,
            paddingVertical: 34,
            paddingHorizontal: 34,
            borderWidth: 1.5,
            borderColor: "rgba(148,163,184,0.18)",
          }}
        >
          <Text style={{ color: "#e5e7eb", fontWeight: "900", fontSize: 58, lineHeight: 70, marginBottom: 18, textAlign: "center" }}>
            {when}
          </Text>
          <Text style={{ color: "#cbd5e1", fontWeight: "800", fontSize: 58, lineHeight: 70, textAlign: "center" }}>{where}</Text>
        </View>

        <View style={{ height: 30 }} />

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 30,
            paddingVertical: 30,
            paddingHorizontal: 32,
            borderWidth: 1.5,
            borderColor: "rgba(34,197,94,0.24)",
          }}
        >
          <Text style={{ color: "#f8fafc", fontWeight: "900", fontSize: 50, marginBottom: 28, textAlign: "center" }}>
            Eksik Kadro
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
            {missingBadges.length > 0 ? (
              missingBadges.map((badge) => (
                <View
                  key={badge.key}
                  style={{
                    paddingVertical: 20,
                    paddingHorizontal: 28,
                    borderRadius: 999,
                    backgroundColor: badge.backgroundColor,
                    borderWidth: 1.5,
                    borderColor: badge.borderColor,
                  }}
                >
                  <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 40, textAlign: "center" }}>{badge.text}</Text>
                </View>
              ))
            ) : (
              <View
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 22,
                  borderRadius: 999,
                  backgroundColor: "rgba(148,163,184,0.14)",
                  borderWidth: 1.5,
                  borderColor: "rgba(148,163,184,0.28)",
                }}
              >
                <Text style={{ color: "#e2e8f0", fontWeight: "800", fontSize: 36, textAlign: "center" }}>Kadro Tamamlanıyor</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ height: 30 }} />

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.05)",
            borderRadius: 30,
            paddingVertical: 30,
            paddingHorizontal: 32,
            borderWidth: 1.5,
            borderColor: "rgba(250,204,21,0.20)",
          }}
        >
          <Text style={{ color: "#f8fafc", fontWeight: "900", fontSize: 54, marginBottom: 28, textAlign: "center" }}>
            Halı Saha Özeti
          </Text>

          <Text style={{ color: "#fde68a", fontWeight: "800", fontSize: 40, lineHeight: 52, textAlign: "center", marginBottom: 14 }}>
            Açık Adres
          </Text>
          <Text style={{ color: "#e5e7eb", fontWeight: "700", fontSize: 42, lineHeight: 60, textAlign: "center", marginBottom: 26 }}>
            {pitchAddress || "Belirtilmedi"}
          </Text>

          <Text style={{ color: "#fde68a", fontWeight: "800", fontSize: 40, lineHeight: 52, textAlign: "center", marginBottom: 14 }}>
            Telefon
          </Text>
          <Text style={{ color: "#e5e7eb", fontWeight: "700", fontSize: 42, lineHeight: 60, textAlign: "center", marginBottom: 26 }}>
            {pitchPhone || "Belirtilmedi"}
          </Text>

          <Text style={{ color: "#fde68a", fontWeight: "800", fontSize: 40, lineHeight: 52, textAlign: "center", marginBottom: 14 }}>
            Saha Ücreti
          </Text>
          <Text style={{ color: "#e5e7eb", fontWeight: "700", fontSize: 42, lineHeight: 60, textAlign: "center", marginBottom: 26 }}>
            {formattedPitchPrice}
          </Text>

          <Text style={{ color: "#fde68a", fontWeight: "800", fontSize: 40, lineHeight: 52, textAlign: "center", marginBottom: 14 }}>
            Sahanın Özellikleri
          </Text>
          <Text style={{ color: "#e5e7eb", fontWeight: "700", fontSize: 40, lineHeight: 58, textAlign: "center" }}>
            {featureText}
          </Text>
        </View>
      </View>

      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.06)",
          borderRadius: 30,
          paddingVertical: 30,
          paddingHorizontal: 32,
          borderWidth: 1.5,
          borderColor: "rgba(148,163,184,0.18)",
        }}
      >
        <Text style={{ color: "#e5e7eb", fontWeight: "900", fontSize: 40, marginBottom: 14, textAlign: "center" }}>
          Maç Detayı
        </Text>
        <Text style={{ color: "#22c55e", fontWeight: "900", fontSize: 38, lineHeight: 46, textAlign: "center" }} numberOfLines={1}>
          {shownUrl}
        </Text>
        <Text style={{ color: "#9ca3af", marginTop: 14, fontSize: 24, lineHeight: 32, textAlign: "center" }}>
          Link açılmazsa Safari/Chrome’da açmayı dene.
        </Text>
      </View>
    </View>
  );
}

