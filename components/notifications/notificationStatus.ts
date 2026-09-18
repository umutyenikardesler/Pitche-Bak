import { Notification } from './notificationTypes';

/**
 * Bildirim hâlâ kullanıcının CEVABINI mı bekliyor (Kabul / Reddet)?
 *
 * Koşul, istek bileşenlerinin Kabul/Reddet butonlarını gösterme koşuluyla
 * BİREBİR aynı olmalı: FollowRequestNotification.tsx'teki `isResultMessage`
 * ve JoinRequestNotification.tsx'teki mesaj dalları. Bir istek işlendiğinde
 * satırın `message` alanı sonuç metniyle güncelleniyor (bkz.
 * useNotificationHandlers.ts); butonları o metin belirliyor, `is_read` değil.
 * Bileşenlerdeki metinler değişirse burası da değişmeli.
 *
 * "Tümünü Temizle" bu bildirimleri gizlemiyor: bekleyen bir takip isteği bu
 * sayfadan kaybolursa ona cevap verilecek başka bir yer kalmıyor.
 */
export function isAwaitingResponse(n: Pick<Notification, 'type' | 'message'>): boolean {
  const msg = String(n.message || '');
  const msgLower = msg.toLowerCase();

  if (n.type === 'follow_request') {
    const isResult =
      msg.includes('seni takip etmeye başladı') ||
      msgLower.includes('started following') ||
      msg.includes('takip isteğinizi kabul etti') ||
      msgLower.includes('accepted your follow request') ||
      msg.includes('takip isteğinizi reddetti') ||
      msgLower.includes('rejected your follow request') ||
      msg.includes('takip isteğini reddettiniz') ||
      msgLower.includes('you rejected');
    return !isResult;
  }

  if (n.type === 'join_request') {
    const isResult =
      msg.includes('reddedildi') ||
      msg.includes('kullanıcısının oluşturduğu') ||
      msg.includes('Göndermiş olduğunuz') ||
      msg.includes('kabul edildiniz') ||
      msg.includes('kabul edilmediniz');
    return !isResult;
  }

  return false;
}
