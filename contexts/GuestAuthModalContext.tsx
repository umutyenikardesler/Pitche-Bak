import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Modal, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from './LanguageContext';

const REDIRECT_DELAY_MS = 2500;

interface GuestAuthModalContextType {
  showGuestAuthAlert: (message: string) => void;
}

const GuestAuthModalContext = createContext<GuestAuthModalContextType | undefined>(undefined);

export function GuestAuthModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');

  const showGuestAuthAlert = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const timeoutId = setTimeout(() => {
      setVisible(false);
      router.push('/auth');
    }, REDIRECT_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [visible, router]);

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
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 16,
              padding: 24,
              maxWidth: 320,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#15803d',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {message}
            </Text>
            <Text
              style={{
                color: '#6b7280',
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
