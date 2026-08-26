import { router, useFocusEffect } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
  status: string;
  created_at: string;
};

export default function DailyCloseScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      fetchTodaySummary();
    }, []),
  );

  const fetchTodaySummary = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Force strictly local timezone boundaries to prevent UTC bleed
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", user?.id)
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString())
      .order("created_at", { ascending: false });

    if (!error && data) setJobs(data);
    setLoading(false);
  };

  const totalRevenue = jobs.reduce((sum, job) => sum + (job.price || 0), 0);
  const completedJobs = jobs.filter((j) => j.status === "done").length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Close</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color="#F6A623" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Revenue Today</Text>
            <Text style={styles.summaryValue}>
              ₦{totalRevenue.toLocaleString()}
            </Text>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Total Jobs</Text>
                <Text style={styles.statNumber}>{jobs.length}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Completed</Text>
                <Text style={[styles.statNumber, { color: "#68D391" }]}>
                  {completedJobs}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Today's Breakdown</Text>
          {jobs.length === 0 ? (
            <Text style={styles.emptyText}>No jobs recorded today.</Text>
          ) : (
            jobs.map((job) => (
              <View key={job.id} style={styles.jobRow}>
                <View style={styles.jobLeft}>
                  <Text style={styles.jobName}>{job.customer_name}</Text>
                  <Text style={styles.jobService}>{job.service}</Text>
                </View>
                <View style={styles.jobRight}>
                  <Text style={styles.jobPrice}>
                    ₦{job.price?.toLocaleString()}
                  </Text>
                  <Text style={styles.jobStatus}>
                    {job.status === "done" ? "✅ Done" : "⏳ Pending"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
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
    gap: 12,
  },
  backButton: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: "#131929",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  summaryLabel: { fontSize: 14, color: "#A0AEC0", marginBottom: 8 },
  summaryValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#F6A623",
    marginBottom: 24,
  },
  statsRow: { flexDirection: "row", gap: 16 },
  statBox: {
    flex: 1,
    backgroundColor: "#0A0F1E",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  statLabel: { fontSize: 12, color: "#718096", marginBottom: 4 },
  statNumber: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A5568",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  emptyText: { color: "#718096", fontSize: 15, fontStyle: "italic" },
  jobRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#131929",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  jobLeft: { flex: 1 },
  jobName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  jobService: { fontSize: 13, color: "#A0AEC0", marginTop: 4 },
  jobRight: { alignItems: "flex-end" },
  jobPrice: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  jobStatus: { fontSize: 12, color: "#718096", marginTop: 4 },
});
