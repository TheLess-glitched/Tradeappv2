import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Calendar,
  CheckSquare,
  Clock,
  FileText,
  Square,
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { showFeedback, showToast } from "../../components/app-feedback";
import VoidRecordDialog from "../../components/void-record-dialog";
import { formatCurrency } from "../../constants/currency";
import { isNetworkError } from "../../constants/network-error";
import { enqueueStatus, OutboxItem, removeOutbox, retryOutbox } from "../../constants/outbox";
import { normalizePhone } from "../../constants/phone";
import { customerPhoneByNameQuery, jobsListQuery } from "../../constants/queries";
import { supabase } from "../../constants/supabase";
import { getStatusStyle, ThemeColors } from "../../constants/theme";
import { useAuth } from "../../context/auth-context";
import { useTheme } from "../../context/theme-context";
import { useOutbox } from "../../hooks/use-outbox";
;

type Job = {
  id: number;
  customer_name: string | null;
  customer_phone?: string | null;
  service: string;
  record_type: "job";
  line_total: number | null;
  date: string;
  time: string;
  notes: string;
  status: "pending" | "in_progress" | "done";
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

type ListJob = Job & {
  statusQueued?: boolean;
  statusProblem?: { id: string; error: string | null };
  key: string;
  outboxId?: string;
  waiting?: "pending" | "needs_attention";
  error?: string | null;
};

const STATUS_LABELS = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Completed",
};

function FilterHeader({
  colors,
  filter,
  onFilterChange,
  isOwner,
}: {
  colors: ThemeColors;
  filter: "all" | "pending" | "in_progress" | "done" | "voided";
  onFilterChange: (value: "all" | "pending" | "in_progress" | "done" | "voided") => void;
  isOwner: boolean;
}) {
  return (
    <View style={styles.filterRow}>
      {(isOwner
        ? (["all", "pending", "in_progress", "done", "voided"] as const)
        : (["all", "pending", "in_progress", "done"] as const)
      ).map((status) => {
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
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {status === "all" ? "All" : status === "voided" ? "Voided" : STATUS_LABELS[status]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function JobsScreen() {
  const { colors, currency } = useTheme();
  const { session, isSessionReady, businessId, role } = useAuth();
  const isOwner = role === "owner";
  const isWorker = role === "worker";
  const { completedJobId } = useLocalSearchParams<{ completedJobId?: string }>();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);
  const [filter, setFilter] = useState<
    "all" | "pending" | "in_progress" | "done" | "voided"
  >("all");
  const [confirmModal, setConfirmModal] = useState(false);
  const [jobToComplete, setJobToComplete] = useState<Job | null>(null);
  const [jobToVoid, setJobToVoid] = useState<Job | null>(null);
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
      const { data, error } = await jobsListQuery(businessId);

      if (error) throw error;

      setJobs(data ?? []);
      hasDataRef.current = (data?.length ?? 0) > 0;
    } catch (err) {
      setJobs([]);
      hasDataRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [businessId]);

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

  const outbox = useOutbox(session?.user?.id, businessId);
  const waitingJobItems = outbox.filter(
    (item): item is Extract<OutboxItem, { kind: "job" }> => item.kind === "job",
  );

  // When a waiting job syncs, reload so the real row replaces the tagged one.
  const waitingJobCount = outbox.filter(
    (item) => item.kind === "job" || item.kind === "status",
  ).length;
  const prevWaitingRef = useRef(0);
  useEffect(() => {
    if (waitingJobCount < prevWaitingRef.current) void fetchJobs();
    prevWaitingRef.current = waitingJobCount;
  }, [waitingJobCount, fetchJobs]);
  const getUsablePhoneForJob = useCallback(
    async (job: Job): Promise<string | null> => {
      if (job.customer_phone) {
        const normalized = normalizePhone(job.customer_phone);
        if (normalized) return normalized;
      }

      const customerName = job.customer_name?.trim();
      if (customerName) {
        try {
          const { data: customerData } = await customerPhoneByNameQuery(
            businessId,
            customerName,
          );

          if (customerData?.phone) {
            const normalized = normalizePhone(customerData.phone);
            if (normalized) return normalized;
          }
        } catch {
          // Fallback if lookup encounters any issue
        }
      }

      return null;
    },
    [businessId],
  );

  useEffect(() => {
    if (!completedJobId || lastPromptedIdRef.current === completedJobId) {
      return;
    }

    const completedJob = jobs.find((job) => String(job.id) === completedJobId);
    if (
      completedJob?.record_type === "job" &&
      completedJob.status === "done" &&
      !completedJob.voided_at
    ) {
      lastPromptedIdRef.current = completedJobId;
      getUsablePhoneForJob(completedJob).then((usablePhone) => {
        if (usablePhone) {
          setJobToComplete({
            ...completedJob,
            customer_phone: usablePhone,
          });
          setConfirmModal(true);
        }
      });
    }
  }, [completedJobId, jobs, getUsablePhoneForJob]);

    const updateStatus = async (
    id: number,
    newStatus: "pending" | "in_progress" | "done",
  ) => {
    const { error } = await supabase
      .from("jobs")
      .update({ status: newStatus })
      .eq("id", id)
      .eq("business_id", businessId)
      .eq("record_type", "job")
      .is("voided_at", null);
    if (error) {
      const code = (error as { code?: string }).code;
      if (
        newStatus !== "pending" &&
        !code &&
        isNetworkError(error) &&
        session?.user?.id &&
        businessId
      ) {
        try {
          await enqueueStatus({
            id: Crypto.randomUUID(),
            businessId,
            userId: session.user.id,
            payload: { jobId: id, newStatus },
          });
          return true;
        } catch (queueError) {
          showFeedback(
            "Couldn't save the change",
            queueError instanceof Error ? queueError.message : "Please try again.",
          );
          return false;
        }
      }
      showFeedback("Error", error.message);
      return false;
    } else {
      fetchJobs();
      return true;
    }
  };

  const cycleStatus = async (job: Job) => {
    if (job.record_type !== "job" || job.voided_at) return;

    // Only pending and in_progress jobs can be updated; done jobs are finalized
    if (job.status === "done") {
      return;
    }

    if (job.status === "pending") {
      showFeedback(
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
      const usablePhone = await getUsablePhoneForJob(job);
      if (!usablePhone) {
        const success = await updateStatus(job.id, "done");
        if (success) {
          showToast("Job marked as completed");
        }
      } else {
        setJobToComplete({
          ...job,
          customer_phone: usablePhone,
        });
        setConfirmModal(true);
      }
    }
  };

  const finalizeJob = async (job: Job, method: "sms" | "whatsapp" | "none") => {
    const success = await updateStatus(job.id, "done");
    if (!success) {
      setConfirmModal(false);
      setJobToComplete(null);
      return;
    }

    if (method === "none") {
      showToast("Job marked as completed");
    } else {
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

      const usablePhone = await getUsablePhoneForJob(job);

      if (!usablePhone) {
        showFeedback(
          "Missing Phone Number",
          `No phone number found for ${customerDisplayName}. Could not send message.`,
        );
        setConfirmModal(false);
        setJobToComplete(null);
        return;
      }

      const cleanNumber = usablePhone.replace(/\D/g, "");

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
        showFeedback(
          "Error",
          `Could not open ${method === "whatsapp" ? "WhatsApp" : "SMS app"}.`,
        );
      }
    }

    setConfirmModal(false);
    setJobToComplete(null);
  };

  // Status changes made offline show straight away, with a note, until they sync.
  const queuedStatus: Record<number, "in_progress" | "done"> = {};
  const statusProblems: Record<number, { id: string; error: string | null }> = {};
  for (const item of outbox) {
    if (item.kind !== "status") continue;
    const jobId = item.payload.jobId;
    if (item.status === "needs_attention") {
      statusProblems[jobId] = { id: item.id, error: item.error };
    } else if (!queuedStatus[jobId] || item.payload.newStatus === "done") {
      queuedStatus[jobId] = item.payload.newStatus;
    }
  }
  const rank = (status: string) => (status === "done" ? 2 : status === "in_progress" ? 1 : 0);
  const displayJobs = jobs.map((job) => {
    const queued = queuedStatus[job.id];
    return queued && rank(queued) > rank(job.status) ? { ...job, status: queued } : job;
  });

  const filtered = displayJobs.filter((job) =>
    filter === "voided"
      ? job.voided_at != null
      : !job.voided_at && (filter === "all" || job.status === filter),
  );

  // Waiting jobs are pending, so they only belong under "All" and "Pending".
  const waitingListJobs: ListJob[] =
    filter === "all" || filter === "pending"
      ? waitingJobItems.map((item, index) => {
          const when = new Date(item.occurredAt);
          return {
            key: `q-${item.id}`,
            id: -(index + 1),
            customer_name: item.payload.customerName,
            customer_phone: item.payload.customerPhone,
            service: item.payload.service,
            record_type: "job" as const,
            line_total: item.payload.price,
            date: when.toLocaleDateString("en-GB"),
            time: when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
            notes: item.payload.notes,
            status: "pending" as const,
            created_at: item.occurredAt,
            created_by: session?.user?.id ?? null,
            created_by_name: null,
            voided_at: null,
            void_reason: null,
            outboxId: item.id,
            waiting: item.status,
            error: item.error,
          };
        })
      : [];
  const listData: ListJob[] = [
    ...waitingListJobs,
    ...filtered.map((job) => ({
      ...job,
      key: `j-${job.id}`,
      statusQueued: queuedStatus[job.id] !== undefined && queuedStatus[job.id] === job.status,
      statusProblem: statusProblems[job.id],
    })),
  ];

  const renderFilterHeader = useCallback(
    () => (
      <FilterHeader
        colors={colorsRef.current}
        filter={filterRef.current}
        onFilterChange={setFilter}
        isOwner={isOwner}
      />
    ),
    [isOwner],
  );

  const renderJobItem = useCallback(({ item: job }: { item: ListJob }) => {
    const isVoided = job.voided_at != null;
    const statusStyles = getStatusStyle(colors, job.status);

    return (
      <View
        style={[
          styles.jobCard,
          isVoided && styles.voidedCard,
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
          <Text
            style={[
              styles.jobPrice,
              isVoided && styles.voidedAmount,
              { color: colors.text },
            ]}
          >
            {formatCurrency(job.line_total ?? 0, currency)}
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
          {job.statusQueued ? (
            <View style={styles.metaRow}>
              <Clock size={13} color={colors.textMuted} />
              <Text style={[styles.jobMetaText, { color: colors.textMuted }]}>
                Status change waiting to sync
              </Text>
            </View>
          ) : null}
          {isOwner && job.created_by_name ? (
            <Text style={[styles.jobMetaText, { color: colors.textMuted }]}>
              by {job.created_by_name}
            </Text>
          ) : null}
          {isVoided ? (
            <>
              <View style={styles.metaRow}>
                <Clock size={13} color={colors.textMuted} />
                <Text style={[styles.jobMetaText, { color: colors.textMuted }]}>
                  Voided {new Date(job.voided_at!).toLocaleString()}
                </Text>
              </View>
              <Text style={[styles.voidReason, { color: colors.textMuted }]}>
                Reason: {job.void_reason}
              </Text>
            </>
          ) : null}
        </View>
          {job.waiting === "needs_attention" ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.voidReason, { color: colors.dangerText }]}>
              Not saved: {job.error ?? "The server rejected this job."}
              </Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.deleteButton, { borderWidth: 1, borderRadius: 8, borderColor: colors.border }]}
                  onPress={() => job.outboxId && void retryOutbox(job.outboxId)}
                >
                  <Text style={[styles.deleteText, { color: colors.text }]}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteButton, { borderWidth: 1, borderRadius: 8, borderColor: colors.danger }]}
                  onPress={() => job.outboxId && void removeOutbox(job.outboxId)}
                >
                  <Text style={[styles.deleteText, { color: colors.danger }]}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

        {job.statusProblem ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.voidReason, { color: colors.dangerText }]}>
              Status change not saved: {job.statusProblem.error ?? "The server rejected it."}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.deleteButton, { borderWidth: 1, borderRadius: 8, borderColor: colors.border }]}
                onPress={() => job.statusProblem && void retryOutbox(job.statusProblem.id)}
              >
                <Text style={[styles.deleteText, { color: colors.text }]}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteButton, { borderWidth: 1, borderRadius: 8, borderColor: colors.danger }]}
                onPress={() => job.statusProblem && void removeOutbox(job.statusProblem.id)}
              >
                <Text style={[styles.deleteText, { color: colors.danger }]}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        
        <View style={styles.jobFooter}>
          {job.waiting ? (
            <View style={[styles.statusBadge, { backgroundColor: colors.surfaceSubtle }]}>
              <Clock size={13} color={colors.textMuted} />
              <Text style={[styles.statusText, { color: colors.textMuted }]}>
                {job.waiting === "pending" ? "Waiting to sync" : "Not saved"}
              </Text>
            </View>
          ) : isVoided ? (
            <View style={[styles.statusBadge, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={[styles.statusText, { color: colors.textMuted }]}>Voided</Text>
            </View>
          ) : job.status === "done" ? (
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
                Completed
              </Text>
            </View>
          ) : !isWorker || job.created_by === session?.user?.id ? (
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
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: statusStyles.badgeBg }]}>
              <View style={[styles.statusDot, { backgroundColor: statusStyles.dot }]} />
              <Text style={[styles.statusText, { color: statusStyles.text }]}>
                {STATUS_LABELS[job.status]}
              </Text>
            </View>
          )}
            {isOwner && !isVoided && !job.waiting ? (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => setJobToVoid(job)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.deleteText, { color: colors.danger }]}>Void</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }, [colors, currency, cycleStatus, isOwner, isWorker, session?.user?.id]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Jobs</Text>
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
          data={listData}
          keyExtractor={(item) => item.key}
          renderItem={renderJobItem}
          ListHeaderComponent={renderFilterHeader}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <FileText size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>No records found</Text>
              <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                Try another filter or add a job or sale
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
      {isOwner ? <VoidRecordDialog
        visible={jobToVoid != null}
        recordLabel="job"
        userId={session?.user?.id ?? null}
        onCancel={() => setJobToVoid(null)}
        onConfirm={async (reason) => {
          if (!jobToVoid) return true;
          try {
            const { data, error } = await supabase.rpc("void_job", {
              p_job_id: jobToVoid.id,
              p_reason: reason,
            });
            if (error) {
              showToast("Void failed", error.message);
              return false;
            }
            const result = Array.isArray(data) ? data[0] : data;
            if (!result || typeof result.voided !== "boolean") {
              showToast("Void failed", "The server returned an invalid result.");
              return false;
            }
            if (result.voided === false) {
              showToast("Already voided", "This job has already been voided.");
            } else {
              showToast("Job voided", "The job remains in your voided records.");
            }
            await fetchJobs();
            return true;
          } catch (error) {
            showToast(
              "Void failed",
              error instanceof Error ? error.message : "Please try again.",
            );
            return false;
          }
        }}
      /> : null}
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
  voidedCard: { opacity: 0.58 },
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
  voidedAmount: { textDecorationLine: "line-through" },
  jobMeta: { gap: 6, marginBottom: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  jobMetaText: { fontSize: 12 },
  voidReason: { fontSize: 12, fontStyle: "italic" },
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
