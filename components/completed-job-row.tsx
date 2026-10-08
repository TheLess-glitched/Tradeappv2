import { StyleSheet, Text, View } from "react-native";
import { formatCurrency, CurrencyCode } from "../constants/currency";
import { getStatusStyle, ThemeColors } from "../constants/theme";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Completed",
};

export type CompletedJobRowRecord = {
  id: number;
  customer_name: string | null;
  service: string;
  status: string;
  created_at: string;
  created_by_name: string | null;
  line_total: number | null;
};

export default function CompletedJobRow({
  job,
  colors,
  currency,
  isOwner,
  statusColor,
}: {
  job: CompletedJobRowRecord;
  colors: ThemeColors;
  currency: CurrencyCode;
  isOwner: boolean;
  statusColor?: string;
}) {
  const statusStyles = getStatusStyle(colors, job.status);
  const time = new Date(job.created_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View
      style={[
        styles.recordRow,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.recordMain}>
        <Text style={[styles.recordTitle, { color: colors.text }]}>
          {job.customer_name || job.service}
        </Text>
        <Text style={[styles.recordSubtitle, { color: colors.textMuted }]}>
          {job.service} · {time}
        </Text>
        {isOwner && job.created_by_name ? (
          <Text style={[styles.recordSubtitle, { color: colors.textMuted }]}>
            by {job.created_by_name}
          </Text>
        ) : null}
      </View>
      <View style={styles.recordAside}>
        <Text style={[styles.recordAmount, { color: colors.text }]}>
          {formatCurrency(job.line_total ?? 0, currency)}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusColor
                ? `${statusColor}18`
                : statusStyles.badgeBg,
            },
          ]}
        >
          <Text style={[styles.statusText, { color: statusColor ?? statusStyles.text }]}>
            {STATUS_LABELS[job.status] ?? job.status}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
