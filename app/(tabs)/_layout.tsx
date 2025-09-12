import { Tabs, useNavigation, useRouter } from "expo-router";
import { useRef } from "react";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomHeader from "@/components/CustomHeader";
import * as Haptics from 'expo-haptics';
import { useLanguage } from "@/contexts/LanguageContext";
import { DeviceEventEmitter, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const navigation = useNavigation();
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const tabPressTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const tabPressCounts = useRef<Record<string, number>>({});

  // CustomHeader başlık tıklaması için fonksiyon
  const handleTitlePress = () => {
    console.log('Tab layout CustomHeader başlığına tıklandı');
    // Modal'ları kapatmak için event gönder
    DeviceEventEmitter.emit('closeModals');
  };

  // Tab bar stilleri
  const tabBarStyles = StyleSheet.create({
    tabBar: {
      backgroundColor: "#ffffff",
      height: Platform.OS === 'ios' ? 52 + insets.bottom : 120,
      paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 8) : 68,
      paddingTop: 8,
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4
    },
    tabBarBg: {
      flex: 1,
      backgroundColor: '#ffffff'
    },
    tabBarTopLine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: '#16a34a'
    },
    tabBarLabel: {
      fontWeight: "700",
      fontSize: 10.5,
      marginTop: 2,
      letterSpacing: 0.2
    },
    tabBarItem: {
      paddingVertical: 2,
      paddingHorizontal: 0,
      minWidth: 0,
      marginHorizontal: 0
    }
  });

  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          tabBarActiveTintColor: "#059669",
          tabBarInactiveTintColor: "#374151",
          tabBarStyle: tabBarStyles.tabBar,
          tabBarItemStyle: tabBarStyles.tabBarItem,
          tabBarBackground: () => (
            <View style={tabBarStyles.tabBarBg} pointerEvents="none">
              <View style={tabBarStyles.tabBarTopLine} />
            </View>
          ),
          tabBarLabel: t('home.findMatch'),
          tabBarLabelStyle: [tabBarStyles.tabBarLabel, { marginTop: 4 }],
          headerTitle: () => <CustomHeader title={t('home.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name="search-outline" color={color as string} size={focused ? 28 : 22} style={{ marginTop: 2 }} />
          ),
        }}
      />
      <Tabs.Screen
        name="pitches"
        options={{
          tabBarActiveTintColor: "#059669",
          tabBarInactiveTintColor: "#374151",
          tabBarStyle: tabBarStyles.tabBar,
          tabBarItemStyle: tabBarStyles.tabBarItem,
          tabBarBackground: () => (
            <View style={tabBarStyles.tabBarBg} pointerEvents="none">
              <View style={tabBarStyles.tabBarTopLine} />
            </View>
          ),
          tabBarLabel: t('pitches.title'),
          tabBarLabelStyle: [tabBarStyles.tabBarLabel, { marginTop: 4 }],
          headerTitle: () => <CustomHeader title={t('pitches.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="navigate-circle-outline"
              color={color as string}
              size={focused ? 28 : 22}
              style={{ marginTop: 2 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          tabBarActiveTintColor: "#059669",
          tabBarInactiveTintColor: "#374151",
          tabBarStyle: tabBarStyles.tabBar,
          tabBarItemStyle: tabBarStyles.tabBarItem,
          tabBarBackground: () => (
            <View style={tabBarStyles.tabBarBg} pointerEvents="none">
              <View style={tabBarStyles.tabBarTopLine} />
            </View>
          ),
          tabBarLabel: t('create.title'),
          tabBarLabelStyle: [tabBarStyles.tabBarLabel, { marginTop: 4 }],
          headerTitle: () => <CustomHeader title={t('create.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="add-circle-outline"
              color={color as string}
              size={focused ? 28 : 22}
              style={{ marginTop: 2 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          tabBarActiveTintColor: "#059669",
          tabBarInactiveTintColor: "#374151",
          tabBarStyle: tabBarStyles.tabBar,
          tabBarItemStyle: tabBarStyles.tabBarItem,
          tabBarBackground: () => (
            <View style={tabBarStyles.tabBarBg} pointerEvents="none">
              <View style={tabBarStyles.tabBarTopLine} />
            </View>
          ),
          tabBarLabel: t('messages.title'),
          tabBarLabelStyle: [tabBarStyles.tabBarLabel, { marginTop: 4 }],
          headerTitle: () => <CustomHeader title={t('messages.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="paper-plane-outline"
              color={color as string}
              size={focused ? 28 : 22}
              style={{ marginTop: 2 }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarActiveTintColor: "#059669",
          tabBarInactiveTintColor: "#374151",
          tabBarStyle: tabBarStyles.tabBar,
          tabBarItemStyle: tabBarStyles.tabBarItem,
          tabBarBackground: () => (
            <View style={tabBarStyles.tabBarBg} pointerEvents="none">
              <View style={tabBarStyles.tabBarTopLine} />
            </View>
          ),
          tabBarLabel: t('profile.title'),
          tabBarLabelStyle: [tabBarStyles.tabBarLabel, { marginTop: 4 }],
          headerTitle: () => <CustomHeader title={t('profile.title')} onTitlePress={handleTitlePress} />,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="person-circle-outline"
              color={color as string}
              size={focused ? 28 : 22}
              style={{ marginTop: 2 }}
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