import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

export default function SettingsTab() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => utils.profile.get.invalidate(),
  });
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  function startEdit() {
    setName(profile?.display_name ?? "");
    setEditingName(true);
  }

  function saveName() {
    if (!name.trim()) return;
    updateProfile.mutate({ displayName: name.trim() });
    setEditingName(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/(auth)/login");
  }

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#1A1A18" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-surface">
      <View className="px-4 pt-14 pb-4 border-b border-border">
        <Text className="text-2xl font-mono text-ink tracking-tight">Settings</Text>
      </View>

      <View className="px-4 py-6 gap-6">
        <View>
          <Text className="text-xs text-muted uppercase tracking-wider mb-2">Display name</Text>
          {editingName ? (
            <View className="flex-row items-center gap-3">
              <TextInput
                className="flex-1 border border-border rounded-lg px-3 py-2 text-ink text-base bg-white"
                value={name}
                onChangeText={setName}
                autoFocus
                onBlur={saveName}
                onSubmitEditing={saveName}
                returnKeyType="done"
              />
              <Pressable onPress={saveName} className="px-3 py-2">
                <Text className="text-ink font-medium">Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={startEdit}>
              <Text className="text-ink text-base">{profile?.display_name ?? "—"}</Text>
              <Text className="text-muted text-xs mt-1">Tap to edit</Text>
            </Pressable>
          )}
        </View>

        <View>
          <Text className="text-xs text-muted uppercase tracking-wider mb-2">Email</Text>
          <Text className="text-ink text-base">{profile?.email ?? "—"}</Text>
        </View>

        <View className="border-t border-border pt-6">
          <Pressable
            onPress={() => Alert.alert("Sign out", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: handleSignOut },
            ])}
            className="bg-ink rounded-lg py-4 items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-surface font-semibold text-base">Sign out</Text>
          </Pressable>
        </View>

        <Text className="text-muted text-xs text-center">
          v{Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
      </View>
    </ScrollView>
  );
}
