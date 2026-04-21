import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { trpc } from "@/lib/trpc";

export default function GroupsTab() {
  const { data: groups, isLoading, refetch, isRefetching } = trpc.groups.list.useQuery();

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#1A1A18" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-14 pb-4 border-b border-border">
        <Text className="text-2xl font-mono text-ink tracking-tight">coldsoup</Text>
      </View>
      <FlatList
        data={groups ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        contentContainerStyle={groups?.length === 0 ? { flex: 1 } : undefined}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-muted text-center text-base">
              No groups yet. Ask your admin to add you to one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(app)/group/${item.id}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            className="flex-row items-center px-4 py-4 border-b border-border"
          >
            <View className="w-2 h-2 rounded-full bg-accent mr-3" />
            <Text className="text-ink text-base font-medium flex-1">{item.name.toLowerCase()}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
