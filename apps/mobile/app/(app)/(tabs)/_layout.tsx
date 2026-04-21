import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#F2EFE8", borderTopColor: "#E2DDD2", borderTopWidth: 1 },
        tabBarActiveTintColor: "#1A1A18",
        tabBarInactiveTintColor: "#6B6A65",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Groups",
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 10, fontFamily: "monospace" }}>Groups</Text>,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 10, fontFamily: "monospace" }}>Search</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: ({ color }) => <Text style={{ color, fontSize: 10, fontFamily: "monospace" }}>Settings</Text>,
        }}
      />
    </Tabs>
  );
}
