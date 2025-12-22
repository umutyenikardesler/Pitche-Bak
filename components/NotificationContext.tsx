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

    // Tüm okunmamış bildirimleri (direct_message hariç) okundu olarak işaretle
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .neq('type', 'direct_message');

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