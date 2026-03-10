import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";
import { supabase } from "@/services/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  analyticsInit,
  analyticsSetContext,
  analyticsSetTraits,
  analyticsSetUser,
  analyticsTrack,
} from "@/services/analytics";

function ageToRange(age: unknown): string | null {
  const n = typeof age === "number" ? age : Number(age);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 18) return "0-17";
  if (n <= 24) return "18-24";
  if (n <= 34) return "25-34";
  if (n <= 44) return "35-44";
  if (n <= 54) return "45-54";
  if (n <= 64) return "55-64";
  return "65+";
}

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const { currentLanguage } = useLanguage();
  const lastScreenRef = useRef<string | null>(null);

  // Init once + bind auth user
  useEffect(() => {
    let mounted = true;

    (async () => {
      await analyticsInit();

      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        const uid = data?.user?.id ?? null;
        analyticsSetUser(uid);

        // Pull demographics (currently only age exists in your users table)
        if (uid) {
          const { data: u } = await supabase
            .from("users")
            .select("age")
            .eq("id", uid)
            .maybeSingle();
          const ageRange = ageToRange((u as any)?.age);
          analyticsSetTraits({
            age: (u as any)?.age ?? null,
            age_range: ageRange,
          });
        }
      } catch {
        // ignore
      }

      // app_open once per app session
      await analyticsTrack("app_open", {});
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null;
      analyticsSetUser(uid);
      if (uid) {
        void supabase
          .from("users")
          .select("age")
          .eq("id", uid)
          .maybeSingle()
          .then(({ data: u }) => {
            const ageRange = ageToRange((u as any)?.age);
            analyticsSetTraits({
              age: (u as any)?.age ?? null,
              age_range: ageRange,
            });
          });
      }
      void analyticsTrack(uid ? "sign_in" : "sign_out", {});
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // Update context whenever language changes
  useEffect(() => {
    analyticsSetContext({ language: currentLanguage });
  }, [currentLanguage]);

  // Track screen views
  useEffect(() => {
    const screen = pathname || "/";
    if (lastScreenRef.current === screen) return;
    lastScreenRef.current = screen;
    void analyticsTrack("screen_view", { screen });
  }, [pathname]);

  return null;
}

