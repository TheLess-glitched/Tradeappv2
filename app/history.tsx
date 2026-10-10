import { router } from "expo-router";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CompletedJobRow from "../components/completed-job-row";
import SaleGroupCard from "../components/sale-group-card";
import { formatCurrency } from "../constants/currency";
import { plural } from "../constants/plural";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";
import { groupSaleRows } from "../hooks/sale-groups";
import { useRevenueHistory } from "../hooks/use-revenue-history";
import type { TodayRecord } from "../hooks/use-todays-jobs";

function getDateFromDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

function getNextMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

type WeekRange = {
  key: string;
  startDay: string;
  endDay: string;
  label: string;
};

function getMonthWeeks(year: number, month: number): WeekRange[] {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const firstWeekMonday = 1 - ((firstWeekday + 6) % 7);
  const monthName = new Intl.DateTimeFormat("en", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const ranges: WeekRange[] = [];

  for (let weekStart = firstWeekMonday; weekStart <= lastDay; weekStart += 7) {
    const start = Math.max(1, weekStart);
    const end = Math.min(lastDay, weekStart + 6);
    const startDay = `${year}-${String(month).padStart(2, "0")}-${String(start).padStart(2, "0")}`;
    const endDay = `${year}-${String(month).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
    ranges.push({
      key: `${startDay}:${endDay}`,
      startDay,
      endDay,
      label: `${monthName} ${start}–${end}`,
    });
  }

  return ranges;
}

export default function HistoryScreen() {
  const { colors, currency } = useTheme();
  const { role } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const { rows, loading, error, dayRecords, loadingDays, fetchDayRecords } =
    useRevenueHistory(selectedMonth.year, selectedMonth.month);
  const weeks = useMemo(
    () => getMonthWeeks(selectedMonth.year, selectedMonth.month),
    [selectedMonth],
  );
  const selectedWeek =
    weeks.find((week) => week.key === selectedWeekKey) ?? null;
  const filteredRows = useMemo(
    () =>
      selectedWeek
        ? rows.filter(
            (row) =>
              row.day >= selectedWeek.startDay && row.day <= selectedWeek.endDay,
          )
        : rows,
    [rows, selectedWeek],
  );
  const isCurrentMonth =
    selectedMonth.year === now.getFullYear() &&
    selectedMonth.month === now.getMonth() + 1;

  useEffect(() => {
    if (role !== "owner") router.replace("/(tabs)/home");
  }, [role]);

  const monthTitle = useMemo(
    () =>
      new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(
        new Date(selectedMonth.year, selectedMonth.month - 1, 1),
      ),
    [selectedMonth],
  );
  const summary = filteredRows.reduce(
    (totals, row) => ({
      revenue: totals.revenue + row.revenue,
      profit: totals.profit + row.profit,
      sales: totals.sales + row.sales_revenue,
      jobs: totals.jobs + row.jobs_revenue,
      unknownCosts: totals.unknownCosts + row.unknown_cost_count,
    }),
    { revenue: 0, profit: 0, sales: 0, jobs: 0, unknownCosts: 0 },
  );

  const changeMonth = (delta: number) => {
    setSelectedMonth((current) =>
      getNextMonth(current.year, current.month, delta),
    );
    setSelectedWeekKey(null);
    setExpandedDay(null);
  };

  const selectWeek = (weekKey: string | null) => {
    setSelectedWeekKey(weekKey);
    setExpandedDay(null);
  };

  const toggleDay = (day: string) => {
    if (expandedDay === day) {
      setExpandedDay(null);
      return;
    }
    setExpandedDay(day);
    if (!dayRecords[day]) void fetchDayRecords(day);
  };

  if (role !== "owner") return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Revenue History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.monthPicker}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          onPress={() => changeMonth(-1)}
          style={styles.monthArrow}
        >
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: colors.text }]}>{monthTitle}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityState={{ disabled: isCurrentMonth }}
          disabled={isCurrentMonth}
          onPress={() => changeMonth(1)}
          style={[styles.monthArrow, isCurrentMonth && styles.disabledArrow]}
        >
          <ChevronRight
            size={22}
            color={isCurrentMonth ? colors.textMuted : colors.text}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        style={styles.weekRow}
        contentContainerStyle={styles.weekChips}
        showsHorizontalScrollIndicator={false}
      >
        {[
          { key: null, label: "Whole month" },
          ...weeks.map((week) => ({ key: week.key, label: week.label })),
        ].map((week) => {
          const selected = week.key === selectedWeekKey;
          return (
            <TouchableOpacity
              key={week.key ?? "whole-month"}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => selectWeek(week.key)}
              style={[
                styles.weekChip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.weekChipText,
                  { color: selected ? colors.primaryText : colors.textSecondary },
                ]}
              >
                {week.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {selectedWeek ? (
        <Text style={[styles.weekCaption, { color: colors.textMuted }]}>
          Showing {selectedWeek.label}
        </Text>
      ) : null}

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading revenue history...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryGrid}>
            {[
              ["Revenue", summary.revenue],
              ["Profit", summary.profit],
              ["Sales", summary.sales],
              ["Jobs", summary.jobs],
            ].map(([label, amount]) => (
              <View
                key={label}
                style={[
                  styles.summaryCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                  {label}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {formatCurrency(Number(amount), currency)}
                </Text>
                {label === "Profit" && summary.unknownCosts > 0 ? (
                  <Text style={[styles.costNote, { color: colors.textMuted }]}>
                    {summary.unknownCosts === 1
                      ? "1 item has no cost and is not counted"
                      : `${summary.unknownCosts} items have no cost and are not counted`}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {filteredRows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {error
                  ? "Couldn't load history"
                  : selectedWeek
                    ? "No sales or jobs in this period"
                    : "No sales or jobs this month"}
              </Text>
              {error ? (
                <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
                  Try again when you have a connection.
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={styles.days}>
              {filteredRows.map((row) => {
                const date = getDateFromDay(row.day);
                const dayTitle = new Intl.DateTimeFormat("en", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                }).format(date);
                const expanded = expandedDay === row.day;
                const records = dayRecords[row.day] ?? [];
                const saleGroups = groupSaleRows(
                  records.filter((record) => record.record_type === "sale"),
                );
                const dayEntries = [
                  ...records
                    .filter((record) => record.record_type === "job")
                    .map((record) => ({
                      kind: "job" as const,
                      record,
                      key: `job:${record.id}`,
                      timestamp: record.created_at,
                    })),
                  ...saleGroups.map((group) => ({
                    kind: "sale" as const,
                    group,
                    key: group.id,
                    timestamp: group.earliestTimestamp,
                  })),
                ].sort(
                  (left, right) =>
                    new Date(right.timestamp).getTime() -
                    new Date(left.timestamp).getTime(),
                );

                return (
                  <View
                    key={row.day}
                    style={[
                      styles.dayCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      onPress={() => toggleDay(row.day)}
                      style={styles.dayHeader}
                    >
                      <View style={styles.dayCopy}>
                        <Text style={[styles.dayTitle, { color: colors.text }]}>
                          {dayTitle}
                        </Text>
                        <Text style={[styles.dayCounts, { color: colors.textMuted }]}>
                          {plural(row.sales_count, "sale")} · {plural(row.jobs_count, "job")}
                        </Text>
                      </View>
                      <View style={styles.dayAside}>
                        <Text style={[styles.dayRevenue, { color: colors.text }]}>
                          {formatCurrency(row.revenue, currency)}
                        </Text>
                        {expanded ? (
                          <ChevronUp size={18} color={colors.textMuted} />
                        ) : (
                          <ChevronDown size={18} color={colors.textMuted} />
                        )}
                      </View>
                    </TouchableOpacity>
                    {expanded ? (
                      <View style={[styles.dayDetails, { borderTopColor: colors.border }]}>
                        {loadingDays[row.day] ? (
                          <ActivityIndicator
                            style={styles.dayLoading}
                            color={colors.primary}
                          />
                        ) : dayEntries.length === 0 ? (
                          <Text style={[styles.emptyDay, { color: colors.textMuted }]}>
                            No records for this day
                          </Text>
                        ) : (
                          dayEntries.map((entry) => {
                            if (entry.kind === "job") {
                              return (
                                <CompletedJobRow
                                  key={entry.key}
                                  job={entry.record}
                                  colors={colors}
                                  currency={currency}
                                  isOwner
                                />
                              );
                            }
                            if (entry.group.lines.length > 1) {
                              return (
                                <SaleGroupCard
                                  key={entry.key}
                                  group={entry.group}
                                  colors={colors}
                                  currency={currency}
                                  isOwner
                                />
                              );
                            }
                            const sale = entry.group.lines[0] as TodayRecord;
                            return (
                              <View
                                key={entry.key}
                                style={[
                                  styles.saleRow,
                                  {
                                    backgroundColor: colors.surface,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                <View style={styles.saleMain}>
                                  <Text style={[styles.saleTitle, { color: colors.text }]}>
                                    {sale.customer_name || sale.service}
                                  </Text>
                                  <Text
                                    style={[styles.saleSubtitle, { color: colors.textMuted }]}
                                  >
                                    {sale.service} ·{" "}
                                    {new Date(sale.created_at).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.saleSubtitle,
                                      { color: colors.textSecondary },
                                    ]}
                                  >
                                    Quantity {sale.quantity}
                                  </Text>
                                  {sale.created_by_name ? (
                                    <Text
                                      style={[
                                        styles.saleSubtitle,
                                        { color: colors.textMuted },
                                      ]}
                                    >
                                      by {sale.created_by_name}
                                    </Text>
                                  ) : null}
                                </View>
                                <Text style={[styles.saleAmount, { color: colors.text }]}>
                                  {formatCurrency(sale.line_total ?? 0, currency)}
                                </Text>
                              </View>
                            );
                          })
                        )}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
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
    paddingBottom: 12,
    gap: 12,
  },
  backButton: { width: 36, height: 40, justifyContent: "center" },
  title: { flex: 1, fontSize: 20, fontWeight: "700" },
  headerSpacer: { width: 36 },
  monthPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  monthArrow: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  disabledArrow: { opacity: 0.45 },
  monthTitle: { fontSize: 17, fontWeight: "700" },
  weekRow: { flexGrow: 0, flexShrink: 0 },
  weekChips: { paddingHorizontal: 20, gap: 8, paddingBottom: 4, alignItems: "center" },
  weekChip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  weekChipText: { fontSize: 12, fontWeight: "600" },
  weekCaption: { fontSize: 12, paddingHorizontal: 20, paddingTop: 5, paddingBottom: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 36 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14 },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  summaryCard: {
    width: "48%",
    minHeight: 82,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  summaryLabel: { fontSize: 12, marginBottom: 5 },
  summaryValue: { fontSize: 19, fontWeight: "700" },
  costNote: { fontSize: 10, lineHeight: 14, marginTop: 5 },
  emptyState: { alignItems: "center", gap: 8, padding: 24 },
  emptyTitle: { fontSize: 15, fontWeight: "600", textAlign: "center" },
  emptyMessage: { fontSize: 13, textAlign: "center" },
  days: { gap: 10 },
  dayCard: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dayCopy: { flex: 1, gap: 4 },
  dayTitle: { fontSize: 14, fontWeight: "700" },
  dayCounts: { fontSize: 12 },
  dayAside: { alignItems: "flex-end", gap: 5 },
  dayRevenue: { fontSize: 14, fontWeight: "700" },
  dayDetails: { borderTopWidth: 1, padding: 12 },
  dayLoading: { paddingVertical: 16 },
  emptyDay: { fontSize: 13, paddingVertical: 12, textAlign: "center" },
  saleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  saleMain: { flex: 1, minWidth: 0 },
  saleTitle: { fontSize: 14, fontWeight: "700" },
  saleSubtitle: { fontSize: 12, marginTop: 3 },
  saleAmount: { fontSize: 14, fontWeight: "700" },
});
