import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, type Language } from './translations';

// Çeviri sözlükleri contexts/translations/ altında (tr.ts / en.ts).
export type { Language, TranslationKey } from './translations';

const STORAGE_KEY = 'selectedLanguage';

// Dil context interface'i
interface LanguageContextType {
  currentLanguage: Language;
  changeLanguage: (language: Language) => Promise<void>;
  t: (key: string) => string; // Çeviri fonksiyonu
}

// Dil context'i oluştur
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const isLanguage = (value: unknown): value is Language => value === 'tr' || value === 'en';

// Dil context provider
export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('tr');

  // Uygulama başladığında kaydedilen dili yükle
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  // Kaydedilen dili yükle
  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(STORAGE_KEY);
      if (isLanguage(savedLanguage)) {
        setCurrentLanguage(savedLanguage);
      }
    } catch (error) {
      // Sessizce varsayılan dilde kal
      console.log('Dil yüklenirken hata (varsayılan kullanılacak):', error);
    }
  };

  // Dili değiştir
  const changeLanguage = async (language: Language) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, language);
      setCurrentLanguage(language);
    } catch (error) {
      console.error('Dil değiştirilirken hata:', error);
      throw error;
    }
  };

  // Çeviri fonksiyonu
  const t = (key: string): string => {
    const translation = translations[currentLanguage][key];
    if (!translation) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
    return translation;
  };

  const value: LanguageContextType = {
    currentLanguage,
    changeLanguage,
    t,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Dil context hook'u
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
