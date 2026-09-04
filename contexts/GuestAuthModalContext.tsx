import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Modal, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from './LanguageContext';
import { useAppTheme } from './ThemeContext';
import { getLastNonAuthRoute } from '@/lib/lastNonAuthRoute';

const REDIRECT_DELAY_MS = 2500;
/** Misafirin "Başla"dan sonra geldiği ana sayfa; geri dönüş için varsayılan hedef. */
const GUEST_HOME_ROUTE = '/(tabs)?guest=1';


interface GuestAuthModalContextType {
  showGuestAuthAlert: (message: string) => void;
}

const GuestAuthModalContext = createContext<GuestAuthModalContextType | undefined>(undefined);

export function GuestAuthModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [origin, setOrigin] = useState<string>(GUEST_HOME_ROUTE);

  const showGuestAuthAlert = useCallback((msg: string) => {
    setMessage(msg);
    // Kökeni UYARI ANINDA sabitliyoruz. `lastNonAuthRoute` global bir değer ve
    // yönlendirmeye kadar geçen sürede başka bir gezinti onu ezebilir; sabitlemezsek
    // giriş ekranından geri dönüş yanlış sayfaya (ör. en başa) gidebiliyor.
    setOrigin(getLastNonAuthRoute() ?? GUEST_HOME_ROUTE);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const timeoutId = setTimeout(() => {
      setVisible(false);
      // Geri dönüş hedefini açıkça taşı: auth ekranı `from` parametresini önceliyor.
      router.push(`/auth?from=${encodeURIComponent(origin || GUEST_HOME_ROUTE)}` as any);
    }, REDIRECT_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [visible, router, origin]);

  return (
    <GuestAuthModalContext.Provider value={{ showGuestAuthAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 24,
              maxWidth: 320,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: colors.primaryDark,
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {message}
            </Text>
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 12,
                marginTop: 12,
              }}
            >
              {t('auth.guestRedirectNotice')}
            </Text>
          </View>
        </View>
      </Modal>
    </GuestAuthModalContext.Provider>
  );
}

export function useGuestAuthAlert() {
  const ctx = useContext(GuestAuthModalContext);
  if (!ctx) throw new Error('useGuestAuthAlert must be used within GuestAuthModalProvider');
  return ctx;
}
