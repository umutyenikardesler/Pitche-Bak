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
        /**
         * "Oturum yok" bir HATA DEĞİL, misafirin normal durumudur. Eskiden her
         * 400/401 için signOut() çağrılıyordu; oturumsuz açılışta getUser()
         * zaten AuthSessionMissingError (400) döndüğü için uygulama her soğuk
         * başlangıçta kendi kendine sahte bir SIGNED_OUT olayı üretiyordu. Bu
         * olay isGuest'i tetikleyip korumalı ekranlarda gereksiz yönlendirmelere
         * yol açıyordu. Artık yalnızca gerçekten bozuk bir refresh token varsa
         * yerel oturum temizleniyor.
         */
        const isMissingSession =
          (error as any)?.code === 'session_missing' ||
          error.name === 'AuthSessionMissingError' ||
          error.message.includes('Auth session missing');
        const isBadRefreshToken =
          error.message.includes('Refresh Token') || error.message.includes('refresh_token');

        if (!isMissingSession && (isBadRefreshToken || error.status === 401)) {
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
        /**
         * "Misafir" = kullanıcı OLMADIĞINI BİLİYORUZ demektir; "henüz
         * bilmiyoruz" demek değil.
         *
         * Eskiden `!user` idi ve `user` başlangıçta null olduğu için oturum
         * bilgisi yüklenirken herkes misafir sayılıyordu. Bu sırada odaklanan
         * korumalı ekranlar (bildirimler, profil, mesajlar...) "giriş sayfasına
         * yönlendiriliyorsunuz" uyarısını gösterip kullanıcıyı giriş ekranına
         * atıyordu — özellikle deep link ile soğuk açılışta, yani Google
         * girişinden hemen sonra.
         *
         * Hiçbir tüketici `isLoading`'i kontrol etmiyordu; kuralı tek yerde
         * düzeltmek hepsini birden kapsıyor.
         */
        isGuest: !isLoading && !user,
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
