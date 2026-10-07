import { router, useFocusEffect } from "expo-router";
import {
    Bell,
    Briefcase,
    FileText,
    FlaskConical,
    Menu,
    Plus,
    Settings,
    Shield,
    ShoppingCart,
    UserPlus,
    Users,
    X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
import { showFeedback } from "../../components/app-feedback";
import StatCard from "../../components/stat-card";
import { formatCurrency } from "../../constants/currency";
import { supabase } from "../../constants/supabase";
import { getStatusStyle } from "../../constants/theme";
import { useAuth } from "../../context/auth-context";
import { useTheme } from "../../context/theme-context";
import { useTodaysJobs } from "../../hooks/use-todays-jobs";
import { describeSaleGroup, groupSaleRows, SaleGroup } from "../../hooks/sale-groups";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = SCREEN_WIDTH * 0.75;

type Job = {
  id: number;
  customer_name: string | null;
  service: string;
  record_type: "job" | "sale";
  status: "pending" | "in_progress" | "done";
  time: string;
  line_total: number | null;
  quantity: number;
  unit_price: number | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  sale_group_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
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
  done: "Completed",
};

export default function CommandCenter() {
  const { colors, currency } = useTheme();
  const { session, isSessionReady, businessId, role } = useAuth();
  const isOwner = role === "owner";
  const isWorker = role === "worker";
  const { totalRevenue, completedJobsToday, salesCompletedToday } = useTodaysJobs();
  const mySalesToday = salesCompletedToday.filter(
    (sale) => sale.created_by === session?.user?.id,
  );
  const mySalesTodayGroups = groupSaleRows(salesCompletedToday).filter(
    (group) => group.created_by === session?.user?.id,
  );
  const myJobsToday = completedJobsToday.filter(
    (job) => job.created_by === session?.user?.id,
  );
  const myDayRevenue = [...mySalesToday, ...myJobsToday].reduce(
    (total, record) => total + (record.line_total ?? 0),
    0,
  );

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const hasNotifsRef = useRef(false);
  const isCheckingRemindersRef = useRef(false);
  const handledReminderIdsRef = useRef<Set<number>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAnim] = useState(new Animated.Value(-DRAWER_WIDTH));

  const GRID_ITEMS = [
    {
      label: "New Job",
      icon: <Plus size={24} color={colors.primary} />,
      color: colors.primary,
      route: "/new-job",
    },
    {
      label: "Sell",
      icon: <ShoppingCart size={24} color={colors.statusDone} />,
      color: colors.statusDone,
      route: "/quick-sell",
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
  ];

  const fetchJobs = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      const pageSize = 500;
      const allRows: Job[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from("jobs")
          .select("id, customer_name, service, record_type, status, time, line_total, quantity, unit_price, created_at, created_by, created_by_name, sale_group_id, voided_at, void_reason")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (error) throw error;
        allRows.push(...(data ?? []));
        if ((data?.length ?? 0) < pageSize) break;
        offset += pageSize;
      }

      setJobs(allRows);
      hasDataRef.current = allRows.length > 0;
    } catch (err) {
      setJobs([]);
      hasDataRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const recentActivity = useMemo(() => {
    const saleGroups = groupSaleRows(
      jobs.filter((record) => record.record_type === "sale"),
    )
      .filter((group) => !group.voided)
      .map((group) => ({
        id: group.id,
        record_type: "sale" as const,
        group,
        created_at: group.earliestTimestamp,
      }));
    const jobRows = jobs
      .filter((record) => record.record_type === "job" && !record.voided_at)
      .map((job) => ({
        id: `job:${job.id}`,
        record_type: "job" as const,
        job,
        created_at: job.created_at,
      }));
    return [...saleGroups, ...jobRows]
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      )
      .slice(0, 2);
  }, [jobs]);

  const handleOpenNotifications = useCallback(async () => {
    setNotifModalOpen(true);
    if (unreadCount > 0 && session?.user?.id) {
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("is_read", false);
      } catch {
      }
    }
  }, [session?.user?.id, unreadCount]);

  const markRemindersAsRead = useCallback(
    async (reminderIds: number[]) => {
      if (reminderIds.length === 0 || !session?.user?.id) return;
      const idSet = new Set(reminderIds);
      setNotifications((prev) =>
        prev.map((n) => (idSet.has(n.id) ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - reminderIds.length));

      try {
        await supabase
          .from("notifications")
          .update({ is_read: true })
          .in("id", reminderIds);
      } catch {
      }
    },
    [session?.user?.id],
  );

  const checkUnreadDeadlineReminders = useCallback(
    (items: NotificationItem[]) => {
      if (isCheckingRemindersRef.current) return;

      const unreadReminders = items.filter(
        (n) =>
          !n.is_read &&
          !handledReminderIdsRef.current.has(n.id) &&
          (n.type === "deadline_approaching" || n.type === "job_overdue"),
      );

      if (unreadReminders.length === 0) return;

      isCheckingRemindersRef.current = true;
      unreadReminders.forEach((r) => handledReminderIdsRef.current.add(r.id));
      const reminderIds = unreadReminders.map((r) => r.id);

      const title =
        unreadReminders.length === 1
          ? unreadReminders[0].title
          : `You have ${unreadReminders.length} job reminders`;

      const message =
        unreadReminders.length === 1
          ? unreadReminders[0].message
          : unreadReminders.length === 2
            ? `• ${unreadReminders[0].title}: ${unreadReminders[0].message}\n• ${unreadReminders[1].title}: ${unreadReminders[1].message}`
            : `• ${unreadReminders[0].title}: ${unreadReminders[0].message}\n• ${unreadReminders[1].title}: ${unreadReminders[1].message}\n\n+${unreadReminders.length - 2} more`;

      showFeedback(
        title,
        message,
        [
          {
            text: "Dismiss",
            style: "cancel",
            onPress: () => {
              isCheckingRemindersRef.current = false;
              markRemindersAsRead(reminderIds);
            },
          },
          {
            text: "View",
            onPress: () => {
              isCheckingRemindersRef.current = false;
              markRemindersAsRead(reminderIds);
              handleOpenNotifications();
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            isCheckingRemindersRef.current = false;
            markRemindersAsRead(reminderIds);
          },
        },
      );
    },
    [handleOpenNotifications, markRemindersAsRead],
  );

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
        .order("created_at", { ascending: false });

      if (error) throw error;

      const items: NotificationItem[] = data ?? [];
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.is_read).length);
      hasNotifsRef.current = items.length > 0;
      checkUnreadDeadlineReminders(items);
    } catch {
      if (!hasNotifsRef.current) {
        setNotifications([]);
        setUnreadCount(0);
      }
    }
  }, [session?.user?.id, checkUnreadDeadlineReminders]);

  useFocusEffect(
    useCallback(() => {
      if (!isSessionReady || !session?.user?.id) {
        return;
      }

      fetchJobs();
      fetchNotifications();
    }, [fetchJobs, fetchNotifications, isSessionReady, session?.user?.id]),
  );

  useEffect(() => {
    if (isSessionReady && session?.user?.id) {
      fetchJobs();
      fetchNotifications();
    }
  }, [isSessionReady, session?.user?.id, fetchJobs, fetchNotifications]);

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

  const openJobs = recentActivity.filter(
    (record) => record.record_type === "job" && record.job.status !== "done",
  ).length;
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
          <StatCard
            label={isWorker ? "My Day" : "Revenue Today"}
            value={
              isWorker
                ? formatCurrency(myDayRevenue, currency)
                : formatCurrency(totalRevenue, currency)
            }
            colors={colors}
            backgroundColor={colors.primary}
            borderColor={colors.primary}
            labelColor={colors.primaryText}
            valueColor={colors.primaryText}
            subtitle={
              isWorker
                ? `${mySalesTodayGroups.length} sales · ${myJobsToday.length} jobs done`
                : "Tap for today's summary & Close Day"
            }
            subtitleColor={colors.primaryText}
            subtitleFontSize={13}
            subtitleLineHeight={18}
            subtitleNumberOfLines={2}
            subtitleAdjustsFontSizeToFit={false}
            minHeight={116}
            onPress={isOwner || isWorker ? () => router.push("/daily-close" as any) : undefined}
          />
          <StatCard
            label="Open Jobs"
            value={openJobs}
            colors={colors}
            backgroundColor={colors.surface}
            subtitle={`${recentActivity.length} recent records`}
            onPress={() => router.push("/(tabs)/jobs" as any)}
          />
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
                  showFeedback(
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

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
          <View style={styles.activityLinks}>
            <TouchableOpacity onPress={() => router.push("/(tabs)/jobs" as any)}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Jobs</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(tabs)/sales" as any)}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Sales</Text>
            </TouchableOpacity>
          </View>
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
        ) : recentActivity.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <Briefcase size={24} color={colors.primary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.text }]}>No activity yet</Text>
            <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
              Add a job or record a sale to get started
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
            {recentActivity.map((activity) => {
              const job =
                activity.record_type === "job" ? activity.job : activity.group.lines[0];
              const group: SaleGroup<Job> | null =
                activity.record_type === "sale" ? activity.group : null;
              const creatorName =
                group && group.lines.length > 1
                  ? group.created_by_name
                  : isOwner
                    ? job.created_by_name
                    : null;
              const statusStyles = getStatusStyle(
                colors,
                activity.record_type === "sale" ? "done" : job.status,
              );

              return (
                <TouchableOpacity
                  key={activity.id}
                  style={[
                    styles.jobItem,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() =>
                    router.push(
                      activity.record_type === "sale"
                        ? ("/(tabs)/sales" as any)
                        : ("/(tabs)/jobs" as any),
                    )
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.jobLeft}>
                    <View>
                      <Text style={[styles.jobCustomer, { color: colors.text }]}>
                        {group && group.lines.length > 1
                          ? describeSaleGroup(group)
                          : job.customer_name || "Walk-in Customer"}
                      </Text>
                      <Text style={[styles.jobService, { color: colors.textMuted }]}>
                        {group && group.lines.length > 1
                          ? `${formatCurrency(group.total, currency)} · ${group.unitCount} units`
                          : job.service}
                      </Text>
                      {creatorName ? (
                        <Text style={[styles.jobService, { color: colors.textMuted }]}>
                          by {creatorName}
                        </Text>
                      ) : null}
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
                        {activity.record_type === "sale"
                          ? "Sold"
                          : STATUS_LABELS[job.status] ?? job.status}
                      </Text>
                    </View>
                    <Text style={[styles.jobTime, { color: colors.textSecondary }]}>
                      {activity.record_type === "sale" && group && group.lines.length > 1
                        ? new Date(group.earliestTimestamp).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : job.time || "—"}
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

            {role === "owner" || role === "worker" ? (
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  closeDrawer();
                  setTimeout(() => router.push("/team" as any), 300);
                }}
              >
                <View
                  style={[
                    styles.drawerItemIcon,
                    { backgroundColor: colors.secondarySurface },
                  ]}
                >
                  <Users size={20} color={colors.secondary} />
                </View>
                <Text style={[styles.drawerItemText, { color: colors.text }]}>Team</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.drawerItem}
              onPress={() => {
                closeDrawer();
                setTimeout(() => router.push("/join-business" as any), 300);
              }}
            >
              <View
                style={[
                  styles.drawerItemIcon,
                  { backgroundColor: colors.secondarySurface },
                ]}
              >
                <UserPlus size={20} color={colors.secondary} />
              </View>
              <Text style={[styles.drawerItemText, { color: colors.text }]}>
                Join a business
              </Text>
            </TouchableOpacity>

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
                    showFeedback(
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
  activityLinks: { flexDirection: "row", gap: 16 },
  seeAll: { fontSize: 13, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridItem: { width: "46%", alignItems: "center" },
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
