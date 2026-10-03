import { router, useFocusEffect } from "expo-router";
import { Plus, ShoppingCart } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { showFeedback } from "../../components/app-feedback";
import { formatCurrency } from "../../constants/currency";
import { supabase } from "../../constants/supabase";
import { useAuth } from "../../context/auth-context";
import { useTheme } from "../../context/theme-context";
import { getJobProfit } from "../../hooks/use-todays-jobs";

type Sale = {
  id: number;
  service: string;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
  price: number;
  line_total: number | null;
  date: string;
  time: string;
  created_at: string;
};

export default function SalesScreen() {
  const { colors, currency } = useTheme();
  const { session, isSessionReady } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSales = useCallback(async () => {
    const userId = session?.user?.id;
    if (!isSessionReady || !userId) {
      setSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("id, service, quantity, unit_price, unit_cost, price, line_total, date, time, created_at")
      .eq("user_id", userId)
      .eq("record_type", "sale")
      .order("created_at", { ascending: false });

    if (error) {
      showFeedback("Error", error.message);
      setSales([]);
    } else {
      setSales(data ?? []);
    }
    setLoading(false);
  }, [isSessionReady, session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchSales();
    }, [fetchSales]),
  );

  const deleteSale = (saleId: number) => {
    showFeedback("Delete Sale", "Are you sure you want to delete this sale?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("jobs")
            .delete()
            .eq("id", saleId)
            .eq("user_id", session?.user?.id)
            .eq("record_type", "sale");
          if (error) {
            showFeedback("Error", error.message);
          } else {
            fetchSales();
          }
        },
      },
    ]);
  };

  const renderSale = ({ item: sale }: { item: Sale }) => {
    const profit = getJobProfit(sale);
    const unitPrice = sale.unit_price ?? sale.price;

    return (
      <View
        style={[
          styles.saleRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.saleDetails}>
          <View style={styles.nameRow}>
            <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
              {sale.service}
            </Text>
            <View style={[styles.soldBadge, { backgroundColor: `${colors.statusDone}18` }]}>
              <Text style={[styles.soldText, { color: colors.statusDone }]}>Sold</Text>
            </View>
          </View>
          <Text style={[styles.unitPrice, { color: colors.textSecondary }]}>
            {sale.quantity} × {formatCurrency(unitPrice, currency)}
          </Text>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            Profit {profit == null ? "—" : formatCurrency(profit, currency)}
          </Text>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {sale.date} · {sale.time}
          </Text>
        </View>
        <View style={styles.saleAside}>
          <Text style={[styles.lineTotal, { color: colors.text }]}>
            {formatCurrency(sale.line_total ?? 0, currency)}
          </Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteSale(sale.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.deleteText, { color: colors.danger }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(sale) => String(sale.id)}
          renderItem={renderSale}
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
  listContent: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  saleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  saleDetails: { flex: 1, minWidth: 0, gap: 5 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemName: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "700" },
  soldBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  soldText: { fontSize: 11, fontWeight: "700" },
  unitPrice: { fontSize: 13 },
  metaText: { fontSize: 12 },
  saleAside: { alignItems: "flex-end", justifyContent: "space-between" },
  lineTotal: { fontSize: 15, fontWeight: "800" },
  deleteButton: { paddingHorizontal: 4, paddingVertical: 6 },
  deleteText: { fontSize: 12, fontWeight: "600" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyText: { fontSize: 14, fontWeight: "600" },
});