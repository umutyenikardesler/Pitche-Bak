import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/services/supabase';

const NotificationContext = createContext({
  // Toplam okunmamış bildirim sayısı (DB'den gelen - direct_message HARİÇ)
  count: 0,
  // Mesaj (direct_message) bildirimlerinin okunmamış sayısı
  messageCount: 0,
  // Kalp ikonunda gösterilecek badge sayısı
  badgeCount: 0,
  refresh: () => {},
  // Bildirim sayfasına girildiği anda kalp ikonundaki badge'i sıfırlamak için
  clearBadge: () => {},
  // Herhangi bir sohbeti açtığında mesaj ikonundaki badge'i temizlemek için
  clearMessageBadge: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [count, setCount] = useState(0); // toplam unread
  const [clearedBaseCount, setClearedBaseCount] = useState(0); // son "sıfırlama" anındaki unread
  const [messageCount, setMessageCount] = useState(0); // direct_message unread

  const fetchCount = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setCount(0);
        setMessageCount(0);
        return;
      }

    // Genel bildirimler (direct_message HARİÇ)
    const { count: notifCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .neq('type', 'direct_message');

    const newCount = notifCount || 0;
    setCount(newCount);
    // Eğer unread sayısı azaldıysa, clearedBaseCount'u de aşağı çek
    setClearedBaseCount((prev) => Math.min(prev, newCount));

    // Mesaj bildirimlerini (direct_message) sohbet bazında say
    // Aynı kişiden/sohbetten gelen birden fazla mesajı 1 sohbet olarak say
    const { data: dmRows, error: dmError } = await supabase
      .from('notifications')
      .select('sender_id, match_id')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('type', 'direct_message');

    if (dmError || !dmRows) {
      setMessageCount(0);
      return;
    }

    const convoKeys = new Set<string>();
    dmRows.forEach((row: any) => {
      if (!row.sender_id) return;
      const key = `${row.sender_id}-${row.match_id || 'null'}`;
      convoKeys.add(key);
    });

    setMessageCount(convoKeys.size);
    } catch (error) {
      // Başlangıçta hata olursa sessizce geç
      console.log('NotificationProvider fetchCount error:', error);
      setCount(0);
      setMessageCount(0);
    }
  };

  // Kalp ikonundaki badge'i, bildirim sayfasına girildiği anda sıfırla.
  // Tüm okunmamış bildirimleri (direct_message hariç) DB'de okundu olarak işaretle.
  const clearBadge = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1) Takip/Katılım isteği DIŞINDAKİ tüm bildirimleri okundu yap
    // (Kabul/Reddet gibi aksiyon gerektiren bildirimleri etkilemeyelim)
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .neq('type', 'direct_message')
      .neq('type', 'follow_request')
      .neq('type', 'join_request');

    // 2) follow_request / join_request içindeki FEEDBACK (sonuç) bildirimlerini otomatik okundu yap.
    // SQL message filter'larına güvenmek yerine, önce satırları alıp JS tarafında ayıklayacağız.
    try {
      const { data: rows, error: rowsErr } = await supabase
        .from('notifications')
        .select('id, type, message')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .in('type', ['follow_request', 'join_request']);

      if (rowsErr) {
        console.log('[NotificationProvider] clearBadge feedback fetch error:', rowsErr);
      } else {
        const idsToMarkRead: string[] = [];

        (rows || []).forEach((r: any) => {
          const id = r?.id;
          const type = r?.type;
          const msg = String(r?.message || '');
          const msgLower = msg.toLowerCase();

          if (typeof id !== 'string' || !id) return;

          if (type === 'follow_request') {
            // Actionable follow request:
            // TR: "... sana takip isteği gönderdi."
            // EN: "... sent you a follow request."
            const isActionable =
              msgLower.includes('takip isteği gönderdi') ||
              msgLower.includes('sent you a follow request');

            // Geri dönüş/feedback (kabul-red / started following) ise otomatik oku
            if (!isActionable) idsToMarkRead.push(id);
            return;
          }

          if (type === 'join_request') {
            // Actionable join request: "... pozisyonunda katılım isteği" (kabul/red içermez)
            const isFeedback =
              msgLower.includes('kabul edildiniz') ||
              msgLower.includes('kabul edilmediniz') ||
              msgLower.includes('reddedildi');

            if (isFeedback) idsToMarkRead.push(id);
            return;
          }
        });

        if (idsToMarkRead.length > 0) {
          const { error: updErr } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', idsToMarkRead);

          if (updErr) {
            console.log('[NotificationProvider] clearBadge feedback update error:', updErr);
          }
        }
      }
    } catch (e) {
      console.log('[NotificationProvider] clearBadge feedback exception:', e);
    }

    // Sayaçları güncelle
    await fetchCount();
  };

  // Mesaj sekmesi ikonundaki badge'i (direct_message sayacını) manuel temizle.
  // DB'deki is_read durumunu chat ekranı güncelliyor; bu sadece UI state'ini sıfırlar.
  const clearMessageBadge = () => {
    setMessageCount(0);
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const badgeCount = Math.max(0, count - clearedBaseCount);

  return (
    <NotificationContext.Provider value={{ count, messageCount, badgeCount, refresh: fetchCount, clearBadge, clearMessageBadge }}>
      {children}
    </NotificationContext.Provider>
  );
};