import { supabase } from '@/services/supabase';
import { turkeyTimestamp } from '@/lib/turkeyDate';

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
  /** 'message' raporunda şikayet edilen mesajın id'si; onaylanınca bu silinir. */
  content_id: string | null;
  content_preview: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  reporter?: { name?: string; surname?: string } | null;
  reported_user?: { name?: string; surname?: string } | null;
};

/**
 * Türkiye saati (UTC+3) - PostgreSQL timestamp formatında (YYYY-MM-DD HH:mm:ss)
 *
 * Eskiden sv-SE yerel biçimine güveniyordu. Bu biçim cihazın Intl verisine
 * bağlı: yerel çözülemeyip ABD biçimine düşen cihazlarda "9/21/2026, 12:08:54 AM"
 * gibi bir metin üretip veritabanına yazıyordu.
 */
function getTurkeyTimeString(): string {
  return turkeyTimestamp();
}

/**
 * Admin şikayet durumunu günceller. resolved, reviewed veya rejected.
 * reviewed_at: Türkiye saati (UTC+3) olarak kaydedilir.
 *
 * content_type='message' ve status='resolved' (Onayla) ise şikayet edilen
 * mesaj GERÇEKTEN SİLİNİR: "Onayla" eskiden yalnızca bir etiket değiştiriyordu,
 * şikayet edilen mesaj sohbette öylece duruyordu. Admin'in mesajı silebilmesi
 * için ayrı bir RLS izni gerekiyor (bkz. 20260925000000 migration'ı);
 * normalde yalnızca gönderen kendi mesajını silebiliyor.
 *
 * content_type='profile' için henüz bir yaptırım (hesap askıya alma vb.)
 * yok; yalnızca durum işaretleniyor.
 *
 * content_type='user_block' bir "karar bekleyen şikayet" değil, engelleme
 * yapıldığında otomatik düşen bir bildirim kaydı; buradaki durum bir işlem
 * tetiklemiyor (engelleme zaten anında, admin onayından bağımsız uygulanıyor).
 */
export async function updateReportStatus(
  report: Pick<AdminReportRow, 'id' | 'content_type' | 'content_id'>,
  status: 'resolved' | 'reviewed' | 'rejected' | 'checked'
): Promise<{ error: Error | null; messageDeleted: boolean }> {
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
    return { error: reportError as unknown as Error, messageDeleted: false };
  }

  let messageDeleted = false;
  if (report.content_type === 'message' && status === 'resolved' && report.content_id) {
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', report.content_id);

    if (deleteError) {
      // RLS reddi ya da mesaj zaten silinmiş olabilir (gönderen kendi silmiş);
      // rapor durumu yine de güncellendi, admin'e ayrı bir uyarı gösteriliyor.
      console.error('[contentReports] reported message could not be deleted:', deleteError);
    } else {
      messageDeleted = true;
    }
  }

  return { error: null, messageDeleted };
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
      content_id,
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
