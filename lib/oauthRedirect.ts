import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase } from '@/services/supabase';

/** app.config.js'te varyanta göre değişen scheme (prod: myapp, dev: myapp-dev). */
function getAppScheme(): string {
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

  return null;
}
