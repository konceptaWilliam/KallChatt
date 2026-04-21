import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { StatusControl } from "@/components/StatusControl";
import { MessageBubble } from "@/components/MessageBubble";
import { PollCard } from "@/components/PollCard";
import type { ThreadStatus } from "@coldsoup/core";

export default function ThreadScreen() {
  const { threadId, title } = useLocalSearchParams<{ threadId: string; title: string }>();
  const navigation = useNavigation();
  const flatListRef = useRef<FlatList>(null);
  const [body, setBody] = useState("");
  const utils = trpc.useUtils();

  useEffect(() => {
    if (title) {
      navigation.setOptions({ title: title.toLowerCase() });
    }
  }, [title, navigation]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.messages.list.useInfiniteQuery(
      { threadId, limit: 50 },
      {
        getNextPageParam: (lastPage) =>
          lastPage.hasMore ? lastPage.messages[0]?.created_at : undefined,
        initialCursor: undefined,
      }
    );

  const sendMessage = trpc.messages.send.useMutation({
    onMutate: async ({ body: msgBody }) => {
      const tempMsg = {
        id: `temp-${Date.now()}`,
        body: msgBody,
        created_at: new Date().toISOString(),
        edited_at: null,
        is_deleted: false,
        thread_id: threadId,
        user_id: "me",
        attachments: [],
        reply_to_id: null,
        poll_id: null,
        reply_to: null,
        poll: null,
        reactions: [],
        profiles: { id: "me", display_name: "You", avatar_url: null },
      };
      utils.messages.list.setInfiniteData({ threadId, limit: 50 }, (old) => {
        if (!old) return old;
        const newPages = [...old.pages];
        newPages[0] = {
          ...newPages[0],
          messages: [...newPages[0].messages, tempMsg],
        };
        return { ...old, pages: newPages };
      });
    },
    onSettled: () => utils.messages.list.invalidate({ threadId }),
  });

  const updateStatus = trpc.threads.updateStatus.useMutation();
  const [status, setStatus] = useState<ThreadStatus>("OPEN");

  const allMessages = data?.pages.flatMap((p) => p.messages) ?? [];

  useEffect(() => {
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        () => utils.messages.list.invalidate({ threadId })
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "threads", filter: `id=eq.${threadId}` },
        (payload) => {
          if (payload.new.status) setStatus(payload.new.status as ThreadStatus);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [threadId]);

  function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    sendMessage.mutate({ threadId, body: trimmed });
  }

  function handleStatusChange(newStatus: ThreadStatus) {
    setStatus(newStatus);
    updateStatus.mutate({ threadId, status: newStatus });
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F2EFE8", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#1A1A18" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F2EFE8" }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <StatusControl status={status} onChange={handleStatusChange} />

      <FlatList
        ref={flatListRef}
        data={allMessages}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={{ paddingVertical: 12 }}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          isFetchingNextPage ? <ActivityIndicator color="#888780" style={{ padding: 12 }} /> : null
        }
        renderItem={({ item }) => {
          if (item.poll) {
            return <PollCard poll={item.poll} messageId={item.id} />;
          }
          const profile = item.profiles as { id: string; display_name: string; avatar_url: string | null } | null;
          return (
            <MessageBubble
              message={item}
              displayName={profile?.display_name ?? "Unknown"}
              avatarUrl={profile?.avatar_url ?? null}
            />
          );
        }}
      />

      <View style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#E2DDD2", flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: "#F2EFE8" }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1, borderColor: "#E2DDD2", backgroundColor: "#F7F4ED", paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: "#1A1A18", maxHeight: 120 }}
          placeholder="Message..."
          placeholderTextColor="#6B6A65"
          value={body}
          onChangeText={setBody}
          multiline
          returnKeyType="default"
        />
        <Pressable
          onPress={handleSend}
          disabled={!body.trim()}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            backgroundColor: "#1A1A18",
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed || !body.trim() ? 0.4 : 1,
          })}
        >
          <Text style={{ color: "#F2EFE8", fontSize: 18, fontWeight: "600" }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
