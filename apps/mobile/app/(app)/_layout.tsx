import { useEffect, useState } from "react";
import { router, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function AppLayout() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/(auth)/login");
      }
      setChecked(true);
    });
  }, []);

  if (!checked) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="group/[groupId]" options={{ headerShown: true, title: "" }} />
      <Stack.Screen name="thread/[threadId]" options={{ headerShown: true, title: "" }} />
    </Stack>
  );
}
