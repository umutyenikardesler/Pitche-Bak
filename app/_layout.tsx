import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { NotificationProvider } from '@/components/NotificationContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <LanguageProvider>
      <NotificationProvider>
        <Stack>
          <Stack.Screen name="auth/index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{}} />
        </Stack>
      </NotificationProvider>
    </LanguageProvider>
  );
}
