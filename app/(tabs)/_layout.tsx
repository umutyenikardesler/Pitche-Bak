import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CustomHeader from "@/components/CustomHeader"; // Özel başlık bileşenini import et

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#f9f9f9" }, // Genel stil
        tabBarActiveTintColor: "green", // Aktif sekme genel rengi
        tabBarInactiveTintColor: "gray", // Pasif sekme genel rengi
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          headerTitleAlign: "left",
          tabBarLabel: "Find",
          // tabBarShowLabel: false,
          headerLeft: () => <View className="pl-2" />, // Boş bir `View` ekleyerek title'ın sola yaslanmasını sağla
          headerRight: () => <CustomHeader />, // Özel başlığı sağa ekle
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name="search-outline" color={focused ? color : color} size={focused ? 30 : 20} />
          ),
        }}
      />
      <Tabs.Screen
        name="pitches"
        options={{
          title: "Sahalar",
          headerTitleAlign: "left",
          tabBarLabel: "Pitches",
          // tabBarShowLabel: false,
          headerLeft: () => <View className="pl-2" />, // Boş bir `View` ekleyerek title'ın sola yaslanmasını sağla
          headerRight: () => <CustomHeader />, // Özel başlığı sağa ekle
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
          title: "Maç Oluştur",
          headerTitleAlign: "left",
          tabBarLabel: "Create",
          // tabBarShowLabel: false,
          headerLeft: () => <View className="pl-2" />, // Boş bir `View` ekleyerek title'ın sola yaslanmasını sağla
          headerRight: () => <CustomHeader />, // Özel başlığı sağa ekle
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="add-circle-outline"
              color={focused ? "green" : color}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
      {/* <Tabs.Screen
        name="notifications"
        options={{
          title: "Bildirimler",
          tabBarLabel: "Notifications",
          // tabBarShowLabel: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="heart-outline"
              color={focused ? "green" : color}
              size={focused ? 30 : 20}
            />
          ),
        }}
      /> */}
      <Tabs.Screen
        name="message"
        options={{
          title: "Mesajlar",
          headerTitleAlign: "left",
          tabBarLabel: "Messages",
          // tabBarShowLabel: false,
          headerLeft: () => <View className="pl-2" />, // Boş bir `View` ekleyerek title'ın sola yaslanmasını sağla
          headerRight: () => <CustomHeader />, // Özel başlığı sağa ekle
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
          title: "Profil",
          headerTitleAlign: "left",
          tabBarLabel: "Profile",
          // tabBarShowLabel: false,
          headerLeft: () => <View className="pl-2" />, // Boş bir `View` ekleyerek title'ın sola yaslanmasını sağla
          headerRight: () => <CustomHeader />, // Özel başlığı sağa ekle
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
          title: "Bildirimler",
          tabBarLabel: "Notifications",
          href: null, // Tab bar'da gösterme
        }}
      />
    </Tabs>
  );
}

