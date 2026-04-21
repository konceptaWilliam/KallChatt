import { useEffect, useRef } from "react";
import { View, Text, Animated } from "react-native";
import type { ThreadStatus } from "@coldsoup/core";

const styles: Record<ThreadStatus, { bg: string; text: string; border: string; label: string; dot?: boolean }> = {
  OPEN:   { bg: "#EAF5EF", text: "#2F5A43", border: "#8FBFA3", label: "open" },
  URGENT: { bg: "#F6E6D4", text: "#8A4B1F", border: "#C79B6A", label: "urgent", dot: true },
  DONE:   { bg: "#ECEBE4", text: "#5A5954", border: "#C7C5BC", label: "done" },
};

function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [scale]);

  return (
    <Animated.View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: color, transform: [{ scale }] }} />
  );
}

export function StatusBadge({ status }: { status: ThreadStatus }) {
  const s = styles[status];
  return (
    <View
      style={{
        backgroundColor: s.bg,
        borderColor: s.border,
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      {s.dot && <PulseDot color={s.text} />}
      <Text style={{ color: s.text, fontSize: 10, fontWeight: "600", letterSpacing: 1.2, fontFamily: "monospace" }}>
        {s.label.toUpperCase()}
      </Text>
    </View>
  );
}
