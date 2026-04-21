import { View, Text } from "react-native";

interface Reaction { type: string; count: number; userReacted: boolean; }
interface ReplyTo { id: string; body: string; author_name: string; }

interface Props {
  message: {
    id: string; body: string; created_at: string;
    edited_at?: string | null; is_deleted?: boolean;
    reactions?: Reaction[]; reply_to?: ReplyTo | null;
  };
  displayName: string;
  avatarUrl: string | null;
}

// Deterministic warm hue from name — mirrors the web app's avatar color logic
const AVATAR_PALETTE = [
  "#D4C5A9", "#C9B99A", "#BFB48A", "#D9C4A8", "#C4B49A",
  "#B8A88A", "#CDB99A", "#D2BFA0", "#C8B598", "#BDB090",
  "#D6C8A8", "#CAB99C", "#C0B08A", "#D4C2A0", "#CBB898",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, displayName }: Props) {
  const isDeleted = message.is_deleted;
  const bg = avatarColor(displayName);
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={{ width: 28, height: 28, backgroundColor: bg, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Text style={{ fontSize: 9, color: "#1A1A18", fontWeight: "600", fontFamily: "monospace" }}>{initials(displayName)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 3 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#1A1A18" }}>{displayName}</Text>
          <Text style={{ fontSize: 11, color: "#9A988F" }}>{formatTime(message.created_at)}</Text>
          {message.edited_at && <Text style={{ fontSize: 11, color: "#9A988F" }}>(edited)</Text>}
        </View>
        {message.reply_to && (
          <View style={{ borderLeftWidth: 2, borderLeftColor: "#E2DDD2", paddingLeft: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: 11, color: "#6B6A65", fontWeight: "600" }}>{message.reply_to.author_name}</Text>
            <Text style={{ fontSize: 11, color: "#6B6A65" }} numberOfLines={1}>{message.reply_to.body}</Text>
          </View>
        )}
        <Text
          style={{ fontSize: 14, color: isDeleted ? "#9A988F" : "#1A1A18", fontStyle: isDeleted ? "italic" : "normal", lineHeight: 20 }}
          selectable
        >
          {isDeleted ? "This message was deleted." : message.body}
        </Text>
        {!isDeleted && message.reactions && message.reactions.some((r) => r.count > 0) && (
          <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
            {message.reactions.filter((r) => r.count > 0).map((r) => (
              <View key={r.type} style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#E2DDD2", backgroundColor: "#F7F4ED" }}>
                <Text style={{ fontSize: 12 }}>{r.type}</Text>
                <Text style={{ fontSize: 11, color: "#6B6A65" }}>{r.count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
