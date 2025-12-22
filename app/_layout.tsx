import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NotificationProvider } from '@/components/NotificationContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

// Sadece belirli logları ignore et, tüm logları değil
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

export default function RootLayout() {
  return (
    <LanguageProvider>
      <NotificationProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
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
