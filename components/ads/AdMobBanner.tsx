import React, { useEffect, useMemo } from "react";
import { Platform, View } from "react-native";
import Constants from "expo-constants";

type Props = {
  className?: string;
};

export default function AdMobBanner({ className }: Props) {
  // Web build'ini bozmamak için tamamen kapatıyoruz
  if (Platform.OS === "web") return null;

  let mod: any = null;
  try {
    mod = require("react-native-google-mobile-ads");
  } catch {
    return null;
  }

  const mobileAds = mod?.default;
  const BannerAd = mod?.BannerAd;
  const BannerAdSize = mod?.BannerAdSize;
  const TestIds = mod?.TestIds;

  const unitId = useMemo(() => {
    const extra = (Constants.expoConfig as any)?.extra;
    const ios = extra?.admob?.bannerUnitIdIos;
    const android = extra?.admob?.bannerUnitIdAndroid;
    const fromConfig = Platform.OS === "ios" ? ios : android;
    if (typeof fromConfig === "string" && fromConfig.trim().length) return fromConfig.trim();
    return TestIds?.BANNER;
  }, [TestIds]);

  useEffect(() => {
    // Initialize once; hata olsa da banner'ı engellemeyelim
    Promise.resolve()
      .then(() => mobileAds?.()?.initialize?.())
      .catch(() => {});
  }, [mobileAds]);

  if (!BannerAd || !BannerAdSize || !unitId) return null;

  // Sabit 320x50 (MMA) yerine cihaz genişliğine göre en uygun slot: tablette
  // 320x50 envanteri telefona göre çok daha zayıf, "no fill" olasılığı yüksek.
  const size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER ?? BannerAdSize.BANNER;

  return (
    <View className={className} style={{ alignItems: "center" }}>
      <BannerAd
        unitId={__DEV__ ? TestIds?.BANNER ?? unitId : unitId}
        size={size}
        requestOptions={{
          // ATT/consent akışını zorlamamak için NPA (ileride istersen açarız)
          requestNonPersonalizedAdsOnly: true,
        }}
        // Reklam gelmediğinde sessizce boş kalıyordu; sebebi (no fill, yanlış
        // birim kimliği, ağ) ayırt edilemiyordu. __DEV__ dışında da yazılıyor:
        // test kimliği hep dolduğu için sorun yalnızca gerçek birimde görülüyor.
        onAdFailedToLoad={(error: any) => {
          console.log("[Reklam] yüklenemedi:", error?.code ?? "", error?.message ?? String(error));
        }}
      />
    </View>
  );
}

