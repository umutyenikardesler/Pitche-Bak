import { supabase } from '@/services/supabase';

export type FollowDirection = 'followers' | 'following';

/**
 * Takip listelerinde gösterilen kullanıcı.
 * Şekil, tüketicilerle (profile ekranı, UserListModal, ProfilePreview) aynı
 * tutuldu; oradaki yerel kopyalar bu tiple değiştirilebilir.
 */
export interface FollowUser {
  id: string;
  name: string;
  surname: string;
  profile_image?: string;
}

/**
 * follow_requests tablosunda ilişkinin hangi tarafı sorgulanacak.
 * followers: beni takip edenler  ->  following_id = ben, karşı taraf follower_id
 * following: benim takip ettiklerim -> follower_id = ben, karşı taraf following_id
 */
const DIRECTION_COLUMNS: Record<FollowDirection, { self: string; other: string }> = {
  followers: { self: 'following_id', other: 'follower_id' },
  following: { self: 'follower_id', other: 'following_id' },
};

/**
 * Kabul edilmiş takip ilişkilerini en yeniden eskiye sıralı olarak döner.
 *
 * İki sorgu gerekiyor çünkü sıralama follow_requests'in tarihine göre, gösterilen
 * veri ise users tablosundan geliyor: ilk sorgunun id sırası ikinci sorgunun
 * sonucuna Map üzerinden yeniden uygulanır.
 */
export async function fetchFollowList(
  userId: string,
  direction: FollowDirection,
): Promise<FollowUser[]> {
  const { self, other } = DIRECTION_COLUMNS[direction];

  const { data: relations, error: relationsError } = await supabase
    .from('follow_requests')
    .select(`${other}, updated_at, created_at`)
    .eq(self, userId)
    .eq('status', 'accepted')
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (relationsError || !relations || relations.length === 0) return [];

  const ids = relations.map((row: any) => row[other] as string);
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, surname, profile_image')
    .in('id', ids);

  if (usersError || !users) return [];

  const byId = new Map((users as any[]).map((u: any) => [u.id, u]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((u: any) => ({
      id: u.id,
      name: u.name,
      surname: u.surname,
      profile_image: u.profile_image,
    }));
}

/**
 * Takipçi ve takip edilen sayıları.
 *
 * Başarısız olan taraf için `null` döner — çağıran tarafın mevcut sayacı
 * sıfırlamak yerine olduğu gibi bırakabilmesi için (özgün davranış).
 */
export async function fetchFollowCounts(
  userId: string,
): Promise<{ followers: number | null; following: number | null }> {
  try {
    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from('follow_requests')
        .select('id')
        .eq('following_id', userId)
        .eq('status', 'accepted'),
      supabase
        .from('follow_requests')
        .select('id')
        .eq('follower_id', userId)
        .eq('status', 'accepted'),
    ]);

    return {
      followers: followersResult.error ? null : (followersResult.data?.length ?? 0),
      following: followingResult.error ? null : (followingResult.data?.length ?? 0),
    };
  } catch (error) {
    console.error('Takip verileri çekilirken hata:', error);
    return { followers: null, following: null };
  }
}
