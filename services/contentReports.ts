import { supabase } from '@/services/supabase';

export type ContentType = 'message' | 'profile' | 'user_block';

/**
 * Bu kullanıcı bu içeriği daha önce şikayet etti mi?
 */
export async function hasUserReportedContent(
  reporterId: string,
  contentType: ContentType,
  contentId: string | null
): Promise<boolean> {
  if (!contentId) return false;
  const { data, error } = await supabase
    .from('content_reports')
    .select('id')
    .eq('reporter_id', reporterId)
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[contentReports] hasUserReportedContent error:', error);
    return false;
  }
  return !!data;
}

/**
 * İçerik şikayeti oluştur - content_reports tablosuna yazar.
 * Geliştirici bildirimi: Supabase Database Webhook ile content_reports INSERT'e
 * tetiklenebilir (örn. e-posta servisi). Bu fonksiyon sadece kayıt oluşturur.
 */
export async function reportContent(params: {
  reporterId: string;
  reportedUserId: string | null;
  contentType: ContentType;
  contentId: string | null;
  contentPreview: string | null;
  /** Ek açıklama (isteğe bağlı) - reason sütununa yazılır */
  reason?: string | null;
}): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: params.reporterId,
    reported_user_id: params.reportedUserId,
    content_type: params.contentType,
    content_id: params.contentId,
    content_preview: params.contentPreview ? params.contentPreview.slice(0, 500) : null,
    reason: params.reason || null,
    status: 'pending',
  });

  if (error) {
    console.error('[contentReports] reportContent error:', error);
    return { error: error as unknown as Error };
  }
  return { error: null };
}

export type AdminReportRow = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  content_type: string;
  content_preview: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  reporter?: { name?: string; surname?: string } | null;
  reported_user?: { name?: string; surname?: string } | null;
};

/**
 * Türkiye saati (UTC+3) - PostgreSQL timestamp formatında (YYYY-MM-DD HH:mm:ss)
 */
function getTurkeyTimeString(): string {
  const now = new Date();
  // sv-SE locale: 24 saat formatında "2026-03-18 23:33:21"
  const s = now.toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul' });
  return s;
}

/**
 * Admin şikayet durumunu günceller. resolved, reviewed veya rejected.
 * reviewed_at: Türkiye saati (UTC+3) olarak kaydedilir.
 * content_type='user_block' ise user_blocks tablosu da güncellenir.
 */
export async function updateReportStatus(
  report: Pick<AdminReportRow, 'id' | 'content_type' | 'reporter_id' | 'reported_user_id'>,
  status: 'resolved' | 'reviewed' | 'rejected' | 'checked'
): Promise<{ error: Error | null }> {
  const reviewedAt = getTurkeyTimeString();

  const { error: reportError } = await supabase
    .from('content_reports')
    .update({
      status,
      reviewed_at: reviewedAt,
    })
    .eq('id', report.id);

  if (reportError) {
    console.error('[contentReports] updateReportStatus error:', reportError);
    return { error: reportError as unknown as Error };
  }

  // user_block raporu ise user_blocks tablosunu da güncelle
  if (report.content_type === 'user_block' && report.reporter_id && report.reported_user_id) {
    const { error: blockError } = await supabase
      .from('user_blocks')
      .update({
        status,
        reviewed_at: reviewedAt,
      })
      .eq('blocker_id', report.reporter_id)
      .eq('blocked_id', report.reported_user_id);

    if (blockError) {
      console.error('[contentReports] updateReportStatus user_blocks error:', blockError);
    }
  }

  return { error: null };
}

/**
 * Admin için tüm şikayetleri listele. Sadece role='admin' kullanıcılar görebilir (RLS).
 */
export async function fetchAdminReports(): Promise<{
  data: AdminReportRow[] | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('content_reports')
    .select(
      `
      id,
      reporter_id,
      reported_user_id,
      content_type,
      content_preview,
      reason,
      status,
      created_at,
      reporter:users!reporter_id(name, surname),
      reported_user:users!reported_user_id(name, surname)
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[contentReports] fetchAdminReports error:', error);
    return { data: null, error: error as unknown as Error };
  }
  return { data: (data as AdminReportRow[]) || [], error: null };
}
