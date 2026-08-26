import { router } from "expo-router";
import { FileText, FlaskConical, Moon, Settings } from "lucide-react-native";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type MenuItem = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route: string;
  color: string;
};

const menuItems: MenuItem[] = [
  {
    title: "Inventory",
    subtitle: "Track job materials",
    icon: <FlaskConical size={28} color="#F6A623" />,
    route: "/inventory",
    color: "#F6A623",
  },
  {
    title: "Daily Close",
    subtitle: "End of day summary",
    icon: <Moon size={28} color="#68D391" />,
    route: "/daily-close",
    color: "#68D391",
  },
  {
    title: "Notes",
    subtitle: "Business reminders",
    icon: <FileText size={28} color="#76E4F7" />,
    route: "/notes",
    color: "#76E4F7",
  },
  {
    title: "Settings",
    subtitle: "Profile & preferences",
    icon: <Settings size={28} color="#B794F4" />,
    route: "/settings",
    color: "#B794F4",
  },
];

export default function MoreScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSubtitle}>All your tools in one place</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.title}
            style={styles.card}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View
              style={[styles.iconBox, { backgroundColor: item.color + "22" }]}
            >
              {item.icon}
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0F1E" },
  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, color: "#718096", marginTop: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 40,
  },
  card: {
    width: "46%",
    backgroundColor: "#131929",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  cardSubtitle: { fontSize: 12, color: "#718096", lineHeight: 16 },
});
