import { supabase } from '@/services/supabase';

/**
 * Mesaj tepkileri (emoji).
 *
 * Ayrı tabloda tutuluyor (bkz. supabase/migrations/20260918000000_create_message_reactions.sql):
 * `messages` satırını RLS gereği yalnızca gönderen güncelleyebildiği için
 * alıcının tepkisi mesaj satırına yazılamıyor. Tepkiyi yalnızca mesajın
 * ALICISI verebilir; mesaj başına kişi başına tek tepki.
 */

/** Mesaj kimliği -> emoji. Bire bir sohbette her mesaja yalnızca alıcı tepki verir. */
export type ReactionMap = Record<string, string>;

// `in` filtresi URL'ye yazılıyor; uzun sohbetlerde istek çok büyümesin.
const CHUNK_SIZE = 100;

/**
 * Verilen mesajların tepkilerini getirir.
 *
 * Hata durumunda (ör. migration henüz uygulanmamışsa tablo yok) boş döner;
 * mesajlar tepkisiz görünmeye devam eder, sohbet ekranı etkilenmez.
 */
export async function fetchReactions(messageIds: string[]): Promise<ReactionMap> {
  const map: ReactionMap = {};
  if (messageIds.length === 0) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < messageIds.length; i += CHUNK_SIZE) {
    chunks.push(messageIds.slice(i, i + CHUNK_SIZE));
  }

  const results = await Promise.all(
    chunks.map((ids) =>
      supabase.from('message_reactions').select('message_id, emoji').in('message_id', ids)
    )
  );

  for (const { data, error } of results) {
    if (error) {
      console.warn('[Reactions] fetch error:', error.message);
      continue;
    }
    for (const r of (data || []) as { message_id: string; emoji: string }[]) {
      map[r.message_id] = r.emoji;
    }
  }
  return map;
}

/** Tepki ekler ya da mevcut tepkiyi değiştirir. */
export async function setMessageReaction(messageId: string, userId: string, emoji: string) {
  return supabase
    .from('message_reactions')
    .upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: 'message_id,user_id' });
}

/** Tepkiyi kaldırır. */
export async function removeMessageReaction(messageId: string, userId: string) {
  return supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('user_id', userId);
}
