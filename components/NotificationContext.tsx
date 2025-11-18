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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setCount(0);
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

    // Mesaj bildirimlerini (direct_message) ayrıca say
    const { count: dmCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('type', 'direct_message');

    setMessageCount(dmCount || 0);
  };

  // Kalp ikonundaki badge'i, bildirim sayfasına girildiği anda sıfırla.
  // Bildirim satırlarının is_read durumunu değiştirmez; sadece
  // o andaki unread sayısını referans olarak alır.
  const clearBadge = () => {
    setClearedBaseCount(count);
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