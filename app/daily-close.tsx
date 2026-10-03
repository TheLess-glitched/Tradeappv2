import { router } from "expo-router";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Moon,
} from "lucide-react-native";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { showFeedback } from "../components/app-feedback";
import StatCard from "../components/stat-card";
import { formatCurrency } from "../constants/currency";
import { useTheme } from "../context/theme-context";
import { getJobProfit, useTodaysJobs } from "../hooks/use-todays-jobs";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Completed",
};

export default function DailyCloseScreen() {
  const { colors, currency } = useTheme();
  const {
    jobs,
    sales,
    loading,
    jobsCount,
    pendingJobs,
    inProgressJobs,
    completedJobs,
    salesCount,
    unitsSold,
    jobsRevenue,
    salesRevenue,
    totalRevenue,
    profitToday,
    unknownCostSalesCount,
    unknownCostCompletedJobsCount,
    knownCostProfitCount,
    pendingJobsRevenue,
    unfinishedJobs,
    unfinishedCount,
  } = useTodaysJobs();

  const todayFormatted = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const records = [...jobs, ...sales].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  const handleFinishDay = () => {
    showFeedback(
      "Day Closed",
      "Today's summary has been reviewed. Great work today!",
      [
        {
          text: "Done",
          onPress: () => router.push("/(tabs)/home" as any),
        },
      ],
    );
  };

  const handleCloseDayPress = () => {
    if (unfinishedCount > 0) {
      const jobListText =
        unfinishedJobs.length <= 4
          ? unfinishedJobs
              .map(
                (job) =>
                  `• ${job.customer_name || "Walk-in Customer"} — ${job.service}`,
              )
              .join("\n")
          : `${unfinishedCount} jobs still in progress or pending`;

      showFeedback(
        "Unfinished Jobs",
        `You have ${unfinishedCount} unfinished job${
          unfinishedCount === 1 ? "" : "s"
        } recorded today:\n\n${jobListText}\n\nWhat would you like to do?`,
        [
          {
            text: "Review Jobs",
            onPress: () => router.push("/(tabs)/jobs" as any),
          },
          {
            text: "Close Anyway",
            style: "destructive",
            onPress: handleFinishDay,
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ],
      );
    } else {
      handleFinishDay();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            {todayFormatted}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            End of Day Wrap-up
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading today&apos;s summary...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.revenueSection}>
            <Text
              style={[styles.sectionEyebrow, { color: colors.textMuted }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              ellipsizeMode="tail"
            >
              Revenue Today
            </Text>
            <Text
              style={[styles.revenueValue, { color: colors.primary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              ellipsizeMode="tail"
            >
              {formatCurrency(totalRevenue, currency)}
            </Text>
            <View style={styles.revenueLines}>
              <Text
                style={[styles.revenueLine, { color: colors.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                ellipsizeMode="tail"
              >
                Jobs revenue: {formatCurrency(jobsRevenue, currency)}
              </Text>
              <Text
                style={[styles.revenueLine, { color: colors.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                ellipsizeMode="tail"
              >
                Sales revenue: {formatCurrency(salesRevenue, currency)}
              </Text>
              <Text
                style={[styles.revenueLine, { color: colors.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                ellipsizeMode="tail"
              >
                Profit today: {knownCostProfitCount > 0 ? formatCurrency(profitToday, currency) : "—"}
              </Text>
              {unknownCostSalesCount + unknownCostCompletedJobsCount > 0 ? (
                <Text
                  style={[styles.excludedNote, { color: colors.textMuted }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  ellipsizeMode="tail"
                >
                  {unknownCostSalesCount > 0
                    ? `${unknownCostSalesCount} sale${unknownCostSalesCount === 1 ? "" : "s"}`
                    : ""}
                  {unknownCostSalesCount > 0 && unknownCostCompletedJobsCount > 0 ? " · " : ""}
                  {unknownCostCompletedJobsCount > 0
                    ? `${unknownCostCompletedJobsCount} completed job${unknownCostCompletedJobsCount === 1 ? "" : "s"}`
                    : ""} excluded: cost unknown
                </Text>
              ) : null}
              <Text style={[styles.pendingRevenueLine, { color: colors.textSecondary }]}>
                Pending jobs: {formatCurrency(pendingJobsRevenue, currency)}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Jobs
          </Text>
          <View style={styles.statsGrid}>
            <StatCard label="Total" value={jobsCount} colors={colors} />
            <StatCard label="Pending" value={pendingJobs} colors={colors} valueColor={colors.statusPending} />
            <StatCard label="In Progress" value={inProgressJobs} colors={colors} valueColor={colors.statusInProgress} />
            <StatCard label="Completed" value={completedJobs} colors={colors} valueColor={colors.statusDone} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Sales
          </Text>
          <View style={[styles.statsGrid, styles.salesStatsGrid]}>
            <StatCard label="Total Sold" value={salesCount} colors={colors} valueColor={colors.statusDone} />
            <StatCard label="Units Sold" value={unitsSold} colors={colors} />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Today&apos;s Breakdown
          </Text>
          {records.length === 0 ? (
            <View style={styles.emptyState}>
              <Clock size={24} color={colors.primary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No jobs or sales recorded today
              </Text>
            </View>
          ) : (
            records.map((record) => {
              const isSale = record.record_type === "sale";
              const profit = isSale ? getJobProfit(record) : null;
              const statusText = isSale
                ? "Sold"
                : STATUS_LABELS[record.status] ?? record.status;
              const time = new Date(record.created_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <View
                  key={record.id}
                  style={[
                    styles.recordRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.recordMain}>
                    <Text style={[styles.recordTitle, { color: colors.text }]}>
                      {record.customer_name || record.service}
                    </Text>
                    <Text style={[styles.recordSubtitle, { color: colors.textMuted }]}>
                      {record.service} · {time}
                    </Text>
                    {isSale ? (
                      <Text style={[styles.recordDetail, { color: colors.textSecondary }]}>
                        Quantity {record.quantity} · Profit {profit == null ? "—" : formatCurrency(profit, currency)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.recordAside}>
                    <Text style={[styles.recordAmount, { color: colors.text }]}>
                      {formatCurrency(record.line_total ?? 0, currency)}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isSale
                            ? `${colors.statusDone}18`
                            : `${colors.statusInProgress}18`,
                        },
                      ]}
                    >
                      {isSale ? (
                        <CheckCircle2 size={12} color={colors.statusDone} />
                      ) : null}
                      <Text
                        style={[
                          styles.statusText,
                          { color: isSale ? colors.statusDone : colors.statusInProgress },
                        ]}
                      >
                        {statusText}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          <View
            style={[
              styles.noticeBanner,
              {
                backgroundColor:
                  unfinishedCount > 0
                    ? `${colors.statusInProgress}18`
                    : `${colors.statusDone}18`,
                borderColor:
                  unfinishedCount > 0
                    ? `${colors.statusInProgress}40`
                    : `${colors.statusDone}40`,
              },
            ]}
          >
            {unfinishedCount > 0 ? (
              <>
                <AlertCircle size={20} color={colors.statusInProgress} />
                <Text style={[styles.noticeText, { color: colors.statusInProgress }]}>
                  {unfinishedCount} job{unfinishedCount === 1 ? "" : "s"} still unfinished today
                </Text>
              </>
            ) : jobsCount > 0 ? (
              <>
                <CheckCircle2 size={20} color={colors.statusDone} />
                <Text style={[styles.noticeText, { color: colors.statusDone }]}>
                  All {jobsCount} job{jobsCount === 1 ? "" : "s"} today are complete
                </Text>
              </>
            ) : (
              <>
                <Clock size={20} color={colors.textMuted} />
                <Text style={[styles.noticeText, { color: colors.textMuted }]}>
                  No service jobs recorded today
                </Text>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleCloseDayPress}
            activeOpacity={0.8}
          >
            <Moon size={20} color={colors.primaryText} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
              Close Day
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
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
    gap: 12,
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  headerCopy: { flex: 1 },
  headerSpacer: { width: 40 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  dateText: { fontSize: 12, fontWeight: "500", marginBottom: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  revenueSection: { marginBottom: 24 },
  sectionEyebrow: { fontSize: 13, fontWeight: "600" },
  revenueValue: { fontSize: 32, fontWeight: "800", marginTop: 3, marginBottom: 10 },
  revenueLines: { gap: 4 },
  revenueLine: { fontSize: 14 },
  excludedNote: { fontSize: 12, marginTop: 2 },
  pendingRevenueLine: { fontSize: 12, marginTop: 2 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 10,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  salesStatsGrid: { marginBottom: 24 },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  recordMain: { flex: 1, minWidth: 0 },
  recordTitle: { fontSize: 14, fontWeight: "700" },
  recordSubtitle: { fontSize: 12, marginTop: 3 },
  recordDetail: { fontSize: 12, marginTop: 5 },
  recordAside: { alignItems: "flex-end", flexShrink: 0 },
  recordAmount: { fontSize: 14, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 5,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  emptyState: {
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  emptyText: { fontSize: 14, fontWeight: "600" },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  noticeText: { fontSize: 13, fontWeight: "600", flex: 1 },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: 12,
  },
  primaryButtonText: { fontSize: 16, fontWeight: "700" },
});