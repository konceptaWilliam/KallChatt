import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { trpc } from "@/lib/trpc";
import type { Poll } from "@coldsoup/core";

interface PollCardProps {
  poll: Poll;
  messageId: string;
}

export function PollCard({ poll, messageId }: PollCardProps) {
  const utils = trpc.useUtils();
  const voteMutation = trpc.polls.vote.useMutation({
    onSuccess: () => utils.messages.list.invalidate(),
  });
  const addOption = trpc.polls.addOption.useMutation({
    onSuccess: () => utils.messages.list.invalidate(),
  });

  const totalVotes = poll.options.reduce((sum, o) => sum + o.vote_count, 0);

  return (
    <View className="mx-4 my-2 border border-border rounded-xl p-4 bg-white">
      <Text className="text-ink text-base font-semibold mb-3">{poll.question}</Text>
      {poll.options.map((option) => {
        const pct = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
        return (
          <Pressable
            key={option.id}
            onPress={() => voteMutation.mutate({ pollOptionId: option.id })}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            className="mb-2"
          >
            <View className="relative border border-border rounded-lg overflow-hidden h-10">
              <View
                style={{ width: `${pct}%`, backgroundColor: option.user_voted ? "#E6F1FB" : "#F7F6F2" }}
                className="absolute inset-0 h-full"
              />
              <View className="absolute inset-0 flex-row items-center justify-between px-3">
                <Text
                  className="text-ink text-sm flex-1 mr-2"
                  numberOfLines={1}
                  style={{ fontWeight: option.user_voted ? "600" : "400" }}
                >
                  {option.text}
                </Text>
                <Text className="text-muted text-xs">{pct}%</Text>
              </View>
            </View>
          </Pressable>
        );
      })}
      <Text className="text-muted text-xs mt-2">{totalVotes} vote{totalVotes !== 1 ? "s" : ""}</Text>
    </View>
  );
}
