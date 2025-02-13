import { Tabs } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

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
          tabBarLabel: "Find",
          // tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons 
              name="search-outline" 
              color={focused ? color : color} 
              size={focused ? 30 : 20} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pitches"
        options={{
          title: "Sahalar",
          tabBarLabel: "Pitches",
          // tabBarShowLabel: false,
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
          tabBarLabel: "Create",
          // tabBarShowLabel: false,
          tabBarIcon: ({ focused, color }) => (
            <MaterialIcons
              name="add-circle-outline"
              color={focused ? "green" : color }
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
          // tabBarShowLabel: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="notifications-circle-outline"
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
          tabBarLabel: "Profile",
          // tabBarShowLabel: false,
          tabBarIcon: ({ focused, color }) => (
            <Ionicons
              name="person-circle-outline"
              color={focused ? "green" : color}
              size={focused ? 30 : 20}
            />
          ),
        }}
      />
    </Tabs>
  );
}