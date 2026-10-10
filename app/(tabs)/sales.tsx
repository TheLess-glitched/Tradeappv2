import { router, useFocusEffect } from "expo-router";
import { Plus, ShoppingCart } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { showFeedback, showToast } from "../../components/app-feedback";
import SaleGroupCard from "../../components/sale-group-card";
import VoidRecordDialog from "../../components/void-record-dialog";
import { plural } from "../../constants/plural";
import { supabase } from "../../constants/supabase";
import { useAuth } from "../../context/auth-context";
import { useTheme } from "../../context/theme-context";
import { groupSaleRows } from "../../hooks/sale-groups";
type Sale = {
  id: number;
  service: string;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
  price: number;
  line_total: number | null;
  catalogue_item_id: string | null;
  date: string;
  time: string;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  sale_group_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

export default function SalesScreen() {
  const { colors, currency } = useTheme();
  const { session, isSessionReady, businessId, role } = useAuth();
  const isOwner = role === "owner";
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "voided">("all");
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);

  const fetchSales = useCallback(async () => {
    const userId = session?.user?.id;
    if (!isSessionReady || !userId) {
      setSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const pageSize = 500;
    const allSales: Sale[] = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("jobs")
        .select("id, service, quantity, unit_price, unit_cost, price, line_total, catalogue_item_id, date, time, created_at, created_by, created_by_name, sale_group_id, voided_at, void_reason")
        .eq("business_id", businessId)
        .eq("record_type", "sale")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) {
        showFeedback("Error", error.message);
        setSales([]);
        setLoading(false);
        return;
      }

      allSales.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) break;
      offset += pageSize;
    }
    setSales(allSales);
    setLoading(false);
  }, [businessId, isSessionReady, session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchSales();
    }, [fetchSales]),
  );

  const saleGroups = useMemo(
    () =>
      groupSaleRows(sales).sort(
        (left, right) =>
          new Date(right.earliestTimestamp).getTime() -
          new Date(left.earliestTimestamp).getTime(),
      ),
    [sales],
  );
  const filteredSales = saleGroups.filter((group) =>
    filter === "voided"
      ? group.lines.some((line) => line.voided_at != null)
      : group.lines.some((line) => line.voided_at == null),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sales</Text>
        <TouchableOpacity
          style={[styles.sellButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/quick-sell" as any)}
          activeOpacity={0.8}
        >
          <Plus size={18} color={colors.primaryText} />
          <Text style={[styles.sellButtonText, { color: colors.primaryText }]}>Sell</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(isOwner ? (["all", "voided"] as const) : (["all"] as const)).map((value) => {
          const active = filter === value;
          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setFilter(value)}
            >
              <Text
                style={{ color: active ? colors.primaryText : colors.textSecondary, fontWeight: active ? "700" : "500" }}
              >
                {value === "all" ? "All" : "Voided"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredSales}
          keyExtractor={(group) => group.id}
          renderItem={({ item: group }) =>
            <SaleGroupCard
              group={group}
              colors={colors}
              currency={currency}
              isOwner={isOwner}
              onVoid={(line) => setSaleToVoid(line)}
              totalOverride={
                group.voided
                  ? group.lines.reduce((total, line) => total + (line.line_total ?? 0), 0)
                  : undefined
              }
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <ShoppingCart size={28} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No sales yet</Text>
            </View>
          }
        />
      )}
      {isOwner ? <VoidRecordDialog
        visible={saleToVoid != null}
        recordLabel="sale"
        userId={session?.user?.id ?? null}
        showNoStockWarning={saleToVoid?.catalogue_item_id == null}
        onCancel={() => setSaleToVoid(null)}
        onConfirm={async (reason) => {
          if (!saleToVoid) return true;
          try {
            const { data, error } = await supabase.rpc("void_job", {
              p_job_id: saleToVoid.id,
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
              showToast("Already voided", "This sale has already been voided.");
            } else {
              showToast(
                "Sale voided",
                result.restored_quantity > 0
                  ? `${plural(result.restored_quantity, "unit")} returned to stock.`
                  : "The sale remains in your voided records.",
              );
            }
            await fetchSales();
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
  headerTitle: { fontSize: 22, fontWeight: "700" },
  sellButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
  },
  sellButtonText: { fontSize: 14, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  filterChip: { minWidth: 76, alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  listContent: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { fontSize: 14, fontWeight: "600" },
});