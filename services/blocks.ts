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
