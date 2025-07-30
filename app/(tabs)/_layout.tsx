import { Tabs, useNavigation, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomHeader from "@/components/CustomHeader";
import * as Haptics from 'expo-haptics';

export default function TabsLayout() {
  const navigation = useNavigation();
  const router = useRouter();
  const tabPressTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const tabPressCounts = useRef<Record<string, number>>({});

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", (e) => {
      const currentRoute = navigation.getState().routes[navigation.getState().index];
      const currentTab = currentRoute.name;
      const currentPath = currentRoute.path;

      // Eğer zaten bir timer varsa temizle
      if (tabPressTimers.current[currentTab]) {
        clearTimeout(tabPressTimers.current[currentTab]);
      }

      // Sayımı artır
      tabPressCounts.current[currentTab] = (tabPressCounts.current[currentTab] || 0) + 1;

      // Yeni bir timer başlat
      tabPressTimers.current[currentTab] = setTimeout(() => {
        tabPressCounts.current[currentTab] = 0;
      }, 300); // 300ms içinde ikinci basış algılanmazsa sıfırla

      // Eğer ikinci basış ise
      if (tabPressCounts.current[currentTab] === 2) {
        // Titreşim efekti ver
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        // Ana sayfaya dön
        if (currentTab === "index") {
          // Eğer zaten ana sayfada değilsek veya detay sayfasındaysak
          if (currentPath !== "/" && currentPath !== "/index") {
            router.replace("/");
          }
        } else {
          // Diğer tab'lar için de aynı mantık
          router.replace(`/${currentTab}`);
        }
        
        // Sayacı sıfırla
        tabPressCounts.current[currentTab] = 0;
      }
    });

    return unsubscribe;
  }, [navigation, router]);

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#f9f9f9" },
        tabBarActiveTintColor: "green",
        tabBarInactiveTintColor: "gray",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Find",
          headerTitle: () => <CustomHeader title="Ana Sayfa" />,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name="search-outline" color={focused ? color : color} size={focused ? 30 : 20} />
          ),
          unmountOnBlur: true, // <-- Bunu ekle!
        }}
      />
      <Tabs.Screen
        name="pitches"
        options={{
          tabBarLabel: "Pitches",
          headerTitle: () => <CustomHeader title="Sahalar" />,
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="navigate-circle-outline"
              color={focused ? "green" : "gray"}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          tabBarLabel: "Create",
          headerTitle: () => <CustomHeader title="Maç Oluştur" />,
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="add-circle-outline"
              color={focused ? "green" : color}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          tabBarLabel: "Messages",
          headerTitle: () => <CustomHeader title="Mesajlar" />,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="paper-plane-outline"
              color={focused ? "green" : color}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: "Profile",
          headerTitle: () => <CustomHeader title="Profil" />,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="person-circle-outline"
              color={focused ? "green" : color}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarLabel: "Notifications",
          headerTitle: () => <CustomHeader title="Bildirimler" />,
          href: null,
        }}
      />
    </Tabs>
  );
}