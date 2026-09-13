import { supabase } from '@/services/supabase';
import { reportContent } from '@/services/contentReports';

/**
 * Engellenen kullanıcı ID'lerini getirir (me = blocker)
 */
export async function getBlockedUserIds(blockerId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', blockerId);

  if (error) {
    console.error('[blocks] getBlockedUserIds error:', error);
    return new Set();
  }

  return new Set((data || []).map((r: { blocked_id: string }) => r.blocked_id));
}

/**
 * Kullanıcıyı engelle. Geliştiriciye bildirim için content_reports'a da yazar.
 */
export async function blockUser(blockerId: string, blockedId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('user_blocks')
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (error) {
    console.error('[blocks] blockUser error:', error);
    return { error: error as unknown as Error };
  }

  // Geliştiriciye bildirim: content_reports tablosuna kayıt (Supabase Webhook ile e-posta tetiklenebilir)
  await reportContent({
    reporterId: blockerId,
    reportedUserId: blockedId,
    contentType: 'user_block',
    contentId: null,
    contentPreview: 'Kullanıcı engellendi',
  });

  return { error: null };
}

/**
 * Engellemeyi kaldır
 */
export async function unblockUser(blockerId: string, blockedId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);

  if (error) {
    console.error('[blocks] unblockUser error:', error);
    return { error: error as unknown as Error };
  }
  return { error: null };
}

/** Engellediklerim listesinde gösterilecek kullanıcı. */
export type BlockedUser = {
  id: string;
  name: string | null;
  surname: string | null;
  profile_image: string | null;
  blockedAt: string;
};

/**
 * Engellenen kullanıcı kimliği -> ENGELLEME ANI (ham TIMESTAMPTZ).
 *
 * Engellenen sohbetin kartı bu ana donduruluyor: sonrasında gelen mesajlar
 * önizlemeyi ve tarihi değiştirmiyor. Karşılaştırmadan önce zamanın
 * `toTurkeyStamp` ile mesaj saatiyle aynı çerçeveye çevrilmesi gerekir.
 */
export async function getBlockedUserTimes(blockerId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', blockerId);

  if (error) {
    console.error('[blocks] getBlockedUserTimes error:', error);
    return new Map();
  }

  return new Map(
    (data || []).map((r: { blocked_id: string; created_at: string }) => [r.blocked_id, r.created_at])
  );
}

/**
 * Engellenen kullanıcıları profil bilgileriyle birlikte getirir.
 *
 * `getBlockedUserIds` yalnızca kimlik döndürüyor; liste ekranında isim ve
 * fotoğraf da gerektiği için ayrı bir sorgu var. RLS zaten `blocker_id`'yi
 * kendi kullanıcısına kilitliyor (bkz. 20260303000001 migration'ı).
 */
export async function getBlockedUsers(blockerId: string): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('created_at, blocked:users!user_blocks_blocked_id_fkey(id, name, surname, profile_image)')
    .eq('blocker_id', blockerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[blocks] getBlockedUsers error:', error);
    return [];
  }

  return (data || [])
    .map((row: any) => {
      // PostgREST ilişkiyi tekil ya da tek elemanlı dizi olarak döndürebiliyor.
      const u = Array.isArray(row.blocked) ? row.blocked[0] : row.blocked;
      if (!u?.id) return null;
      return {
        id: u.id as string,
        name: (u.name ?? null) as string | null,
        surname: (u.surname ?? null) as string | null,
        profile_image: (u.profile_image ?? null) as string | null,
        blockedAt: row.created_at as string,
      };
    })
    .filter((x): x is BlockedUser => x !== null);
}

/** Bu kullanıcıyı engelledim mi? Mesaj göndermeden önceki kontrol için. */
export async function isUserBlockedByMe(blockerId: string, otherUserId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_blocks')
    .select('id')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', otherUserId)
    .maybeSingle();

  if (error) {
    console.error('[blocks] isUserBlockedByMe error:', error);
    return false;
  }
  return !!data;
}
