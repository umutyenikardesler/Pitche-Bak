import { View } from "react-native";
import '@/global.css';
import { Link, Stack } from "expo-router";

export default function NotFoundScreen() {
    return (
        <>
            <Stack.Screen options={{ title: "Opps! Not Found Page" }} />
            <View className="flex-1 justify-center items-center bg-cyan-950">
                <Link href="/" className="underline text-white">Go back to Home Screen</Link>
            </View>
        </>
    );
  }