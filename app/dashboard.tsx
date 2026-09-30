import { router } from "expo-router";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react-native";
import React from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { formatCurrency } from "../constants/currency";
import { getStatusStyle } from "../constants/theme";
import { useTheme } from "../context/theme-context";
import { useTodaysJobs } from "../hooks/use-todays-jobs";

export default function DashboardScreen() {
  const { colors, currency } = useTheme();
  const { jobs, loading, totalRevenue, completedJobs, inProgressJobs } = useTodaysJobs();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((item) => (
            <View
              key={item}
              style={[
                styles.skeletonCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.skeletonLine, { width: "48%", backgroundColor: colors.border }]} />
              <View style={[styles.skeletonLine, { width: "30%", backgroundColor: colors.border }]} />
            </View>
          ))}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Revenue Today</Text>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatCurrency(totalRevenue, currency)}</Text>

            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statBox,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Jobs</Text>
                <Text style={[styles.statNumber, { color: colors.text }]}>{jobs.length}</Text>
              </View>
              <View
                style={[
                  styles.statBox,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>In Progress</Text>
                <Text style={[styles.statNumber, { color: colors.statusInProgress }]}>{inProgressJobs}</Text>
              </View>
              <View
                style={[
                  styles.statBox,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Completed</Text>
                <Text style={[styles.statNumber, { color: colors.statusDone }]}>{completedJobs}</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Today&apos;s Breakdown</Text>
          {jobs.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <Clock size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>No jobs recorded today</Text>
            </View>
          ) : (
            jobs.map((job) => {
              const status =
                job.status === "done"
                  ? "done"
                  : job.status === "in_progress"
                    ? "in_progress"
                    : "pending";
              const statusStyles = getStatusStyle(colors, status);
              const StatusIcon = status === "done" ? CheckCircle2 : Clock;

              return (
                <View
                  key={job.id}
                  style={[
                    styles.jobRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.jobLeft}>
                    <Text style={[styles.jobName, { color: colors.text }]}>{job.customer_name || "Walk-in Customer"}</Text>
                    <Text style={[styles.jobService, { color: colors.textMuted }]}>{job.service}</Text>
                  </View>
                  <View style={styles.jobRight}>
                    <Text style={[styles.jobPrice, { color: colors.text }]}>{formatCurrency(job.price || 0, currency)}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusStyles.badgeBg },
                      ]}
                    >
                      <StatusIcon size={12} color={statusStyles.text} />
                      <Text
                        style={[
                          styles.statusBadgeText,
                          { color: statusStyles.text },
                        ]}
                      >
                        {status === "done" ? "Done" : status === "in_progress" ? "In Progress" : "Pending"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
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
  headerTitle: { fontSize: 22, fontWeight: "700" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  skeletonList: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  skeletonCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
  },
  summaryLabel: { fontSize: 14, marginBottom: 8 },
  summaryValue: {
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 24,
  },
  statsRow: { flexDirection: "row", gap: 12 },
  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statNumber: { fontSize: 20, fontWeight: "700" },
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  jobRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  jobLeft: { flex: 1 },
  jobName: { fontSize: 15, fontWeight: "700" },
  jobService: { fontSize: 13, marginTop: 4 },
  jobRight: { alignItems: "flex-end" },
  jobPrice: { fontSize: 15, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
