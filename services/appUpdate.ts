import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/**
 * Mağazadaki sürümü kontrol eder. Hem Ayarlar > Cihaz Bilgileri hem de açılıştaki
 * "yeni sürüm var" uyarısı bunu kullanır; iki yerde ayrı kod olmasın diye ortak.
 *
 * KAYNAK SIRASI:
 *  1. `app_versions` tablosu (her iki platform için de doğruluk kaynağı).
 *     Sürüm yayınlarken tek satır güncelleniyor, sonuç anında görünüyor.
 *  2. Tabloda kayıt yoksa iOS'ta iTunes lookup'a düşülür (yedek).
 * Android'de Play Store'un herkese açık bir sürüm API'si olmadığı için tablo
 * yoksa `updateAvailable` null kalır.
 */

export type AppUpdateInfo = {
  currentVersion: string;
  /** Mağazadaki sürüm; belirlenemezse null. */
  latestVersion: string | null;
  /** Mağaza sayfası; buton bunu açar. */
  storeUrl: string | null;
  /** true: güncelleme var, false: güncel, null: belirlenemedi. */
  updateAvailable: boolean | null;
  /** Tabloya özel açıklama girildiyse uyarı kartında bu gösterilir. */
  releaseNotes: string | null;
  error: string | null;
};

/** Ağ isteği bu süreden uzun sürerse iptal edilir. */
const REQUEST_TIMEOUT_MS = 8000;
/** Sonuç bu süre boyunca yeniden kullanılır (açılış + Ayarlar tek istek yapsın). */
const CACHE_TTL_MS = 5 * 60 * 1000;

let cached: { at: number; info: AppUpdateInfo } | null = null;
let inFlight: Promise<AppUpdateInfo> | null = null;

export function getCurrentAppVersion(): string {
  return (
    Constants.nativeAppVersion ??
    Constants.expoConfig?.version ??
    (Constants as any)?.manifest?.version ??
    '-'
  );
}

function getIosBundleId(): string | null {
  return (
    Constants.expoConfig?.ios?.bundleIdentifier ??
    (Constants as any)?.manifest?.ios?.bundleIdentifier ??
    null
  );
}

function getAndroidPackage(): string | null {
  return (
    Constants.expoConfig?.android?.package ??
    (Constants as any)?.manifest?.android?.package ??
    null
  );
}

export function getStoreUrl(): string | null {
  if (Platform.OS === 'android') {
    const pkg = getAndroidPackage();
    return pkg ? `https://play.google.com/store/apps/details?id=${pkg}` : null;
  }
  const bundleId = getIosBundleId();
  return bundleId ? `https://apps.apple.com/app/id${bundleId}` : null;
}

function normalizeVersion(v: string): string {
  return (v || '').trim().replace(/^v/i, '');
}

/** a > b ise 1, a < b ise -1, eşitse 0. */
export function compareVersions(aRaw: string, bRaw: string): number {
  const aParts = normalizeVersion(aRaw).split('.').map((x) => parseInt(x.replace(/\D/g, '') || '0', 10));
  const bParts = normalizeVersion(bRaw).split('.').map((x) => parseInt(x.replace(/\D/g, '') || '0', 10));
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

async function fetchIosLatest(bundleId: string): Promise<{ version: string | null; url: string | null }> {
  // ÖNEMLİ: iTunes lookup yanıtı CDN'de agresif önbelleğe alınıyor; yeni sürüm
  // yayınlandıktan sonra bir süre eski sürümü döndürebiliyor. Benzersiz bir
  // parametre ve no-store ile taze yanıt istiyoruz.
  const url =
    `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}` +
    `&t=${Date.now()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const json: any = await res.json();
    const item = json?.results?.[0];
    return {
      version: item?.version ? String(item.version) : null,
      url: item?.trackViewUrl ? String(item.trackViewUrl) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

type VersionRow = {
  latest_version: string | null;
  store_url: string | null;
  release_notes: string | null;
};

/** `app_versions` tablosundaki bu platforma ait satır. Kayıt yoksa null. */
async function fetchVersionRow(): Promise<VersionRow | null> {
  const platform = Platform.OS === 'android' ? 'android' : 'ios';
  const { data, error } = await supabase
    .from('app_versions')
    .select('latest_version, store_url, release_notes')
    .eq('platform', platform)
    .maybeSingle();

  if (error || !data?.latest_version) return null;
  return data as VersionRow;
}

/**
 * Güncelleme durumunu döndürür. Önce `app_versions` tablosuna, o yoksa iOS'ta
 * iTunes lookup'a bakar.
 */
export async function checkForAppUpdate(options?: { force?: boolean }): Promise<AppUpdateInfo> {
  if (!options?.force && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.info;
  }
  // Aynı anda iki yerden çağrılırsa tek istek yapılsın.
  if (inFlight) return inFlight;

  const currentVersion = getCurrentAppVersion();
  const fallbackStoreUrl = getStoreUrl();

  const base: AppUpdateInfo = {
    currentVersion,
    latestVersion: null,
    storeUrl: fallbackStoreUrl,
    updateAvailable: null,
    releaseNotes: null,
    error: null,
  };

  const decide = (
    latestVersion: string | null,
    storeUrl: string | null,
    releaseNotes: string | null
  ): AppUpdateInfo => {
    const resolvedUrl = storeUrl ?? fallbackStoreUrl;
    if (!latestVersion || !currentVersion || currentVersion === '-') {
      return { ...base, latestVersion, storeUrl: resolvedUrl, releaseNotes };
    }
    return {
      currentVersion,
      latestVersion,
      storeUrl: resolvedUrl,
      updateAvailable: compareVersions(latestVersion, currentVersion) === 1,
      releaseNotes,
      error: null,
    };
  };

  const run = async (): Promise<AppUpdateInfo> => {
    // 1) Tablo: her iki platformda da çalışan doğruluk kaynağı.
    try {
      const row = await fetchVersionRow();
      if (row?.latest_version) {
        return decide(row.latest_version, row.store_url, row.release_notes);
      }
    } catch {
      // Tabloya ulaşılamadı; aşağıdaki yedeğe düşülür.
    }

    // 2) Yedek: yalnızca iOS'ta iTunes lookup.
    if (Platform.OS !== 'ios') {
      return { ...base, error: 'no_version_row' };
    }

    const bundleId = getIosBundleId();
    if (!bundleId) {
      return { ...base, error: 'bundleId_not_found' };
    }

    try {
      const { version, url } = await fetchIosLatest(bundleId);
      return decide(version, url, null);
    } catch (e: any) {
      return { ...base, error: e?.name === 'AbortError' ? 'timeout' : e?.message || 'unknown' };
    }
  };

  inFlight = run()
    .then((info) => {
      cached = { at: Date.now(), info };
      return info;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
