import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { CheckSquare, Square } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
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
  const [confirmModal, setConfirmModal] = useState(false);
  const [jobToComplete, setJobToComplete] = useState<Job | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

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

  const cycleStatus = async (job: Job) => {
    const currentIndex = STATUS_ORDER.indexOf(job.status);
    const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];

    if (nextStatus === "done") {
      // NOTE: Temporarily ignoring AsyncStorage so you aren't locked out of testing the modal!
      setJobToComplete(job);
      setConfirmModal(true);
    } else {
      Alert.alert(
        "Update Status",
        `Change status to "${STATUS_LABELS[nextStatus]}"?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Update", onPress: () => updateStatus(job.id, nextStatus) },
        ],
      );
    }
  };

  const finalizeJob = async (job: Job, method: "sms" | "whatsapp" | "none") => {
    await updateStatus(job.id, "done");

    if (method !== "none") {
      const savedSettings = await AsyncStorage.getItem("business_settings");
      let template = "Hi {name}, your job is completed and ready!";
      if (savedSettings) {
        template = JSON.parse(savedSettings).completionMessage || template;
      }
      const personalizedMessage = template.replace("{name}", job.customer_name);

      let phoneToText = "";
      const { data: customerData } = await supabase
        .from("customers")
        .select("phone")
        .eq("name", job.customer_name)
        .limit(1)
        .single();

      if (customerData?.phone) {
        // Strip everything except raw numbers
        phoneToText = customerData.phone.replace(/\D/g, "");
      }

      if (method === "whatsapp") {
        try {
          let cleanNumber = phoneToText;
          // Force strict Nigerian/International formatting
          if (cleanNumber.startsWith("0"))
            cleanNumber = cleanNumber.substring(1);
          if (!cleanNumber.startsWith("234")) cleanNumber = "234" + cleanNumber;

          // Use the bulletproof universal web link
          const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(personalizedMessage)}`;
          await Linking.openURL(url);
        } catch (error) {
          Alert.alert("Error", "Could not route to WhatsApp.");
        }
      } else {
        // Standard SMS
        Linking.openURL(
          `sms:${phoneToText}?body=${encodeURIComponent(personalizedMessage)}`,
        );
      }
    }

    setConfirmModal(false);
    setJobToComplete(null);
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
                  <Text style={styles.jobMetaText}>⏰ {job.time}</Text>
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

      <Modal visible={confirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Job Completed! 🎉</Text>
            <Text style={styles.modalSubtitle}>
              Would you like to send a completion text message to{" "}
              {jobToComplete?.customer_name}?
            </Text>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setDontAskAgain(!dontAskAgain)}
              activeOpacity={0.7}
            >
              {dontAskAgain ? (
                <CheckSquare size={20} color="#F6A623" />
              ) : (
                <Square size={20} color="#718096" />
              )}
              <Text style={styles.checkboxText}>
                Do not ask me again (Disabled for testing)
              </Text>
            </TouchableOpacity>

            <View style={{ gap: 12 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: "#25D366",
                  padding: 14,
                  borderRadius: 10,
                  alignItems: "center",
                }}
                onPress={() => finalizeJob(jobToComplete!, "whatsapp")}
              >
                <Text
                  style={{ fontWeight: "700", color: "#0A0F1E", fontSize: 15 }}
                >
                  Send via WhatsApp
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => finalizeJob(jobToComplete!, "sms")}
              >
                <Text style={styles.primaryBtnText}>Send via SMS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => finalizeJob(jobToComplete!, "none")}
              >
                <Text style={styles.secondaryBtnText}>
                  No, just mark as done
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setConfirmModal(false);
                  setDontAskAgain(false);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#131929",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "#A0AEC0",
    marginBottom: 24,
    lineHeight: 22,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  checkboxText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#718096",
  },
  primaryBtn: {
    backgroundColor: "#F6A623",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: {
    fontWeight: "700",
    color: "#0A0F1E",
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: "#1E2A3D",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontWeight: "600",
    color: "#FFFFFF",
    fontSize: 15,
  },
  cancelBtn: {
    padding: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    fontWeight: "500",
    color: "#718096",
    fontSize: 15,
  },
});
