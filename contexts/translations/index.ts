import { tr } from './tr';
import { en } from './en';

export type { TranslationKey } from './tr';

/** Desteklenen diller. */
export type Language = 'tr' | 'en';

/**
 * Dil kodu -> çeviri sözlüğü.
 *
 * Record<string, string> olarak tipleniyor çünkü bazı çağrı noktaları anahtarı
 * runtime'da üretiyor (ör. PolicyModal'daki `settings.agreements.${policyKey}`).
 * Anahtar paritesi en.ts'teki Record<TranslationKey, string> ile korunuyor.
 */
export const translations: Record<Language, Record<string, string>> = { tr, en };
