import { View, Text } from "react-native";
import type { ThreadStatus } from "@coldsoup/core";

const styles: Record<ThreadStatus, { bg: string; text: string; border: string; label: string }> = {
  OPEN: { bg: "#E6F1FB", text: "#0C447C", border: "#85B7EB", label: "open" },
  URGENT: { bg: "#FAEEDA", text: "#633806", border: "#EF9F27", label: "urgent" },
  DONE: { bg: "#EAF3DE", text: "#27500A", border: "#97C459", label: "done" },
};

export function StatusBadge({ status }: { status: ThreadStatus }) {
  const s = styles[status];
  return (
    <View
      style={{
        backgroundColor: s.bg,
        borderColor: s.border,
        borderWidth: 1,
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: s.text, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>
        {s.label}
      </Text>
    </View>
  );
}
