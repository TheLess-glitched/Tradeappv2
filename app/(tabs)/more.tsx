import { router } from "expo-router";
import { FileText, FlaskConical, Moon, Settings } from "lucide-react-native";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context/theme-context";

export default function MoreScreen() {
  const { colors } = useTheme();

  const menuItems = [
    {
      title: "Inventory",
      subtitle: "Track job materials",
      icon: <FlaskConical size={26} color={colors.primary} />,
      route: "/inventory",
      color: colors.primary,
    },
    {
      title: "Daily Close",
      subtitle: "End of day summary",
      icon: <Moon size={26} color={colors.statusDone} />,
      route: "/daily-close",
      color: colors.statusDone,
    },
    {
      title: "Notes",
      subtitle: "Business reminders",
      icon: <FileText size={26} color={colors.statusInProgress} />,
      route: "/notes",
      color: colors.statusInProgress,
    },
    {
      title: "Settings",
      subtitle: "Profile & preferences",
      icon: <Settings size={26} color={colors.secondary} />,
      route: "/settings",
      color: colors.secondary,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>More</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          All your tools in one place
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                },
              ]}
            >
              {item.icon}
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
              {item.subtitle}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: "700" },
  headerSubtitle: { fontSize: 14, marginTop: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    width: "46%",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardSubtitle: { fontSize: 12, lineHeight: 16 },
});
