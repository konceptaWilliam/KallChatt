import { View, Text, Pressable } from "react-native";
import type { ThreadStatus } from "@coldsoup/core";

const options: { status: ThreadStatus; label: string }[] = [
  { status: "OPEN", label: "OPEN" },
  { status: "URGENT", label: "URGENT" },
  { status: "DONE", label: "DONE" },
];

const activeStyles: Record<ThreadStatus, { bg: string; text: string; border: string }> = {
  OPEN:   { bg: "#EAF5EF", text: "#2F5A43", border: "#8FBFA3" },
  URGENT: { bg: "#F6E6D4", text: "#8A4B1F", border: "#C79B6A" },
  DONE:   { bg: "#ECEBE4", text: "#5A5954", border: "#C7C5BC" },
};

interface Props {
  status: ThreadStatus;
  onChange: (s: ThreadStatus) => void;
}

export function StatusControl({ status, onChange }: Props) {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 6, borderBottomWidth: 1, borderBottomColor: "#E2DDD2", backgroundColor: "#F2EFE8" }}>
      {options.map((opt) => {
        const active = status === opt.status;
        const s = active ? activeStyles[opt.status] : null;
        return (
          <Pressable
            key={opt.status}
            onPress={() => onChange(opt.status)}
            style={{
              flex: 1,
              minHeight: 44,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 0,
              borderWidth: 1,
              borderColor: s?.border ?? "#E2DDD2",
              backgroundColor: s?.bg ?? "#F7F4ED",
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "600", color: s?.text ?? "#6B6A65", letterSpacing: 1.2, fontFamily: "monospace" }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
