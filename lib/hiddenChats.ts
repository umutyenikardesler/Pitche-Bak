import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Sohbeti sil" YEREL bir işlemdir: mesajlar veritabanından silinmez, yalnızca
 * bu cihazdaki kullanıcı için gizlenir (karşı taraf sohbetini görmeye devam
 * eder). Silme ANI saklanır; hem mesajlar listesindeki kart hem de sohbet
 * ekranındaki geçmiş bu ana göre filtrelenir:
 *
 *  - Mesajlar sayfası: son mesajı silme anından eskiyse kart görünmez.
 *  - Sohbet ekranı: silme anından ÖNCEKİ mesajlar hiç yüklenmez.
 *
 * Böylece sohbeti silip aynı kişiyle yeniden yazışmaya başladığında eski
 * yazışma karşına çıkmaz, ama yeni mesajlar sohbeti normal şekilde geri getirir.
 */

/** Silinen sohbetler: anahtar -> silinme zamanı. */
export type HiddenChats = Record<string, string>;

const storageKey = (userId: string) => `hidden_chats_${userId}`;

/**
 * Silme zamanı, `messages.created_at` ile AYNI çerçevede üretilir: veritabanı
 * bu sütunu Türkiye saati (UTC+3) olarak, saat dilimi bilgisi OLMADAN saklıyor
 * (bkz. supabase/migrations/20260521000200_messages_turkey_time.sql).
 * UTC damgası kullanılsaydı karşılaştırma 3 saat kayardı.
 */
export function turkeyNowStamp(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().replace('Z', '');
}

/**
 * Sohbet anahtarı. Mesajlar sayfasındaki `getChatKey` ile birebir aynı olmalı:
 * maç sohbeti `<kişi>-m-<maç>`, normal sohbet `<kişi>-d-x`.
 */
export function chatKey(otherUserId: string, matchId?: string | null): string {
  return matchId ? `${otherUserId}-m-${matchId}` : `${otherUserId}-d-x`;
}

/**
 * Depodaki kaydı okur.
 *
 * Eski biçim yalnızca anahtar dizisiydi (`string[]`) ve zaman bilgisi
 * içermediği için sohbet sonsuza kadar gizli kalıyordu. Eski kayıtlar "şimdi"
 * damgasıyla yeni biçime taşınır: önceki silmeler korunur, bundan sonra gelen
 * mesajlar sohbeti geri getirir. `migrated` true ise çağıran taraf yeni biçimi
 * kalıcı yazmalıdır (yazılmazsa her açılışta damga ileri kayar).
 */
export function parseHiddenChats(raw: string | null): { map: HiddenChats; migrated: boolean } {
  if (!raw) return { map: {}, migrated: false };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const now = turkeyNowStamp();
      const map: HiddenChats = {};
      for (const key of parsed as string[]) {
        if (typeof key === 'string' && key) map[key] = now;
      }
      return { map, migrated: true };
    }
    if (parsed && typeof parsed === 'object') {
      return { map: parsed as HiddenChats, migrated: false };
    }
  } catch {
    // Bozuk kayıt: gizleme uygulanmasın.
  }
  return { map: {}, migrated: false };
}

/** Tüm gizli sohbetleri döndürür; eski biçim varsa taşıyıp kalıcı yazar. */
export async function getHiddenChats(userId: string): Promise<HiddenChats> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  const { map, migrated } = parseHiddenChats(raw);
  if (migrated) {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(map));
  }
  return map;
}

/** Tek bir sohbetin silinme zamanı; silinmemişse null. */
export async function getChatHiddenAt(
  userId: string,
  otherUserId: string,
  matchId?: string | null
): Promise<string | null> {
  try {
    const map = await getHiddenChats(userId);
    return map[chatKey(otherUserId, matchId)] ?? null;
  } catch {
    return null;
  }
}

/** Sohbeti gizler (silme anını kaydeder). */
export async function hideChat(userId: string, key: string): Promise<void> {
  const map = await getHiddenChats(userId);
  map[key] = turkeyNowStamp();
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(map));
}
