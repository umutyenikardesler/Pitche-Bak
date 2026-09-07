import GuestLanding from "@/components/guest/GuestLanding";
import { useRouter } from "expo-router";

export default function GuestLandingTabScreen() {
  const router = useRouter();

  return (
    <GuestLanding
      onContinue={() => {
        router.replace("/(tabs)?guest=1" as any);
      }}
    />
  );
}

