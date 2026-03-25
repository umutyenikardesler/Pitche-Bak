import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/services/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isGuest: boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        // Eğer refresh token hatası alırsak (geçersiz veya silinmişse), oturumu yerelde temizle
        if (error.message.includes("Refresh Token") || error.status === 400 || error.status === 401) {
          console.log("Geçersiz refresh token, oturum temizleniyor...");
          await supabase.auth.signOut();
        }
        setUser(null);
      } else {
        setUser(data.user ?? null);
      }
    } catch (e) {
      console.error("Auth refresh exception:", e);
      setUser(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    refresh().finally(() => {
      if (mounted) setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      // TOKEN_REFRESH_FAILED gibi durumlarda setUser(null) yap
      if (event === 'SIGNED_OUT' || (event as any) === 'TOKEN_REFRESH_FAILED') {
        setUser(null);
      } else {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isGuest: !user,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
