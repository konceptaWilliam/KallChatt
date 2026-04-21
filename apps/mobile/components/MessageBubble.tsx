import { View, Text } from "react-native";

interface Reaction {
  type: string;
  count: number;
  userReacted: boolean;
}

interface ReplyTo {
  id: string;
  body: string;
  author_name: string;
}

interface MessageBubbleProps {
  message: {
    id: string;
    body: string;
    created_at: string;
    edited_at?: string | null;
    is_deleted?: boolean;
    reactions?: Reaction[];
    reply_to?: ReplyTo | null;
  };
  displayName: string;
  avatarUrl: string | null;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, displayName, avatarUrl }: MessageBubbleProps) {
  const isDeleted = message.is_deleted;

  return (
    <View className="px-4 py-3 flex-row items-start gap-3">
      <View className="w-8 h-8 rounded-full bg-border items-center justify-center flex-shrink-0">
        <Text className="text-xs text-muted font-semibold">{initials(displayName)}</Text>
      </View>
      <View className="flex-1">
        <View className="flex-row items-baseline gap-2 mb-1">
          <Text className="text-ink text-sm font-semibold">{displayName}</Text>
          <Text className="text-muted text-xs">{formatTime(message.created_at)}</Text>
          {message.edited_at && <Text className="text-muted text-xs">(edited)</Text>}
        </View>
        {message.reply_to && (
          <View className="border-l-2 border-border pl-2 mb-2">
            <Text className="text-muted text-xs font-medium">{message.reply_to.author_name}</Text>
            <Text className="text-muted text-xs" numberOfLines={1}>{message.reply_to.body}</Text>
          </View>
        )}
        <Text
          className="text-ink text-base"
          style={{ opacity: isDeleted ? 0.4 : 1, overflow: "hidden" }}
          selectable
        >
          {isDeleted ? "This message was deleted." : message.body}
        </Text>
        {!isDeleted && message.reactions && message.reactions.some((r) => r.count > 0) && (
          <View className="flex-row gap-2 mt-2">
            {message.reactions
              .filter((r) => r.count > 0)
              .map((r) => (
                <View
                  key={r.type}
                  className="flex-row items-center gap-1 px-2 py-0.5 rounded-full border border-border bg-white"
                >
                  <Text className="text-sm">{r.type}</Text>
                  <Text className="text-muted text-xs">{r.count}</Text>
                </View>
              ))}
          </View>
        )}
      </View>
    </View>
  );
}
