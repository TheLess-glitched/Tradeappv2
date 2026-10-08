import { router } from "expo-router";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Moon,
} from "lucide-react-native";
import { useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { showFeedback } from "../components/app-feedback";
import CompletedJobRow from "../components/completed-job-row";
import SaleGroupCard from "../components/sale-group-card";
import StatCard from "../components/stat-card";
import { formatCurrency } from "../constants/currency";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";
import { getJobProfit, useTodaysJobs } from "../hooks/use-todays-jobs";
import { groupSaleRows } from "../hooks/sale-groups";

export default function DailyCloseScreen() {
  const { colors, currency } = useTheme();
  const { role, session } = useAuth();
  const isOwner = role === "owner";
  const isWorker = role === "worker";
  const {
    jobs,
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
    voidedCount,
    voidedRevenue,
    voidedRecords,
    voidedSaleGroupsToday,
    completedJobsToday,
    salesCompletedToday,
    salesForDisplay,
  } = useTodaysJobs();
  const [voidsExpanded, setVoidsExpanded] = useState(false);

  const todayFormatted = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const myCompletedJobs = completedJobsToday.filter(
    (job) => job.created_by === session?.user?.id,
  );
  const myCompletedSales = salesCompletedToday.filter(
    (sale) => sale.created_by === session?.user?.id,
  );
  const myDayRevenue = [...myCompletedJobs, ...myCompletedSales].reduce(
    (sum, record) => sum + (record.line_total ?? 0),
    0,
  );
  const dailySaleGroups = groupSaleRows(salesForDisplay).filter(
    (group) =>
      !group.voided &&
      (!isWorker || group.created_by === session?.user?.id),
  );
  const dailyJobs = isWorker
    ? jobs.filter((record) => record.created_by === session?.user?.id)
    : jobs;
  const records = [
    ...dailyJobs.map((record) => ({
      kind: "job" as const,
      record,
      created_at: record.created_at,
    })),
    ...dailySaleGroups.map((group) => ({
      kind: "sale" as const,
      group,
      created_at: group.earliestTimestamp,
    })),
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );
  const isVoidedToday = (value: string | null) =>
    value != null &&
    new Date(value).toDateString() === new Date().toDateString();
  const sortedVoidedRecords = [
    ...voidedRecords
      .filter((record) => record.record_type === "job")
      .map((record) => ({
        kind: "job" as const,
        record,
        voidedAt: record.voided_at,
      })),
    ...voidedSaleGroupsToday.map((group) => ({
      kind: "sale" as const,
      group,
      voidedAt: group.lines.reduce<string | null>(
        (latest, line) =>
          isVoidedToday(line.voided_at) &&
          new Date(line.voided_at ?? 0).getTime() >
            new Date(latest ?? 0).getTime()
            ? line.voided_at
            : latest,
        null,
      ),
    })),
  ].sort(
    (left, right) =>
      new Date(right.voidedAt ?? 0).getTime() -
      new Date(left.voidedAt ?? 0).getTime(),
  );
  const revenueByPerson = new Map<
    string,
    { name: string; count: number; revenue: number }
  >();
  const addPersonRevenue = (
    record: { created_by: string | null; created_by_name: string | null },
    count: number,
    revenue: number,
  ) => {
    if (!record.created_by_name) return;
    const key = record.created_by ?? record.created_by_name;
    const current = revenueByPerson.get(key) ?? {
      name: record.created_by_name,
      count: 0,
      revenue: 0,
    };
    current.count += count;
    current.revenue += revenue;
    revenueByPerson.set(key, current);
  };
  for (const record of completedJobsToday) {
    addPersonRevenue(record, 1, record.line_total ?? 0);
  }
  for (const group of groupSaleRows(salesCompletedToday)) {
    addPersonRevenue(group, 1, group.total);
  }

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
            {isWorker ? "My Day" : "End of Day Wrap-up"}
          </Text>
        </View>
        {isOwner ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.push("/history" as any)}
            style={styles.historyButton}
          >
            <Text style={[styles.historyButtonText, { color: colors.primary }]}>
              History
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
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
              {isWorker ? "My Day" : "Revenue Today"}
            </Text>
            <Text
              style={[styles.revenueValue, { color: colors.primary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              ellipsizeMode="tail"
            >
              {formatCurrency(isWorker ? myDayRevenue : totalRevenue, currency)}
            </Text>
            <View style={styles.revenueLines}>
              {isOwner ? (
                <>
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
                </>
              ) : null}
              {isOwner && unknownCostSalesCount + unknownCostCompletedJobsCount > 0 ? (
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
              {isOwner ? <Text style={[styles.pendingRevenueLine, { color: colors.textSecondary }]}>
                Pending jobs: {formatCurrency(pendingJobsRevenue, currency)}
              </Text> : null}
              {isOwner && voidedCount > 0 ? (
                <>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ expanded: voidsExpanded }}
                    style={styles.voidedSummaryToggle}
                    onPress={() => setVoidsExpanded((expanded) => !expanded)}
                  >
                    <Text style={[styles.voidedSummary, { color: colors.textMuted }]}>
                      Voided today: {voidedCount} · {formatCurrency(voidedRevenue, currency)}
                    </Text>
                    {voidsExpanded ? (
                      <ChevronUp size={16} color={colors.textMuted} />
                    ) : (
                      <ChevronDown size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                  {voidsExpanded ? (
                    <View style={styles.voidedList}>
                      {sortedVoidedRecords.map((entry) => {
                        if (entry.kind === "sale" && entry.group.lines.length > 1) {
                          const voidedAmount = entry.group.lines.reduce(
                            (sum, line) =>
                              sum +
                              (isVoidedToday(line.voided_at)
                                ? line.line_total ?? 0
                                : 0),
                            0,
                          );
                          return (
                            <SaleGroupCard
                              key={`voided-${entry.group.id}`}
                              group={entry.group}
                              colors={colors}
                              currency={currency}
                              isOwner
                              totalOverride={voidedAmount}
                              amountLabel="Voided"
                            />
                          );
                        }
                        const record =
                          entry.kind === "job" ? entry.record : entry.group.lines[0];
                        const isSale = record.record_type === "sale";
                        const voidedTime = record.voided_at
                          ? new Date(record.voided_at).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—";

                        return (
                          <View
                            key={`voided-${record.id}`}
                            style={[
                              styles.voidedRow,
                              { backgroundColor: colors.surface, borderColor: colors.border },
                            ]}
                          >
                            <View style={styles.voidedRowHeader}>
                              <Text style={[styles.voidedName, { color: colors.text }]}>
                                {record.service}
                              </Text>
                              <Text style={[styles.voidedKind, { color: colors.textMuted }]}>
                                {isSale ? "Sale" : "Job"}
                              </Text>
                            </View>
                            {isSale ? (
                              <Text style={[styles.voidedDetail, { color: colors.textSecondary }]}>
                                {record.quantity} × {record.unit_price == null ? "—" : formatCurrency(record.unit_price, currency)}
                              </Text>
                            ) : null}
                            <Text style={[styles.voidedDetail, { color: colors.textSecondary }]}>
                              {formatCurrency(record.line_total ?? 0, currency)} · Voided {voidedTime}
                            </Text>
                            <Text style={[styles.voidedReason, { color: colors.textMuted }]}>
                              {record.void_reason || "No reason recorded"}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>
          </View>

          {isOwner ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                By person
              </Text>
              {revenueByPerson.size === 0 ? (
                <Text style={[styles.personEmpty, { color: colors.textMuted }]}>
                  No attributed revenue today
                </Text>
              ) : (
                Array.from(revenueByPerson.values()).map((person) => (
                  <View
                    key={person.name}
                    style={[
                      styles.personRow,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.personName, { color: colors.text }]}>
                      {person.name}
                    </Text>
                    <Text style={[styles.personSummary, { color: colors.textSecondary }]}>
                      {person.count} · {formatCurrency(person.revenue, currency)}
                    </Text>
                  </View>
                ))
              )}
            </>
          ) : null}

          {isOwner ? (
            <>
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
            </>
          ) : null}

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
            records.map((entry) => {
              if (entry.kind === "sale" && entry.group.lines.length > 1) {
                return (
                  <SaleGroupCard
                    key={entry.group.id}
                    group={entry.group}
                    colors={colors}
                    currency={currency}
                    isOwner={isOwner}
                  />
                );
              }
              const record =
                entry.kind === "job" ? entry.record : entry.group.lines[0];
              if (entry.kind === "job") {
                return (
                  <CompletedJobRow
                    key={`job:${record.id}`}
                    job={record}
                    colors={colors}
                    currency={currency}
                    isOwner={isOwner}
                    statusColor={colors.statusInProgress}
                  />
                );
              }
              const profit = getJobProfit(record);
              const statusText = "Sold";
              const time = new Date(record.created_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <View
                  key={entry.group.id}
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
                    <Text style={[styles.recordDetail, { color: colors.textSecondary }]}>
                      {isOwner
                        ? `Quantity ${record.quantity} · Profit ${profit == null ? "—" : formatCurrency(profit, currency)}`
                        : `Quantity ${record.quantity}`}
                    </Text>
                    {isOwner && record.created_by_name ? (
                      <Text style={[styles.recordSubtitle, { color: colors.textMuted }]}>
                        by {record.created_by_name}
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
                          backgroundColor: `${colors.statusDone}18`,
                        },
                      ]}
                    >
                      <CheckCircle2 size={12} color={colors.statusDone} />
                      <Text
                        style={[
                          styles.statusText,
                          { color: colors.statusDone },
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

          {isOwner ? <View
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
          </View> : null}

          {isOwner ? <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleCloseDayPress}
            activeOpacity={0.8}
          >
            <Moon size={20} color={colors.primaryText} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
              Close Day
            </Text>
          </TouchableOpacity> : null}
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
  historyButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  historyButtonText: { fontSize: 14, fontWeight: "700" },
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
  personEmpty: { fontSize: 13, marginBottom: 20 },
  personRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 8 },
  personName: { fontSize: 14, fontWeight: "600" },
  personSummary: { fontSize: 13 },
  revenueLine: { fontSize: 14 },
  excludedNote: { fontSize: 12, marginTop: 2 },
  pendingRevenueLine: { fontSize: 12, marginTop: 2 },
  voidedSummaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  voidedSummary: { flex: 1, fontSize: 13, fontWeight: "600" },
  voidedList: { gap: 8, marginTop: 8 },
  voidedRow: { borderWidth: 1, borderRadius: 9, padding: 10, gap: 4 },
  voidedRowHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  voidedName: { flex: 1, fontSize: 13, fontWeight: "700" },
  voidedKind: { fontSize: 12, fontWeight: "600" },
  voidedDetail: { fontSize: 12 },
  voidedReason: { fontSize: 13, lineHeight: 19, marginTop: 2 },
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