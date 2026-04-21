import { View, Text, Pressable } from "react-native";
import type { ThreadStatus } from "@coldsoup/core";

const options: { status: ThreadStatus; label: string }[] = [
  { status: "OPEN", label: "OPEN" },
  { status: "URGENT", label: "URGENT" },
  { status: "DONE", label: "DONE" },
];

const activeStyles: Record<ThreadStatus, { bg: string; text: string }> = {
  OPEN: { bg: "#E6F1FB", text: "#0C447C" },
  URGENT: { bg: "#FAEEDA", text: "#633806" },
  DONE: { bg: "#EAF3DE", text: "#27500A" },
};

interface Props {
  status: ThreadStatus;
  onChange: (s: ThreadStatus) => void;
}

export function StatusControl({ status, onChange }: Props) {
  return (
    <View className="flex-row px-4 py-3 gap-2 border-b border-border bg-surface">
      {options.map((opt) => {
        const active = status === opt.status;
        const s = active ? activeStyles[opt.status] : null;
        return (
          <Pressable
            key={opt.status}
            onPress={() => onChange(opt.status)}
            style={[
              {
                flex: 1,
                minHeight: 44,
                justifyContent: "center",
                alignItems: "center",
                borderRadius: 8,
                borderWidth: 0.5,
                borderColor: active ? "transparent" : "#E2E0D8",
                backgroundColor: s?.bg ?? "#fff",
              },
            ]}
          >
            <Text
              style={{
                fontSize: opt.status === "URGENT" && active ? 12 : 11,
                fontWeight: "600",
                color: s?.text ?? "#888780",
                letterSpacing: 0.5,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
