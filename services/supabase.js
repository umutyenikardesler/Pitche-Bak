import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fqcjmrcnvrtqcytweyce.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxY2ptcmNudnJ0cWN5dHdleWNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg0MjgzNTEsImV4cCI6MjA1NDAwNDM1MX0.wikCIj1tRlJuF7NDRn913fWdq1riabtmUGUxNOezFVM';

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Expo Router web SSR (node render) sırasında window yok => AsyncStorage import edemeyiz.
// Bu yüzden storage'ı platforma göre runtime'da seçiyoruz.
function createStorage() {
  if (isBrowser) {
    return {
      getItem: async (key) => window.localStorage.getItem(key),
      setItem: async (key, value) => {
        window.localStorage.setItem(key, value);
      },
      removeItem: async (key) => {
        window.localStorage.removeItem(key);
      },
    };
  }

  // Native mi? (SSR değilse ve Platform web değilse) => AsyncStorage kullan
  try {
    const { Platform } = require('react-native');
    if (Platform?.OS && Platform.OS !== 'web') {
      const mod = require('@react-native-async-storage/async-storage');
      return mod?.default ?? mod;
    }
  } catch (e) {
    // ignore
  }

  // SSR fallback: in-memory storage (persistSession kapalı olacak)
  const mem = new Map();
  return {
    getItem: async (key) => (mem.has(key) ? mem.get(key) : null),
    setItem: async (key, value) => {
      mem.set(key, value);
    },
    removeItem: async (key) => {
      mem.delete(key);
    },
  };
}

const storage = createStorage();
const enableSession = !(!isBrowser && typeof window === 'undefined'); // browser or native runtime => true, SSR => false

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage,
    autoRefreshToken: enableSession,
    persistSession: enableSession,
    detectSessionInUrl: isBrowser,
  },
});