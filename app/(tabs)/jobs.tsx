import { router } from "expo-router";
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
import { supabase } from "../../constants/supabase";

type Job = {
  id: number;
  customer_name: string;
  service: string;
  price: number;
  date: string;
  time: string;
  notes: string;
  status: "pending" | "in_progress" | "done";
  created_at: string;
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

const STATUS_ORDER: ("pending" | "in_progress" | "done")[] = [
  "pending",
  "in_progress",
  "done",
];

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "done"
  >("all");

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });
    if (!error && data) setJobs(data);
    setLoading(false);
  };

  const updateStatus = async (
    id: number,
    newStatus: "pending" | "in_progress" | "done",
  ) => {
    const { error } = await supabase
      .from("jobs")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      fetchJobs();
    }
  };

  const deleteJob = (id: number) => {
    Alert.alert("Delete Job", "Are you sure you want to delete this job?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from("jobs").delete().eq("id", id);
          if (error) {
            Alert.alert("Error", error.message);
          } else {
            fetchJobs();
          }
        },
      },
    ]);
  };

  const cycleStatus = (job: Job) => {
    const currentIndex = STATUS_ORDER.indexOf(job.status);
    const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
    Alert.alert(
      "Update Status",
      `Change status to "${STATUS_LABELS[nextStatus]}"?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Update", onPress: () => updateStatus(job.id, nextStatus) },
      ],
    );
  };

  const filtered =
    filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>All Jobs</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/new-job" as any)}
        >
          <Text style={styles.addButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(["all", "pending", "in_progress", "done"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === f && styles.filterTabTextActive,
              ]}
            >
              {f === "all" ? "All" : STATUS_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#F6A623" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No jobs here</Text>
          <Text style={styles.emptySubText}>Tap "+ New" to add a job</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((job) => (
            <View key={job.id} style={styles.jobCard}>
              <View style={styles.jobTop}>
                <View style={styles.jobLeft}>
                  <Text style={styles.jobCustomer}>{job.customer_name}</Text>
                  <Text style={styles.jobService}>{job.service}</Text>
                </View>
                <Text style={styles.jobPrice}>
                  ₦{job.price?.toLocaleString()}
                </Text>
              </View>

              <View style={styles.jobMeta}>
                {job.date ? (
                  <Text style={styles.jobMetaText}>📅 {job.date}</Text>
                ) : null}
                {job.time ? (
                  <Text style={styles.jobMetaText}>🕐 {job.time}</Text>
                ) : null}
                {job.notes ? (
                  <Text style={styles.jobMetaText} numberOfLines={1}>
                    📝 {job.notes}
                  </Text>
                ) : null}
              </View>

              <View style={styles.jobFooter}>
                <TouchableOpacity
                  style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_COLORS[job.status] + "22" },
                  ]}
                  onPress={() => cycleStatus(job)}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLORS[job.status] },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: STATUS_COLORS[job.status] },
                    ]}
                  >
                    {STATUS_LABELS[job.status]}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteJob(job.id)}
                >
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFFFFF", flex: 1 },
  addButton: {
    backgroundColor: "#F6A623",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: { fontSize: 14, fontWeight: "700", color: "#0A0F1E" },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#131929",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  filterTabActive: { backgroundColor: "#F6A623", borderColor: "#F6A623" },
  filterTabText: { fontSize: 11, fontWeight: "600", color: "#4A5568" },
  filterTabTextActive: { color: "#0A0F1E" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  jobCard: {
    backgroundColor: "#131929",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  jobTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobLeft: { flex: 1, marginRight: 12 },
  jobCustomer: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  jobService: { fontSize: 13, color: "#718096", marginTop: 2 },
  jobPrice: { fontSize: 16, fontWeight: "800", color: "#68D391" },
  jobMeta: { gap: 4, marginBottom: 12 },
  jobMetaText: { fontSize: 12, color: "#718096" },
  jobFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "600" },
  deleteButton: { paddingHorizontal: 12, paddingVertical: 6 },
  deleteText: { fontSize: 12, color: "#E53E3E", fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#4A5568" },
  emptySubText: { fontSize: 13, color: "#2D3748", marginTop: 4 },
});
