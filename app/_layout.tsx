import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NotificationProvider } from '@/components/NotificationContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <LanguageProvider>
      <NotificationProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <Stack>
              <Stack.Screen name="auth/index" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" options={{}} />
            </Stack>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </NotificationProvider>
    </LanguageProvider>
  );
}
