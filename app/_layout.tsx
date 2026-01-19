import '@/global.css';
import { Stack } from "expo-router";
import { LogBox, Platform, View } from "react-native";
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
            {Platform.OS === 'web' ? (
              <View style={{ flex: 1, backgroundColor: '#f3f4f6', alignItems: 'center' }}>
                <View
                  style={{
                    flex: 1,
                    width: '50%',
                    minWidth: 360,
                    maxWidth: 520,
                    backgroundColor: '#ffffff',
                    overflow: 'hidden',
                    borderLeftWidth: 1,
                    borderRightWidth: 1,
                    borderColor: '#e5e7eb',
                  }}
                >
                  <Stack screenOptions={{ headerShown: false }} />
                </View>
              </View>
            ) : (
              <Stack screenOptions={{ headerShown: false }} />
            )}
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </NotificationProvider>
    </LanguageProvider>
  );
}
