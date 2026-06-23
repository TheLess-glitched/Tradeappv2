import { router, useFocusEffect } from "expo-router";
import {
  Bell,
  Briefcase,
  FileText,
  FlaskConical,
  Menu,
  Moon,
  MoreHorizontal,
  Package,
  Plus,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { supabase } from "../../constants/supabase";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

type Job = {
  id: number;
  customer_name: string;
  service: string;
  status: "pending" | "in_progress" | "done";
  time: string;
  price: number;
};

const STATUS_COLORS = {
  pending: "#F6A623",
  in_progress: "#63B3ED",
  done: "#68D391",
};

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
};

const GRID_ITEMS = [
  {
    label: "Jobs",
    icon: <Briefcase size={26} color="#F6A623" />,
    color: "#F6A623",
    route: "/(tabs)/jobs",
  },
  {
    label: "Catalogue",
    icon: <Package size={26} color="#00A86B" />,
    color: "#00A86B",
    route: "/(tabs)/catalogue",
  },
  {
    label: "Customers",
    icon: <Users size={26} color="#63B3ED" />,
    color: "#63B3ED",
    route: "/(tabs)/customers",
  },
  {
    label: "Inventory",
    icon: <FlaskConical size={26} color="#B794F4" />,
    color: "#B794F4",
    route: "/inventory",
  },
  {
    label: "Notes",
    icon: <FileText size={26} color="#76E4F7" />,
    color: "#76E4F7",
    route: "/notes",
  },
  {
    label: "Daily Close",
    icon: <Moon size={26} color="#68D391" />,
    color: "#68D391",
    route: "/daily-close",
  },
  {
    label: "New Job",
    icon: <Plus size={26} color="#FC8181" />,
    color: "#FC8181",
    route: "/new-job",
  },
  {
    label: "More",
    icon: <MoreHorizontal size={26} color="#A0AEC0" />,
    color: "#A0AEC0",
    route: null,
  },
];

export default function CommandCenter() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAnim] = useState(new Animated.Value(-DRAWER_WIDTH));

  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, []),
  );

  const fetchJobs = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false })
      .limit(2);
    if (!error && data) setJobs(data);
    setLoading(false);
  };

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: -DRAWER_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setDrawerOpen(false));
  };

  const openJobs = jobs.filter((j) => j.status !== "done").length;
  const totalRevenue = jobs
    .filter((j) => j.status === "done")
    .reduce((sum, j) => sum + (j.price || 0), 0);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning 👋"
      : hour < 17
        ? "Good afternoon 👋"
        : "Good evening 👋";

  const today = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuButton}>
          <Menu size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerGreeting}>{greeting}</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifButton}
          onPress={() =>
            Alert.alert("Notifications", "You have no new notifications.")
          }
        >
          <Bell size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Stat Cards */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, styles.statCardAccent]}
            onPress={() => router.push("/(tabs)/jobs" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.statValueAccent}>
              ₦{totalRevenue > 0 ? totalRevenue.toLocaleString() : "—"}
            </Text>
            <Text style={styles.statLabelAccent}>Revenue Today</Text>
            <Text style={styles.statSubAccent}>Tap to view jobs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statCard}
            onPress={() => router.push("/(tabs)/jobs" as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.statValue}>{openJobs}</Text>
            <Text style={styles.statLabel}>Open Jobs</Text>
            <Text style={styles.statSub}>{jobs.length} recent</Text>
          </TouchableOpacity>
        </View>

        {/* Opay-style Grid */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          {GRID_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.gridItem}
              onPress={() => {
                if (!item.route) {
                  Alert.alert(
                    "Coming Soon",
                    "This feature will be available after launch. Stay tuned!",
                  );
                } else {
                  router.push(item.route as any);
                }
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.gridIconBox,
                  { backgroundColor: item.color + "22" },
                ]}
              >
                {item.icon}
              </View>
              <Text style={styles.gridLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Jobs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Jobs</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/jobs" as any)}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#F6A623" style={{ marginTop: 16 }} />
        ) : jobs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No jobs yet</Text>
            <Text style={styles.emptySubText}>
              Tap "New Job" to add your first one
            </Text>
          </View>
        ) : (
          <View style={styles.jobsList}>
            {jobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobItem}
                onPress={() => router.push("/(tabs)/jobs" as any)}
                activeOpacity={0.7}
              >
                <View style={styles.jobLeft}>
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: STATUS_COLORS[job.status] ?? "#718096",
                      },
                    ]}
                  />
                  <View>
                    <Text style={styles.jobCustomer}>{job.customer_name}</Text>
                    <Text style={styles.jobService}>{job.service}</Text>
                  </View>
                </View>
                <View style={styles.jobRight}>
                  <Text
                    style={[
                      styles.jobStatus,
                      { color: STATUS_COLORS[job.status] ?? "#718096" },
                    ]}
                  >
                    {STATUS_LABELS[job.status] ?? job.status}
                  </Text>
                  <Text style={styles.jobTime}>{job.time || "—"}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Drawer Overlay + Panel */}
      {drawerOpen && (
        <Modal visible transparent animationType="none">
          <TouchableWithoutFeedback onPress={closeDrawer}>
            <View style={styles.drawerOverlay} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}
          >
            <StatusBar barStyle="light-content" />

            <View style={styles.drawerHeader}>
              <View style={styles.drawerLogoBox}>
                <Text style={styles.drawerLogoText}>T</Text>
              </View>
              <Text style={styles.drawerAppName}>TradeApp</Text>
              <Text style={styles.drawerTagline}>
                Run your business. Your way.
              </Text>
            </View>

            <View style={styles.drawerDivider} />

            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                closeDrawer();
                setTimeout(() => router.push("/settings" as any), 300);
              }}
            >
              <View
                style={[
                  styles.drawerItemIcon,
                  { backgroundColor: "#B794F422" },
                ]}
              >
                <Settings size={20} color="#B794F4" />
              </View>
              <Text style={styles.drawerItemText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                closeDrawer();
                setTimeout(
                  () =>
                    Alert.alert(
                      "Privacy Policy",
                      "Privacy policy page coming soon.",
                    ),
                  300,
                );
              }}
            >
              <View
                style={[
                  styles.drawerItemIcon,
                  { backgroundColor: "#76E4F722" },
                ]}
              >
                <Shield size={20} color="#76E4F7" />
              </View>
              <Text style={styles.drawerItemText}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.drawerClose} onPress={closeDrawer}>
              <X size={20} color="#4A5568" />
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0F1E" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, marginLeft: 8 },
  headerGreeting: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  headerDate: { fontSize: 12, color: "#718096", marginTop: 2 },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#131929",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    backgroundColor: "#131929",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  statCardAccent: { backgroundColor: "#F6A623", borderColor: "#F6A623" },
  statValue: { fontSize: 22, fontWeight: "800", color: "#FFFFFF" },
  statValueAccent: { fontSize: 22, fontWeight: "800", color: "#0A0F1E" },
  statLabel: { fontSize: 12, color: "#718096", marginTop: 2 },
  statLabelAccent: { fontSize: 12, color: "#7A4E00", marginTop: 2 },
  statSub: { fontSize: 11, color: "#4A5568", marginTop: 4 },
  statSubAccent: { fontSize: 11, color: "#8B6914", marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, color: "#F6A623" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridItem: { width: "22%", alignItems: "center" },
  gridIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  gridLabel: {
    fontSize: 11,
    color: "#A0AEC0",
    fontWeight: "500",
    textAlign: "center",
  },
  jobsList: {
    backgroundColor: "#131929",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2A3D",
    overflow: "hidden",
  },
  jobItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2A3D",
  },
  jobLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  jobCustomer: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  jobService: { fontSize: 12, color: "#718096", marginTop: 2 },
  jobRight: { alignItems: "flex-end" },
  jobStatus: { fontSize: 12, fontWeight: "600" },
  jobTime: { fontSize: 11, color: "#4A5568", marginTop: 2 },
  emptyState: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#4A5568" },
  emptySubText: { fontSize: 13, color: "#2D3748", marginTop: 4 },
  drawerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "#0F1923",
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  drawerHeader: { alignItems: "center", marginBottom: 24 },
  drawerLogoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#F6A623",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  drawerLogoText: { fontSize: 26, fontWeight: "800", color: "#0A0F1E" },
  drawerAppName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  drawerTagline: { fontSize: 12, color: "#718096", textAlign: "center" },
  drawerDivider: { height: 1, backgroundColor: "#1E2A3D", marginBottom: 24 },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  drawerItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerItemText: { fontSize: 16, fontWeight: "600", color: "#FFFFFF" },
  drawerClose: { position: "absolute", top: 56, right: 20 },
});
