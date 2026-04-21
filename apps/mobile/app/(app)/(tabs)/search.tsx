import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@/components/StatusBadge";

export default function SearchTab() {
  const [query, setQuery] = useState("");

  const { data, isFetching } = trpc.search.query.useQuery(
    { q: query },
    { enabled: query.trim().length >= 2 }
  );

  const threads = data?.threads ?? [];
  const messages = data?.messages ?? [];

  return (
    <View className="flex-1 bg-surface">
      <View className="px-4 pt-14 pb-3 border-b border-border">
        <Text className="text-2xl font-mono text-ink tracking-tight mb-3">Search</Text>
        <View className="flex-row items-center border border-border rounded-lg px-3 bg-white">
          <Text className="text-muted mr-2">🔍</Text>
          <TextInput
            className="flex-1 py-3 text-ink text-base"
            placeholder="Search threads and messages..."
            placeholderTextColor="#888780"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {isFetching && <ActivityIndicator color="#888780" size="small" />}
        </View>
      </View>

      <FlatList
        data={[
          ...(threads.length > 0 ? [{ type: "header", label: "Threads", id: "h-threads" }] : []),
          ...threads.map((t) => ({ type: "thread", ...t, id: `t-${t.id}` })),
          ...(messages.length > 0 ? [{ type: "header", label: "Messages", id: "h-messages" }] : []),
          ...messages.map((m) => ({ type: "message", ...m, id: `m-${m.id}` })),
        ]}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          query.trim().length >= 2 && !isFetching ? (
            <View className="items-center py-16">
              <Text className="text-muted text-base">No results for "{query}"</Text>
            </View>
          ) : query.trim().length < 2 ? (
            <View className="items-center py-16">
              <Text className="text-muted text-base">Type at least 2 characters to search</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (item.type === "header") {
            return (
              <View className="px-4 py-2 bg-surface border-b border-border">
                <Text className="text-xs text-muted uppercase tracking-wider font-medium">{(item as { label: string }).label}</Text>
              </View>
            );
          }
          if (item.type === "thread") {
            const t = item as { id: string; title: string; status: string; groupId: string; groupName: string };
            return (
              <Pressable
                onPress={() => router.push(`/(app)/thread/${t.id}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className="px-4 py-4 border-b border-border flex-row items-center justify-between"
              >
                <View className="flex-1 mr-3">
                  <Text className="text-ink text-base font-medium" numberOfLines={1}>{t.title.toLowerCase()}</Text>
                  <Text className="text-muted text-xs mt-0.5">{t.groupName.toLowerCase()}</Text>
                </View>
                <StatusBadge status={t.status as "OPEN" | "URGENT" | "DONE"} />
              </Pressable>
            );
          }
          if (item.type === "message") {
            const m = item as { id: string; body: string; threadId: string; threadTitle: string; groupName: string };
            return (
              <Pressable
                onPress={() => router.push(`/(app)/thread/${m.threadId}`)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                className="px-4 py-4 border-b border-border"
              >
                <Text className="text-muted text-xs mb-1">{m.groupName.toLowerCase()} › {m.threadTitle.toLowerCase()}</Text>
                <Text className="text-ink text-sm" numberOfLines={2}>{m.body}</Text>
              </Pressable>
            );
          }
          return null;
        }}
      />
    </View>
  );
}
