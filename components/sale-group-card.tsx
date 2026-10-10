import { describeSaleGroup } from "@/hooks/sale-groups";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CurrencyCode, formatCurrency } from "../constants/currency";
import { plural } from "../constants/plural";
import { ThemeColors } from "../constants/theme";
import { SaleGroup, SaleGroupLine } from "../hooks/sale-groups";


export default function SaleGroupCard<T extends SaleGroupLine>({
  group,
  colors,
  currency,
  isOwner,
  onVoid,
  totalOverride,
  amountLabel,
}: {
  group: SaleGroup<T>;
  colors: ThemeColors;
  currency: CurrencyCode;
  isOwner: boolean;
  onVoid?: (line: T) => void;
  totalOverride?: number;
  amountLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const time = new Date(group.earliestTimestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const title = describeSaleGroup(group);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: group.voided ? 0.58 : 1,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.summary}
        disabled={group.lines.length === 1}
        onPress={() => {
          if (group.lines.length > 1) setExpanded((value) => !value);
        }}
        accessibilityRole={group.lines.length > 1 ? "button" : undefined}
        accessibilityState={{ expanded }}
      >
        <View style={styles.summaryCopy}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {formatCurrency(totalOverride ?? group.total, currency)} · {plural(group.unitCount, "unit")}
          </Text>
          {group.created_by_name ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              by {group.created_by_name}
            </Text>
          ) : null}
        </View>
        <View style={styles.summaryAside}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: group.voided
                  ? `${colors.danger}18`
                  : `${colors.statusDone}18`,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: group.voided ? colors.danger : colors.statusDone },
              ]}
            >
              {amountLabel ?? (group.voided ? "Voided" : "Sold")}
            </Text>
          </View>
          <Text style={[styles.time, { color: colors.textSecondary }]}>{time}</Text>
          {group.lines.length === 1 && isOwner && !group.voided && onVoid ? (
            <TouchableOpacity
              style={styles.voidButton}
              onPress={() => onVoid(group.lines[0])}
              accessibilityRole="button"
              accessibilityLabel={`Void ${group.lines[0].service}`}
            >
              <Text style={[styles.voidText, { color: colors.danger }]}>Void</Text>
            </TouchableOpacity>
          ) : group.lines.length > 1 ? (
            <Text style={[styles.expandLabel, { color: colors.primary }]}>
              {expanded ? "Hide lines" : "View lines"}
            </Text>
          ) : null}
          {group.lines.length === 1 && group.lines[0].voided_at && isOwner ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {group.lines[0].void_reason ?? "Voided"}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={[styles.lines, { borderTopColor: colors.border }]}>
          {group.lines.map((line) => {
            const isVoided = line.voided_at != null;
            return (
              <View
                key={line.id}
                style={[
                  styles.line,
                  { borderBottomColor: colors.border, opacity: isVoided ? 0.65 : 1 },
                ]}
              >
                <View style={styles.lineCopy}>
                  <Text style={[styles.lineName, { color: colors.text }]}>
                    {line.service}
                    {isVoided ? " · Voided" : ""}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    {line.quantity} ×{" "}
                    {(line.unit_price ?? line.price) == null
                      ? "—"
                      : formatCurrency(line.unit_price ?? line.price ?? 0, currency)}
                  </Text>
                  {isOwner ? (
                    <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                      Profit{" "}
                      {(line.unit_price ?? line.price) == null || line.unit_cost == null
                        ? "—"
                        : formatCurrency(
                            line.quantity *
                              ((line.unit_price ?? line.price ?? 0) - line.unit_cost),
                            currency,
                          )}
                    </Text>
                  ) : null}
                  {isVoided && line.void_reason ? (
                    <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                      {line.void_reason}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.lineAside}>
                  <Text
                    style={[
                      styles.lineTotal,
                      { color: colors.text },
                      isVoided && styles.struckThrough,
                    ]}
                  >
                    {formatCurrency(line.line_total ?? 0, currency)}
                  </Text>
                  {isOwner && !isVoided && onVoid ? (
                    <TouchableOpacity
                      style={styles.voidButton}
                      onPress={() => onVoid(line)}
                      accessibilityRole="button"
                      accessibilityLabel={`Void ${line.service}`}
                    >
                      <Text style={[styles.voidText, { color: colors.danger }]}>Void</Text>
                    </TouchableOpacity>
                  ) : null}
                  {isOwner && isVoided && line.voided_at ? (
                    <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                      Voided {new Date(line.voided_at).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, marginBottom: 10, overflow: "hidden" },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  summaryCopy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 15, fontWeight: "700" },
  subtitle: { fontSize: 12, lineHeight: 17 },
  summaryAside: { flexShrink: 0, alignItems: "flex-end", marginLeft: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "700" },
  time: { fontSize: 11, marginTop: 4 },
  expandLabel: { fontSize: 12, fontWeight: "700" },
  lines: { borderTopWidth: 1, paddingHorizontal: 14 },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineCopy: { flex: 1, gap: 3 },
  lineName: { fontSize: 14, fontWeight: "600" },
  lineAside: { alignItems: "flex-end", gap: 4 },
  lineTotal: { fontSize: 13, fontWeight: "700" },
  struckThrough: { textDecorationLine: "line-through" },
  voidButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 8 },
  voidText: { fontSize: 12, fontWeight: "700" },
});
