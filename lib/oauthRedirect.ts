import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from '@/services/supabase';

/**
 * Varyanta göre değişen deep link şeması (prod: `myapp`, dev: `myapp-dev`).
 *
 * ÖNEMLİ: Şema `Constants.expoConfig`'ten OKUNMUYOR. O değer Metro'nun sunduğu
 * yapılandırmadan geliyor ve Metro `APP_VARIANT` verilmeden başlatıldığında
 * PROD olarak çözülüyor — yüklü uygulama dev build olsa bile. Sonuç: dev
 * uygulamada Google girişi `myapp://` üretiyor ve cihazdaki PROD uygulamayı
 * açıyordu (prod silinince de tarayıcıda takılı kalıyordu).
 *
 * Bunun yerine ÇALIŞAN uygulamanın gerçek paket kimliği kullanılıyor; bu değer
 * Metro'dan değil binary'den geliyor, dolayısıyla varyantı şaşmaz.
 * Eşleşme scripts/configure-*-variant.js ile aynı kuralı izler.
 */
function getAppScheme(): string {
  const appId = Application.applicationId ?? '';
  if (appId.endsWith('.dev')) return 'myapp-dev';
  if (appId) return 'myapp';

  // Son çare (ör. web): yapılandırmadan oku.
  const config = Constants.expoConfig as any;
  return config?.scheme || config?.ios?.scheme || config?.android?.scheme || 'myapp';
}

/** AuthSession'ın dinleyeceği gerçek app deep link'i. */
export function getOAuthRedirectUri(): string {
  if (Platform.OS === 'web') return Linking.createURL('auth/callback');
  return makeRedirectUri({ scheme: getAppScheme(), path: 'auth/callback' });
}

/**
 * Supabase'e verilecek redirectTo.
 *
 * Native'de hash/query kaybını azaltmak için önce web callback sayfamıza dönüp
 * oradan doğru scheme ile uygulamaya geri yönlendiriyoruz.
 */
export function getOAuthSupabaseRedirectUrl(): string {
  if (Platform.OS === 'web') return Linking.createURL('auth/callback');

  const scheme = getAppScheme();
  const webBaseUrl = (Constants.expoConfig as any)?.extra?.webBaseUrl;

  if (webBaseUrl) {
    const base = `${webBaseUrl.replace(/\/$/, '')}/auth/callback.html`;
    return `${base}${base.includes('?') ? '&' : '?'}s=${encodeURIComponent(scheme)}`;
  }

  return makeRedirectUri({ scheme, path: 'auth/callback' });
}

/**
 * OAuth dönüş URL'inden Supabase oturumu kurar.
 * PKCE akışında `code`, implicit akışta `access_token` + `refresh_token` gelir.
 */
export async function createSessionFromRedirectUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const code = (params as any)?.code as string | undefined;
  const access_token = (params as any)?.access_token as string | undefined;
  const refresh_token = (params as any)?.refresh_token as string | undefined;

  if (code) {
    const { data: exchanged, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return exchanged?.session ?? null;
  }

  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return data?.session ?? null;
  }

  // Dönüş URL'inde beklenen parametre yoksa:
  //
  // 1) Oturum bu arada BAŞKA bir yolda kurulmuş olabilir. Kök Linking
  //    dinleyicisi (bkz. app/_layout.tsx) aynı deep link'i yakalayıp
  //    /auth/callback ekranını açıyor ve kodu orada tüketebiliyor. Bu yarış
  //    özellikle Android'de görülüyor. Oturum varsa hata değil, başarı.
  const { data: existing } = await supabase.auth.getSession();
  if (existing?.session) return existing.session;

  // 2) Gerçekten hiçbir şey yoksa AÇIKLAYICI hata at. Eskiden burada `null`
  //    dönülüyordu; çağıran taraf ardından getUser() çağırdığı için kullanıcıya
  //    "Auth session missing!" gibi sebebi gizleyen bir mesaj gidiyordu.
  //    Kodun kendisi loglanmıyor, yalnızca hangi anahtarların geldiği.
  const keys = Object.keys((params as Record<string, unknown>) ?? {});
  throw new Error(
    `OAuth dönüşünde oturum bilgisi yok. Gelen parametreler: ${keys.length ? keys.join(', ') : '(boş)'}`
  );
}
