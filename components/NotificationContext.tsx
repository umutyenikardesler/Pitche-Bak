import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/services/supabase';

const NotificationContext = createContext({
  count: 0,
  refresh: () => {},
});

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setCount(0);
    const { count: notifCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setCount(notifCount || 0);
  };

  useEffect(() => {
    fetchCount();
    // Otomatik güncelleme için interval ekleyebilirsin
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NotificationContext.Provider value={{ count, refresh: fetchCount }}>
      {children}
    </NotificationContext.Provider>
  );
};