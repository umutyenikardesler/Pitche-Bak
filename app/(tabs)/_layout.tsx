import { Tabs, useNavigation, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomHeader from "@/components/CustomHeader";
import * as Haptics from 'expo-haptics';
import { useLanguage } from "@/contexts/LanguageContext";
import { DeviceEventEmitter } from 'react-native';

export default function TabsLayout() {
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const tabPressTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const tabPressCounts = useRef<Record<string, number>>({});

  // CustomHeader başlık tıklaması için fonksiyon
  const handleTitlePress = () => {
    console.log('Tab layout CustomHeader başlığına tıklandı');
    // Modal'ları kapatmak için event gönder
    DeviceEventEmitter.emit('closeModals');
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress", (e) => {
      const currentRoute = navigation.getState().routes[navigation.getState().index];
      if (!currentRoute) return;
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
      }, 300) as unknown as NodeJS.Timeout; // 300ms içinde ikinci basış algılanmazsa sıfırla

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
          if (currentTab === 'create') {
            router.replace('/(tabs)/create');
          } else if (currentTab === 'pitches') {
            router.replace('/(tabs)/pitches');
          } else if (currentTab === 'message') {
            router.replace('/(tabs)/message');
          } else if (currentTab === 'profile') {
            router.replace('/(tabs)/profile');
          }
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
        tabBarStyle: { 
          backgroundColor: "#ffffff",
          borderTopWidth: 4,
          borderTopColor: "#16a34a"
        },
        tabBarActiveTintColor: "green",
        tabBarInactiveTintColor: "#444444",
        tabBarLabelStyle: { fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: t('home.findMatch'),
          headerTitle: () => <CustomHeader title={t('home.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name="search-outline" color={focused ? "green" : "#444444"} size={focused ? 30 : 20} />
          ),
        }}
      />
      <Tabs.Screen
        name="pitches"
        options={{
          tabBarLabel: t('pitches.title'),
          headerTitle: () => <CustomHeader title={t('pitches.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="navigate-circle-outline"
              color={focused ? "green" : "#444444"}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          tabBarLabel: t('create.title'),
          headerTitle: () => <CustomHeader title={t('create.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="add-circle-outline"
              color={focused ? "green" : "#444444"}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          tabBarLabel: t('messages.title'),
          headerTitle: () => <CustomHeader title={t('messages.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="paper-plane-outline"
              color={focused ? "green" : "#444444"}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: t('profile.title'),
          headerTitle: () => <CustomHeader title={t('profile.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="person-circle-outline"
              color={focused ? "green" : "#444444"}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarLabel: t('notifications.title'),
          headerTitle: () => <CustomHeader title={t('notifications.title')} onTitlePress={handleTitlePress} />,
          href: null,
        }}
      />
    </Tabs>
  );
}