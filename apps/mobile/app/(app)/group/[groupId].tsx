import { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@/components/StatusBadge";
import type { ThreadStatus } from "@coldsoup/core";

function formatRelative(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

type Thread = {
  id: string;
  title: string;
  status: ThreadStatus;
  updated_at: string;
  messages?: { body: string; is_deleted: boolean }[];
};

function sortThreads(threads: Thread[]): Thread[] {
  const urgent = threads.filter((t) => t.status === "URGENT").sort(byUpdated);
  const open = threads.filter((t) => t.status === "OPEN").sort(byUpdated);
  const done = threads.filter((t) => t.status === "DONE").sort(byUpdated);
  return [...urgent, ...open, ...done];
}

function byUpdated(a: Thread, b: Thread) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export default function GroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { data: threads, isLoading, refetch, isRefetching } = trpc.threads.list.useQuery({ groupId });
  const createThread = trpc.threads.create.useMutation({
    onSuccess: () => {
      refetch();
      bottomSheetRef.current?.close();
      setNewTitle("");
    },
  });

  const bottomSheetRef = useRef<BottomSheet>(null);
  const [newTitle, setNewTitle] = useState("");
  const snapPoints = ["40%"];

  const sorted = threads ? sortThreads(threads as Thread[]) : [];

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#1A1A18" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <Pressable
        onPress={() => bottomSheetRef.current?.expand()}
        className="absolute bottom-6 right-6 z-10 w-14 h-14 bg-ink rounded-full items-center justify-center"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Text className="text-surface text-2xl leading-none">+</Text>
      </Pressable>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-8 py-20">
            <Text className="text-muted text-center text-base">No threads yet. Tap + to start one.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const lastMsg = item.messages?.[0];
          const preview = lastMsg && !lastMsg.is_deleted ? lastMsg.body : "";
          const isUrgent = item.status === "URGENT";
          const isDone = item.status === "DONE";
          return (
            <Pressable
              onPress={() => router.push(`/(app)/thread/${item.id}`)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : isDone ? 0.4 : 1,
                borderLeftWidth: isUrgent ? 3 : 0,
                borderLeftColor: "#EF9F27",
              })}
              className="px-4 py-4 border-b border-border bg-surface flex-row items-start gap-3"
            >
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-ink text-base font-medium flex-1 mr-2" numberOfLines={1}>
                    {item.title.toLowerCase()}
                  </Text>
                  <Text className="text-muted text-xs">{formatRelative(item.updated_at)}</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-muted text-sm flex-1 mr-2" numberOfLines={1}>
                    {preview || " "}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: "#F7F6F2" }}
        handleIndicatorStyle={{ backgroundColor: "#E2E0D8" }}
      >
        <BottomSheetView className="px-4 pt-4 pb-8">
          <Text className="text-ink text-lg font-semibold mb-4">New thread</Text>
          <TextInput
            className="border border-border rounded-lg px-4 py-3 text-ink text-base mb-4 bg-white"
            placeholder="Thread title"
            placeholderTextColor="#888780"
            value={newTitle}
            onChangeText={setNewTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => {
              if (newTitle.trim()) createThread.mutate({ groupId, title: newTitle.trim() });
            }}
          />
          <Pressable
            onPress={() => {
              if (newTitle.trim()) createThread.mutate({ groupId, title: newTitle.trim() });
            }}
            disabled={!newTitle.trim() || createThread.isPending}
            className="bg-ink rounded-lg py-4 items-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            {createThread.isPending ? (
              <ActivityIndicator color="#F7F6F2" />
            ) : (
              <Text className="text-surface font-semibold text-base">Create</Text>
            )}
          </Pressable>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
