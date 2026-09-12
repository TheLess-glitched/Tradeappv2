import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
    Calendar,
    CheckSquare,
    Clock,
    FileText,
    Square,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    FlatList,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { formatCurrency } from "../../constants/currency";
import { supabase } from "../../constants/supabase";
import { getStatusStyle, ThemeColors } from "../../constants/theme";
import { useAuth } from "../../context/auth-context";
import { useTheme } from "../../context/theme-context";

type Job = {
  id: number;
  customer_name: string | null;
  customer_phone?: string | null;
  service: string;
  price: number;
  date: string;
  time: string;
  notes: string;
  status: "pending" | "in_progress" | "done";
  created_at: string;
};

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
};

function FilterHeader({
  colors,
  filter,
  onFilterChange,
}: {
  colors: ThemeColors;
  filter: "all" | "pending" | "in_progress" | "done";
  onFilterChange: (value: "all" | "pending" | "in_progress" | "done") => void;
}) {
  return (
    <View style={styles.filterRow}>
      {(["all", "pending", "in_progress", "done"] as const).map((status) => {
        const isActive = filter === status;
        return (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterTab,
              {
                backgroundColor: isActive ? colors.primary : colors.surface,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
            onPress={() => onFilterChange(status)}
          >
            <Text
              style={[
                styles.filterTabText,
                {
                  color: isActive ? colors.primaryText : colors.textSecondary,
                  fontWeight: isActive ? "700" : "500",
                },
              ]}
            >
              {status === "all" ? "All" : STATUS_LABELS[status]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function JobsScreen() {
  const { colors, currency } = useTheme();
  const { session, isSessionReady } = useAuth();
  const { completedJobId } = useLocalSearchParams<{ completedJobId?: string }>();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "done"
  >("all");
  const [confirmModal, setConfirmModal] = useState(false);
  const [jobToComplete, setJobToComplete] = useState<Job | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const lastPromptedIdRef = useRef<string | null>(null);
  const filterRef = useRef(filter);
  const colorsRef = useRef(colors);
  filterRef.current = filter;
  colorsRef.current = colors;

  const fetchJobs = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("user_id", session?.user?.id)
        .order("created_at", { ascending: false });

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

  useFocusEffect(
    useCallback(() => {
      if (!isSessionReady || !session?.user?.id) {
        return;
      }

      fetchJobs();
    }, [fetchJobs, isSessionReady, session?.user?.id]),
  );

  useEffect(() => {
    if (isSessionReady && session?.user?.id) {
      fetchJobs();
    }
  }, [isSessionReady, session?.user?.id, fetchJobs]);

  useEffect(() => {
    if (!completedJobId || lastPromptedIdRef.current === completedJobId) {
      return;
    }

    const completedJob = jobs.find((job) => String(job.id) === completedJobId);
    if (completedJob?.status === "done") {
      lastPromptedIdRef.current = completedJobId;
      setJobToComplete(completedJob);
      setConfirmModal(true);
    }
  }, [completedJobId, jobs]);

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
    // Only pending and in_progress jobs can be updated; done jobs are finalized
    if (job.status === "done") {
      return;
    }

    if (job.status === "pending") {
      Alert.alert(
        "Update Status",
        'Change status to "In Progress"?',
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Update",
            onPress: () => updateStatus(job.id, "in_progress"),
          },
        ],
      );
    } else if (job.status === "in_progress") {
      // Open modal to choose messaging option to finalize
      setJobToComplete(job);
      setConfirmModal(true);
    }
  };

  const finalizeJob = async (job: Job, method: "sms" | "whatsapp" | "none") => {
    await updateStatus(job.id, "done");

    if (method !== "none") {
      const savedSettings = await AsyncStorage.getItem("business_settings");
      let template = "Hi {name}, your job is completed and ready!";
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          if (parsed.completionMessage) {
            template = parsed.completionMessage;
          }
        } catch {
          // fallback to default template if parsing fails
        }
      }
      const customerDisplayName = job.customer_name || "Walk-in Customer";
      const personalizedMessage = template.replace("{name}", customerDisplayName);

      // 1. Read phone number directly from the job object
      let phoneToText = "";
      if (job.customer_phone) {
        phoneToText = job.customer_phone.replace(/\D/g, "");
      }

      // 2. Fallback to customers table only if necessary
      if (!phoneToText && job.customer_name) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("phone")
          .eq("name", job.customer_name)
          .limit(1)
          .single();

        if (customerData?.phone) {
          phoneToText = customerData.phone.replace(/\D/g, "");
        }
      }

      // 3. Check if phone number is completely missing
      if (!phoneToText) {
        Alert.alert(
          "Missing Phone Number",
          `No phone number found for ${customerDisplayName}. Could not send message.`,
        );
        setConfirmModal(false);
        setJobToComplete(null);
        return;
      }

      // 4. Format phone number (convert legacy leading 0 to 234, otherwise keep saved international number)
      const cleanNumber = phoneToText.replace(/\D/g, "");

      try {
        if (method === "whatsapp") {
          const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(personalizedMessage)}`;
          await Linking.openURL(url);
        } else {
          // Standard SMS
          const smsUrl = `sms:${cleanNumber}?body=${encodeURIComponent(personalizedMessage)}`;
          await Linking.openURL(smsUrl);
        }
      } catch {
        Alert.alert(
          "Error",
          `Could not open ${method === "whatsapp" ? "WhatsApp" : "SMS app"}.`,
        );
      }
    }

    setConfirmModal(false);
    setJobToComplete(null);
  };

  const filtered =
    filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  const renderFilterHeader = useCallback(
    () => (
      <FilterHeader
        colors={colorsRef.current}
        filter={filterRef.current}
        onFilterChange={setFilter}
      />
    ),
    [],
  );

  const renderJobItem = useCallback(({ item: job }: { item: Job }) => {
    const statusStyles = getStatusStyle(colors, job.status);

    return (
      <View
        style={[
          styles.jobCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.jobTop}>
          <View style={styles.jobLeft}>
            <Text style={[styles.jobCustomer, { color: colors.text }]}>
              {job.customer_name || "Walk-in Customer"}
            </Text>
            <Text style={[styles.jobService, { color: colors.textSecondary }]}>
              {job.service}
            </Text>
          </View>
          <Text style={[styles.jobPrice, { color: colors.text }]}>
            {formatCurrency(job.price || 0, currency)}
          </Text>
        </View>

        <View style={styles.jobMeta}>
          {job.date ? (
            <View style={styles.metaRow}>
              <Calendar size={13} color={colors.textMuted} />
              <Text style={[styles.jobMetaText, { color: colors.textMuted }]}>
                {job.date}
              </Text>
            </View>
          ) : null}
          {job.time ? (
            <View style={styles.metaRow}>
              <Clock size={13} color={colors.textMuted} />
              <Text style={[styles.jobMetaText, { color: colors.textMuted }]}>
                {job.time}
              </Text>
            </View>
          ) : null}
          {job.notes ? (
            <View style={styles.metaRow}>
              <FileText size={13} color={colors.textMuted} />
              <Text
                style={[styles.jobMetaText, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {job.notes}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.jobFooter}>
          {job.status === "done" ? (
            <View
              style={[
                styles.statusBadge,
                styles.finalizedBadge,
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
                Done
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.statusBadge,
                { backgroundColor: statusStyles.badgeBg },
              ]}
              onPress={() => cycleStatus(job)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
                {STATUS_LABELS[job.status]}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteJob(job.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.deleteText, { color: colors.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [colors, cycleStatus, deleteJob]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>All Jobs</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/new-job" as any)}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.addButtonText, { color: colors.primaryText }]}>+ New</Text>
        </TouchableOpacity>
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
              <View style={[styles.skeletonLine, { width: "52%", backgroundColor: colors.border }]} />
              <View style={[styles.skeletonLine, { width: "34%", backgroundColor: colors.border }]} />
              <View style={[styles.skeletonLine, { width: "70%", backgroundColor: colors.border }]} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderJobItem}
          ListHeaderComponent={renderFilterHeader}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <FileText size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>No jobs yet</Text>
              <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                Tap + New to add your first job
              </Text>
            </View>
          )}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}

      <Modal visible={confirmModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.modalBackground,
                borderColor: colors.modalBorder,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Job Completed!
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Would you like to send a completion text message to{" "}
              {jobToComplete?.customer_name || "Walk-in Customer"}?
            </Text>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setDontAskAgain(!dontAskAgain)}
              activeOpacity={0.7}
            >
              {dontAskAgain ? (
                <CheckSquare size={20} color={colors.primary} />
              ) : (
                <Square size={20} color={colors.textMuted} />
              )}
              <Text style={[styles.checkboxText, { color: colors.textMuted }]}>
                Do not ask me again (Disabled for testing)
              </Text>
            </TouchableOpacity>

            <View style={{ gap: 12 }}>
              {jobToComplete?.customer_phone ? (
                <>
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
                    style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                    onPress={() => finalizeJob(jobToComplete!, "sms")}
                  >
                    <Text style={[styles.primaryBtnText, { color: colors.primaryText }]}> 
                      Send via SMS
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: colors.secondarySurface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => finalizeJob(jobToComplete!, "none")}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.secondaryText }]}>
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
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", flex: 1 },
  addButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: { fontSize: 14, fontWeight: "700" },
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
    alignItems: "center",
    borderWidth: 1,
  },
  filterTabText: { fontSize: 11 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  jobCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  jobTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  jobLeft: { flex: 1, marginRight: 12 },
  jobCustomer: { fontSize: 15, fontWeight: "700" },
  jobService: { fontSize: 13, marginTop: 2 },
  jobPrice: { fontSize: 16, fontWeight: "800" },
  jobMeta: { gap: 6, marginBottom: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  jobMetaText: { fontSize: 12 },
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
  finalizedBadge: {
    opacity: 0.9,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "600" },
  deleteButton: { paddingHorizontal: 12, paddingVertical: 6 },
  deleteText: { fontSize: 12, fontWeight: "600" },
  skeletonList: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  skeletonCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  skeletonLine: { height: 12, borderRadius: 6 },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubText: { fontSize: 13, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalSubtitle: {
    fontSize: 15,
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
  },
  primaryBtn: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  primaryBtnText: {
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryBtn: {
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontWeight: "600",
    fontSize: 15,
  },
  cancelBtn: {
    padding: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    fontWeight: "500",
    fontSize: 15,
  },
});
