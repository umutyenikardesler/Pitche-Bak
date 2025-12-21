import { Stack } from "expo-router";
import { LogBox, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NotificationProvider } from '@/components/NotificationContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useEffect, useState } from "react";

// Sadece belirli logları ignore et, tüm logları değil
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

export default function RootLayout() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("RootLayout mounted");
  }, []);

  // Error boundary benzeri yapı
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ff0000' }}>
        <Text style={{ color: '#fff', fontSize: 18 }}>Layout Error: {error}</Text>
      </View>
    );
  }

  try {
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
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    console.error("RootLayout render error:", errorMessage);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ff0000' }}>
        <Text style={{ color: '#fff', fontSize: 18 }}>Render Error: {errorMessage}</Text>
      </View>
    );
  }
}
