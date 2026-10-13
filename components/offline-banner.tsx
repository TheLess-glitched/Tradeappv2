import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeStale } from "../constants/caching-fetch";
import { useTheme } from "../context/theme-context";
import { useIsOnline } from "../hooks/use-online";

export function OfflineBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useIsOnline();
  const [staleAt, setStaleAt] = useState<number | null>(null);

  useEffect(() => subscribeStale((savedAt) => setStaleAt(savedAt)), []);

  // Once the connection is back, drop the note after a few seconds.
  useEffect(() => {
    if (!online || staleAt === null) return;
    const timer = setTimeout(() => setStaleAt(null), 6000);
    return () => clearTimeout(timer);
  }, [online, staleAt]);

  if (online && staleAt === null) return null;

  const text = online
    ? "Slow connection · showing saved data"
    : "Offline · showing saved data";

  return (
    <View style={[styles.wrap, { top: insets.top + 2 }]}>
      <View
        style={[
          styles.pill,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
    elevation: 10,
    pointerEvents: "none",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: "600" },
});
