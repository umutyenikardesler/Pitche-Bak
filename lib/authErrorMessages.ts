import type { Language } from '@/contexts/LanguageContext';

/**
 * Supabase Auth'un döndürdüğü İngilizce hata mesajlarının çeviri anahtarlarına eşlemesi.
 * Supabase mesaj metnini değiştirirse buraya yeni bir satır eklemek yeterli.
 */
const ERROR_KEY_MAP: Record<string, string> = {
  'Password should be at least 6 characters': 'auth.errors.passwordMin',
  'AuthApiError: Password should be at least 6 characters': 'auth.errors.passwordMin',
  'Email format is invalid': 'auth.errors.invalidEmail',
  'User already registered': 'auth.errors.userAlreadyRegistered',
  'AuthApiError: User already exists': 'auth.errors.userAlreadyExists',
  'Invalid login credentials': 'auth.errors.invalidCredentials',
  'Email not confirmed': 'auth.errors.emailNotConfirmed',
  'User not found': 'auth.errors.userNotFound',
  'Unsupported provider: missing OAuth secret': 'auth.errors.appleMissingOAuthSecret',
  'missing OAuth secret': 'auth.errors.missingOAuthSecret',
  'redirect url is not allowed': 'auth.errors.redirectUrlNotAllowed',
  'Redirect URL is not allowed': 'auth.errors.redirectUrlNotAllowed',
  'Invalid Redirect URL': 'auth.errors.redirectUrlNotAllowed',
  'Email rate limit exceeded': 'auth.errors.emailRateLimitExceeded',
  'For security purposes, you can only request this once every 60 seconds':
    'auth.errors.emailRateLimitExceeded',
};

/**
 * Auth hata mesajını seçili dile çevirir.
 *
 * Tam eşleşme bulunamazsa mesaj içeriğine göre iki yaygın hata sınıfı yakalanır
 * (redirect URL ve rate limit). Hiçbiri tutmazsa TR'de başlık eklenir, EN'de
 * mesaj olduğu gibi gösterilir.
 */
export function translateAuthError(
  errorMessage: string,
  t: (key: string) => string,
  currentLanguage: Language,
): string {
  const key = ERROR_KEY_MAP[errorMessage];
  if (key) return t(key);

  const lower = errorMessage.toLowerCase();
  if (lower.includes('redirect') && lower.includes('url')) {
    return t('auth.errors.redirectUrlNotAllowed');
  }
  if (lower.includes('rate limit') || lower.includes('60 seconds')) {
    return t('auth.errors.emailRateLimitExceeded');
  }

  // Bilinmeyen hata: TR'de başlık ekle, EN'de mesajı olduğu gibi göster
  if (currentLanguage === 'tr') return `${t('general.error')}: ${errorMessage}`;
  return errorMessage;
}
