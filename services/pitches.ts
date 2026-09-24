import { supabase } from '@/services/supabase';
import { turkeyTimestamp } from '@/lib/turkeyDate';

/**
 * Saha ekleme ve saha önerileri.
 *
 * Saha listesi uygulamanın ana verisi: maçlar buna bağlanıyor, mesafe sıralaması
 * ve harita bunun koordinatlarını kullanıyor. Bu yüzden kullanıcı önerileri
 * doğrudan `pitches` tablosuna yazılmıyor; `pitch_suggestions` kuyruğuna düşüyor
 * ve admin onaylayınca sahaya dönüşüyor.
 */

export type District = { id: number; name: string };

export type PitchInput = {
  name: string;
  district_id: number;
  address?: string | null;
  phone?: string | null;
  price?: number | null;
  features?: string[] | null;
  latitude: number;
  longitude: number;
};

export type SuggestionInput = Omit<PitchInput, 'latitude' | 'longitude'> & {
  latitude?: number | null;
  longitude?: number | null;
};

export type PitchSuggestionRow = {
  id: number;
  created_by: string | null;
  name: string;
  district_id: number | null;
  address: string | null;
  phone: string | null;
  price: number | null;
  features: string[] | null;
  latitude: number | null;
  longitude: number | null;
  status: 'pending' | 'approved' | 'rejected';
  pitch_id: string | null;
  created_at: string;
  districts?: { name?: string } | null;
  users?: { name?: string; surname?: string } | null;
};

export async function fetchDistricts(): Promise<District[]> {
  const { data, error } = await supabase.from('districts').select('id, name').order('name');
  if (error) {
    console.error('[Saha] ilçeler alınamadı:', error);
    return [];
  }
  return (data ?? []) as District[];
}

/**
 * Aynı sahanın ikinci kez eklenmesini önlemek için yakındaki sahaları getirir.
 * ~300 m'lik bir kare kutu yeterli: halı sahalar bu kadar yakın olmuyor.
 */
export async function findNearbyPitches(
  latitude: number,
  longitude: number,
  meters = 300
): Promise<{ id: string; name: string; latitude: number; longitude: number }[]> {
  const latDelta = meters / 111_000;
  // Boylam dereceleri enlemle daralıyor; Türkiye enlemlerinde cos(lat) ~0.75.
  const lonDelta = latDelta / Math.max(0.2, Math.cos((latitude * Math.PI) / 180));

  const { data, error } = await supabase
    .from('pitches')
    .select('id, name, latitude, longitude')
    .gte('latitude', latitude - latDelta)
    .lte('latitude', latitude + latDelta)
    .gte('longitude', longitude - lonDelta)
    .lte('longitude', longitude + lonDelta);

  if (error) {
    console.error('[Saha] yakın sahalar sorgulanamadı:', error);
    return [];
  }
  return (data ?? []) as { id: string; name: string; latitude: number; longitude: number }[];
}

export async function createPitch(input: PitchInput): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('pitches')
    .insert({
      name: input.name.trim(),
      district_id: input.district_id,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      price: input.price ?? null,
      features: input.features?.length ? input.features : null,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Saha] eklenemedi:', error);
    return { id: null, error: error as unknown as Error };
  }
  return { id: (data as any)?.id ?? null, error: null };
}

export async function createPitchSuggestion(
  input: SuggestionInput
): Promise<{ error: Error | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;
  if (!userId) return { error: new Error('Öneri için giriş yapmış olmak gerekiyor.') };

  const { error } = await supabase.from('pitch_suggestions').insert({
    created_by: userId,
    name: input.name.trim(),
    district_id: input.district_id,
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    price: input.price ?? null,
    features: input.features?.length ? input.features : null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  });

  if (error) {
    console.error('[Saha önerisi] gönderilemedi:', error);
    return { error: error as unknown as Error };
  }
  return { error: null };
}

/** Admin: öneri kuyruğu. RLS gereği admin olmayan yalnızca kendi önerilerini görür. */
export async function fetchPitchSuggestions(
  status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending'
): Promise<PitchSuggestionRow[]> {
  let query = supabase
    .from('pitch_suggestions')
    .select('*, districts (name), users:created_by (name, surname)')
    .order('created_at', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('[Saha önerisi] liste alınamadı:', error);
    return [];
  }
  return (data ?? []) as PitchSuggestionRow[];
}

async function setSuggestionStatus(
  id: number,
  status: 'approved' | 'rejected',
  pitchId?: string | null
): Promise<{ error: Error | null }> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('pitch_suggestions')
    .update({
      status,
      pitch_id: pitchId ?? null,
      reviewed_by: auth?.user?.id ?? null,
      reviewed_at: turkeyTimestamp(),
    })
    .eq('id', id);

  if (error) {
    console.error('[Saha önerisi] durum güncellenemedi:', error);
    return { error: error as unknown as Error };
  }
  return { error: null };
}

/** Öneriyi sahaya çevirir. Saha eklenemezse öneri BEKLEMEDE kalır. */
export async function approvePitchSuggestion(
  id: number,
  pitch: PitchInput
): Promise<{ error: Error | null }> {
  const { id: pitchId, error } = await createPitch(pitch);
  if (error) return { error };
  return setSuggestionStatus(id, 'approved', pitchId);
}

export async function rejectPitchSuggestion(id: number): Promise<{ error: Error | null }> {
  return setSuggestionStatus(id, 'rejected');
}
