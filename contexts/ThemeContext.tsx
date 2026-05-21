import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = "light" | "dark";

type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryDark: string;
  icon: string;
  inputBackground: string;
  inputBorder: string;
  overlay: string;
  danger: string;
  whiteText: string;
};

type ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  colors: ThemeColors;
  setThemePreference: (value: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
};

const STORAGE_KEY = "app_theme_preference";

const lightColors: ThemeColors = {
  background: "#f3f4f6",
  surface: "#ffffff",
  surfaceAlt: "#f3f4f6",
  card: "#f3f4f6",
  text: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  primary: "#16a34a",
  primaryDark: "#15803d",
  icon: "#111827",
  inputBackground: "#f3f4f6",
  inputBorder: "#d1d5db",
  overlay: "rgba(0,0,0,0.5)",
  danger: "#dc2626",
  whiteText: "#ffffff",
};

const darkColors: ThemeColors = {
  background: "#000000",
  surface: "#111827",
  surfaceAlt: "#1f2937",
  card: "#111827",
  text: "#ffffff",
  textSecondary: "#e5e7eb",
  textMuted: "#9ca3af",
  border: "#374151",
  primary: "#16a34a",
  primaryDark: "#15803d",
  icon: "#ffffff",
  inputBackground: "#1f2937",
  inputBorder: "#4b5563",
  overlay: "rgba(0,0,0,0.72)",
  danger: "#ef4444",
  whiteText: "#ffffff",
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!isMounted) return;
        if (stored === "light" || stored === "dark" || stored === "system") {
          setThemePreferenceState(stored);
        }
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedTheme: ResolvedTheme =
    themePreference === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : themePreference;

  const setThemePreference = async (value: ThemePreference) => {
    setThemePreferenceState(value);
    await AsyncStorage.setItem(STORAGE_KEY, value);
  };

  const toggleTheme = async () => {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
    await setThemePreference(nextTheme);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      themePreference,
      resolvedTheme,
      isDark: resolvedTheme === "dark",
      colors: resolvedTheme === "dark" ? darkColors : lightColors,
      setThemePreference,
      toggleTheme,
    }),
    [resolvedTheme, themePreference]
  );

  if (!isLoaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProvider");
  }
  return context;
}
