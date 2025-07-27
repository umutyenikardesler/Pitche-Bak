import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { NotificationProvider } from '@/components/NotificationContext';

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <NotificationProvider>
      <Stack>
        <Stack.Screen name="auth/index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{}} />
      </Stack>
    </NotificationProvider>
  );
}
