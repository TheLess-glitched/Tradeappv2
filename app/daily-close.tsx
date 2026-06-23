import { router } from "expo-router";
import { ArrowLeft, ChevronRight } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../constants/supabase";

type Job = {
  id: number;
  customer_name: string;
  service: string;
  price: number;
  status: "pending" | "in_progress" | "done";
  date: string;
  time: string;
};

type Summary = {
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  totalRevenue: number;
};

export default function DailyCloseScreen() {
  const [summary, setSummary] = useState<Summary>({
    totalJobs: 0,
    completedJobs: 0,
    pendingJobs: 0,
    totalRevenue: 0,
  });
  const [pendingJobsList, setPendingJobsList] = useState<Job[]>([]);
  const [completedJobsList, setCompletedJobsList] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);

  const today = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    fetchTodaySummary();
  }, []);

  const fetchTodaySummary = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const completed = data.filter((j) => j.status === "done");
      const pending = data.filter((j) => j.status !== "done");
      const revenue = completed.reduce((sum, j) => sum + (j.price || 0), 0);
      setSummary({
        totalJobs: data.length,
        completedJobs: completed.length,
        pendingJobs: pending.length,
        totalRevenue: revenue,
      });
      setPendingJobsList(pending);
      setCompletedJobsList(completed);
    }
    setLoading(false);
  };

  const handleCloseDay = () => {
    Alert.alert(
      "Close Day",
      "Are you sure you want to close today? This will mark all pending jobs for follow-up tomorrow.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Close Day",
          onPress: async () => {
            setClosing(true);
            const {
              data: { user },
            } = await supabase.auth.getUser();
            await supabase
              .from("jobs")
              .update({ status: "pending" })
              .eq("status", "in_progress")
              .eq("user_id", user?.id);
            setClosing(false);
            setClosed(true);
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#F6A623" style={{ marginTop: 100 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Daily Close</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {closed && (
          <View style={styles.closedBanner}>
            <Text style={styles.closedBannerText}>
              ✅ Day closed successfully!
            </Text>
            <Text style={styles.closedBannerSub}>
              Pending jobs have been rolled over to tomorrow.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Today's Summary</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statCardAccent]}>
            <Text style={styles.statValueAccent}>
              ₦{summary.totalRevenue.toLocaleString()}
            </Text>
            <Text style={styles.statLabelAccent}>Total Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary.totalJobs}</Text>
            <Text style={styles.statLabel}>Total Jobs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: "#68D391" }]}>
              {summary.completedJobs}
            </Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: "#F6A623" }]}>
              {summary.pendingJobs}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Performance</Text>
        <View style={styles.performanceCard}>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Completion Rate</Text>
            <Text style={styles.performanceValue}>
              {summary.totalJobs > 0
                ? Math.round((summary.completedJobs / summary.totalJobs) * 100)
                : 0}
              %
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${summary.totalJobs > 0 ? Math.round((summary.completedJobs / summary.totalJobs) * 100) : 0}%`,
                },
              ]}
            />
          </View>
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>Avg Revenue per Job</Text>
            <Text style={styles.performanceValue}>
              ₦
              {summary.completedJobs > 0
                ? Math.round(
                    summary.totalRevenue / summary.completedJobs,
                  ).toLocaleString()
                : 0}
            </Text>
          </View>
        </View>

        {pendingJobsList.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Pending Jobs ({pendingJobsList.length})
            </Text>
            <View style={styles.jobsList}>
              {pendingJobsList.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.jobItem}
                  onPress={() => router.push("/jobs")}
                  activeOpacity={0.7}
                >
                  <View style={styles.jobLeft}>
                    <View
                      style={[styles.statusDot, { backgroundColor: "#F6A623" }]}
                    />
                    <View>
                      <Text style={styles.jobCustomer}>
                        {job.customer_name}
                      </Text>
                      <Text style={styles.jobService}>{job.service}</Text>
                    </View>
                  </View>
                  <View style={styles.jobRight}>
                    <Text style={styles.jobPrice}>
                      ₦{job.price?.toLocaleString() || "—"}
                    </Text>
                    <ChevronRight size={14} color="#4A5568" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {completedJobsList.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Completed Jobs ({completedJobsList.length})
            </Text>
            <View style={styles.jobsList}>
              {completedJobsList.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.jobItem}
                  onPress={() => router.push("/jobs")}
                  activeOpacity={0.7}
                >
                  <View style={styles.jobLeft}>
                    <View
                      style={[styles.statusDot, { backgroundColor: "#68D391" }]}
                    />
                    <View>
                      <Text style={styles.jobCustomer}>
                        {job.customer_name}
                      </Text>
                      <Text style={styles.jobService}>{job.service}</Text>
                    </View>
                  </View>
                  <View style={styles.jobRight}>
                    <Text style={[styles.jobPrice, { color: "#68D391" }]}>
                      ₦{job.price?.toLocaleString() || "—"}
                    </Text>
                    <ChevronRight size={14} color="#4A5568" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          style={[
            styles.closeButton,
            (closing || closed) && styles.closeButtonDisabled,
          ]}
          onPress={handleCloseDay}
          disabled={closing || closed}
        >
          {closing ? (
            <ActivityIndicator color="#0A0F1E" />
          ) : (
            <Text style={styles.closeButtonText}>
              {closed ? "✅ Day Closed" : "🔒 Close Day"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0F1E" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  headerDate: { fontSize: 13, color: "#718096", marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  closedBanner: {
    backgroundColor: "#1A2E1A",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#68D391",
  },
  closedBannerText: { fontSize: 15, fontWeight: "700", color: "#68D391" },
  closedBannerSub: { fontSize: 13, color: "#718096", marginTop: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#131929",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  statCardAccent: {
    backgroundColor: "#F6A623",
    borderColor: "#F6A623",
    width: "100%",
    flex: 0,
  },
  statValue: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  statValueAccent: { fontSize: 28, fontWeight: "800", color: "#0A0F1E" },
  statLabel: { fontSize: 12, color: "#718096", marginTop: 4 },
  statLabelAccent: { fontSize: 13, color: "#7A4E00", marginTop: 4 },
  performanceCard: {
    backgroundColor: "#131929",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2A3D",
    marginBottom: 20,
    gap: 12,
  },
  performanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  performanceLabel: { fontSize: 13, color: "#718096" },
  performanceValue: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  progressBarBg: {
    height: 8,
    backgroundColor: "#1E2A3D",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#F6A623",
    borderRadius: 4,
  },
  jobsList: {
    backgroundColor: "#131929",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E2A3D",
    overflow: "hidden",
    marginBottom: 20,
  },
  jobItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1E2A3D",
  },
  jobLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  jobCustomer: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  jobService: { fontSize: 12, color: "#718096", marginTop: 2 },
  jobRight: { alignItems: "flex-end", gap: 4 },
  jobPrice: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
  closeButton: {
    backgroundColor: "#F6A623",
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 8,
  },
  closeButtonDisabled: { opacity: 0.6 },
  closeButtonText: { fontSize: 16, fontWeight: "700", color: "#0A0F1E" },
});
