import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#F7F6F2", borderTopColor: "#E2E0D8" },
        tabBarActiveTintColor: "#1A1A18",
        tabBarInactiveTintColor: "#888780",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Groups",
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Groups</Text>,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Search</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 11 }}>Settings</Text>,
        }}
      />
    </Tabs>
  );
}
