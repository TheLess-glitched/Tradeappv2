import { router, useFocusEffect } from "expo-router";
import {
    Bell,
    Briefcase,
    FileText,
    FlaskConical,
    Grid2x2,
    Menu,
    Moon,
    Package,
    Plus,
    Settings,
    Shield,
    Users,
    X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    FlatList,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { formatCurrency } from "../../constants/currency";
import { supabase } from "../../constants/supabase";
import { getStatusStyle } from "../../constants/theme";
import { useAuth } from "../../context/auth-context";
import { useTheme } from "../../context/theme-context";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

type Job = {
  id: number;
  customer_name: string | null;
  service: string;
  status: "pending" | "in_progress" | "done";
  time: string;
  price: number;
};

type NotificationItem = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  catalogue_item_id: string | null;
  is_read: boolean;
  created_at: string;
};

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
};

export default function CommandCenter() {
  const { colors, currency } = useTheme();
  const { session, isSessionReady } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const hasNotifsRef = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAnim] = useState(new Animated.Value(-DRAWER_WIDTH));

  const GRID_ITEMS = [
    {
      label: "Jobs",
      icon: <Briefcase size={24} color={colors.primary} />,
      color: colors.primary,
      route: "/(tabs)/jobs",
    },
    {
      label: "Catalogue",
      icon: <Package size={24} color={colors.statusDone} />,
      color: colors.statusDone,
      route: "/(tabs)/catalogue",
    },
    {
      label: "Customers",
      icon: <Users size={24} color={colors.statusInProgress} />,
      color: colors.statusInProgress,
      route: "/(tabs)/customers",
    },
    {
      label: "Inventory",
      icon: <FlaskConical size={24} color={colors.secondary} />,
      color: colors.secondary,
      route: "/inventory",
    },
    {
      label: "Notes",
      icon: <FileText size={24} color={colors.statusInProgress} />,
      color: colors.statusInProgress,
      route: "/notes",
    },
    {
      label: "Daily Close",
      icon: <Moon size={24} color={colors.secondary} />,
      color: colors.secondary,
      route: "/daily-close",
    },
    {
      label: "New Job",
      icon: <Plus size={24} color={colors.primary} />,
      color: colors.primary,
      route: "/new-job",
    },
    {
      label: "More",
      icon: <Grid2x2 size={24} color={colors.textSecondary} />,
      color: colors.textSecondary,
      route: "/(tabs)/more",
    },
  ];

  const fetchJobs = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("user_id", session?.user?.id)
        .order("created_at", { ascending: false })
        .limit(2);

      if (error) throw error;

      setJobs(data ?? []);
      hasDataRef.current = (data?.length ?? 0) > 0;
    } catch (err) {
      setJobs([]);
      hasDataRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const fetchTodayRevenue = useCallback(async () => {
    if (!isSessionReady || !session?.user?.id) {
      setTotalRevenue(0);
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("price, status")
        .eq("user_id", session.user.id)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString());

      if (error) throw error;

      setTotalRevenue(
        (data ?? [])
          .filter((job) => job.status === "done")
          .reduce((sum, job) => sum + (job.price || 0), 0),
      );
    } catch {
      setTotalRevenue(0);
    }
  }, [isSessionReady, session?.user?.id]);

  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const items: NotificationItem[] = data ?? [];
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.is_read).length);
      hasNotifsRef.current = items.length > 0;
    } catch {
      if (!hasNotifsRef.current) {
        setNotifications([]);
        setUnreadCount(0);
      }
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!isSessionReady || !session?.user?.id) {
        return;
      }

      fetchJobs();
      fetchTodayRevenue();
      fetchNotifications();
    }, [fetchJobs, fetchTodayRevenue, fetchNotifications, isSessionReady, session?.user?.id]),
  );

  useEffect(() => {
    if (isSessionReady && session?.user?.id) {
      fetchJobs();
      fetchTodayRevenue();
      fetchNotifications();
    }
  }, [isSessionReady, session?.user?.id, fetchJobs, fetchTodayRevenue, fetchNotifications]);

  const handleOpenNotifications = async () => {
    setNotifModalOpen(true);
    if (unreadCount > 0 && session?.user?.id) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("user_id", session.user.id)
          .eq("is_read", false);
      } catch {
      }
    }
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
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 17
        ? "Good afternoon"
        : "Good evening";

  const today = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.menuButton}>
          <Menu size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerGreeting, { color: colors.text }]}>{greeting}</Text>
          <Text style={[styles.headerDate, { color: colors.textMuted }]}>{today}</Text>
        </View>
        <TouchableOpacity
          style={[styles.notifButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={handleOpenNotifications}
          activeOpacity={0.7}
        >
          <Bell size={20} color={colors.text} />
          {unreadCount > 0 && (
            <View
              style={[
                styles.notifBadge,
                { backgroundColor: colors.danger, borderColor: colors.background },
              ]}
            >
              <Text style={styles.notifBadgeText}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Stat Cards */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/jobs" as any)}
            activeOpacity={0.8}
          >
            <Text style={[styles.statValueAccent, { color: colors.primaryText }]}>
              {formatCurrency(totalRevenue > 0 ? totalRevenue : 0, currency)}
            </Text>
            <Text style={[styles.statLabelAccent, { color: colors.primaryText, opacity: 0.85 }]}>
              Revenue Today
            </Text>
            <Text style={[styles.statSubAccent, { color: colors.primaryText, opacity: 0.7 }]}>
              Tap to view jobs
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push("/(tabs)/jobs" as any)}
            activeOpacity={0.8}
          >
            <Text style={[styles.statValue, { color: colors.text }]}>{openJobs}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Open Jobs</Text>
            <Text style={[styles.statSub, { color: colors.textSecondary }]}>
              {jobs.length} recent
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions Grid */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
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
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {item.icon}
              </View>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Jobs */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Jobs</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/jobs" as any)}>
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.skeletonList}>
            {[0, 1, 2].map((item) => (
              <View
                key={item}
                style={[
                  styles.skeletonRow,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.skeletonDot, { backgroundColor: colors.border }]} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={[styles.skeletonLine, { width: "58%", backgroundColor: colors.border }]} />
                  <View style={[styles.skeletonLine, { width: "34%", backgroundColor: colors.border }]} />
                </View>
              </View>
            ))}
          </View>
        ) : jobs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <Briefcase size={24} color={colors.primary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>No jobs yet</Text>
            <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
              Tap &quot;New Job&quot; to add your first one
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.jobsList,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {jobs.map((job) => {
              const statusStyles = getStatusStyle(colors, job.status);

              return (
                <TouchableOpacity
                  key={job.id}
                  style={[
                    styles.jobItem,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => router.push("/(tabs)/jobs" as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.jobLeft}>
                    <View>
                      <Text style={[styles.jobCustomer, { color: colors.text }]}>
                        {job.customer_name || "Walk-in Customer"}
                      </Text>
                      <Text style={[styles.jobService, { color: colors.textMuted }]}>
                        {job.service}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.jobRight}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusStyles.badgeBg },
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: statusStyles.dot },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: statusStyles.text },
                        ]}
                      >
                        {STATUS_LABELS[job.status] ?? job.status}
                      </Text>
                    </View>
                    <Text style={[styles.jobTime, { color: colors.textSecondary }]}>
                      {job.time || "—"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Drawer Overlay + Panel */}
      {drawerOpen && (
        <Modal visible transparent animationType="none">
          <TouchableWithoutFeedback onPress={closeDrawer}>
            <View style={[styles.drawerOverlay, { backgroundColor: colors.modalOverlay }]} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.drawer,
              {
                transform: [{ translateX: drawerAnim }],
                backgroundColor: colors.surface,
                borderRightColor: colors.border,
                borderRightWidth: 1,
              },
            ]}
          >
            <View style={styles.drawerHeader}>
              <View style={[styles.drawerLogoBox, { backgroundColor: colors.primary }]}>
                <Text style={[styles.drawerLogoText, { color: colors.primaryText }]}>T</Text>
              </View>
              <Text style={[styles.drawerAppName, { color: colors.text }]}>TradeApp</Text>
              <Text style={[styles.drawerTagline, { color: colors.textMuted }]}>
                Run your business. Your way.
              </Text>
            </View>

            <View style={[styles.drawerDivider, { backgroundColor: colors.border }]} />

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
                  { backgroundColor: colors.secondarySurface },
                ]}
              >
                <Settings size={20} color={colors.secondary} />
              </View>
              <Text style={[styles.drawerItemText, { color: colors.text }]}>Settings</Text>
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
                  { backgroundColor: colors.secondarySurface },
                ]}
              >
                <Shield size={20} color={colors.secondary} />
              </View>
              <Text style={[styles.drawerItemText, { color: colors.text }]}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.drawerClose} onPress={closeDrawer}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </Animated.View>
        </Modal>
      )}

      {/* Notifications Modal */}
      <Modal
        visible={notifModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifModalOpen(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.notifModalContent,
              { backgroundColor: colors.modalBackground, borderColor: colors.modalBorder },
            ]}
          >
            <View style={styles.notifModalHeader}>
              <Text style={[styles.notifModalTitle, { color: colors.text }]}>
                Notifications
              </Text>
              <TouchableOpacity onPress={() => setNotifModalOpen(false)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No notifications yet
                </Text>
                <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                  Low stock alerts will show up here
                </Text>
              </View>
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.notifItem,
                      { borderBottomColor: colors.border },
                      !item.is_read && { backgroundColor: colors.surfaceHighlight },
                    ]}
                  >
                    <Text style={[styles.notifItemTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.notifItemMessage, { color: colors.textSecondary }]}>
                      {item.message}
                    </Text>
                    <Text style={[styles.notifItemTime, { color: colors.textMuted }]}>
                      {new Date(item.created_at).toLocaleString("en-NG", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  headerGreeting: { fontSize: 16, fontWeight: "700" },
  headerDate: { fontSize: 12, marginTop: 2 },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statValueAccent: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 12, marginTop: 2 },
  statLabelAccent: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  statSub: { fontSize: 11, marginTop: 4 },
  statSubAccent: { fontSize: 11, marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  seeAll: { fontSize: 13, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridItem: { width: "22%", alignItems: "center" },
  gridIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  jobsList: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  jobItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  jobLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  jobCustomer: { fontSize: 14, fontWeight: "600" },
  jobService: { fontSize: 12, marginTop: 2 },
  jobRight: { alignItems: "flex-end" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 6,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  jobTime: { fontSize: 11, marginTop: 4 },
  skeletonList: { gap: 12 },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  skeletonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  emptyState: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyText: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySubText: { fontSize: 13, textAlign: "center" },
  drawerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  drawerHeader: { alignItems: "center", marginBottom: 24 },
  drawerLogoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  drawerLogoText: { fontSize: 26, fontWeight: "800" },
  drawerAppName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  drawerTagline: { fontSize: 12, textAlign: "center" },
  drawerDivider: { height: 1, marginBottom: 24 },
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
  drawerItemText: { fontSize: 16, fontWeight: "600" },
  drawerClose: { position: "absolute", top: 56, right: 20 },
  closeBtn: { padding: 6 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  notifModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "70%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    borderWidth: 1,
  },
  notifModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  notifModalTitle: { fontSize: 18, fontWeight: "700" },
  notifItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  notifItemTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  notifItemMessage: { fontSize: 13, marginBottom: 6 },
  notifItemTime: { fontSize: 11 },
});
