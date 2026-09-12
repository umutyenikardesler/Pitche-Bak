import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Modal, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from './LanguageContext';
import { useAppTheme } from './ThemeContext';
import { getLastNonAuthRoute } from '@/lib/lastNonAuthRoute';
import { useAuth } from './AuthContext';
import { isAuthCallbackLocked } from '@/lib/authCallbackLock';

const REDIRECT_DELAY_MS = 2500;
/** Misafirin "Başla"dan sonra geldiği ana sayfa; geri dönüş için varsayılan hedef. */
const GUEST_HOME_ROUTE = '/(tabs)?guest=1';


interface GuestAuthModalContextType {
  showGuestAuthAlert: (message: string) => void;
}

const GuestAuthModalContext = createContext<GuestAuthModalContextType | undefined>(undefined);

export function GuestAuthModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [origin, setOrigin] = useState<string>(GUEST_HOME_ROUTE);

  const showGuestAuthAlert = useCallback((msg: string) => {
    // OAuth akışı sürerken uyarı GÖSTERİLMEZ. Google girişinden dönerken oturum
    // birkaç yüz ms içinde kuruluyor; o aralıkta odaklanan korumalı bir ekran
    // (ör. bildirim dokunuşuyla açılan bildirimler sayfası) kullanıcıyı henüz
    // misafir sanıp uyarıyı basıyor ve ardından giriş ekranına atıyordu.
    if (isAuthCallbackLocked()) return;

    setMessage(msg);
    // Kökeni UYARI ANINDA sabitliyoruz. `lastNonAuthRoute` global bir değer ve
    // yönlendirmeye kadar geçen sürede başka bir gezinti onu ezebilir; sabitlemezsek
    // giriş ekranından geri dönüş yanlış sayfaya (ör. en başa) gidebiliyor.
    setOrigin(getLastNonAuthRoute() ?? GUEST_HOME_ROUTE);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Uyarı GECİKMELİ yönlendirme yapıyor. Bu arada kullanıcı giriş yapmış
    // olabilir: özellikle Google akışında uyarı, oturum kurulmadan hemen önce
    // tetikleniyor ve 2.5 sn sonraki yönlendirme başarılı girişi ezip kullanıcıyı
    // giriş ekranına geri atıyordu. Artık giriş yapılmışsa uyarı sessizce
    // kapanıyor, yönlendirme hiç olmuyor.
    if (user) {
      setVisible(false);
      return;
    }

    const timeoutId = setTimeout(() => {
      setVisible(false);
      // Geri dönüş hedefini açıkça taşı: auth ekranı `from` parametresini önceliyor.
      router.push(`/auth?from=${encodeURIComponent(origin || GUEST_HOME_ROUTE)}` as any);
    }, REDIRECT_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [visible, user, router, origin]);

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
