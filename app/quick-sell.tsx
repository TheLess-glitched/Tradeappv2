import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Search, ShoppingCart, X } from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SellModal, { SellModalItem } from "../components/sell-modal";
import { formatCurrency } from "../constants/currency";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";

type TrackedCatalogueItem = {
  id: string;
  name: string;
  selling_price: number | null;
  quantity: number;
  unit: string;
  reorder_level: number;
  track_stock: boolean;
};

export default function QuickSellScreen() {
  const { session, isSessionReady } = useAuth();
  const { colors, currency } = useTheme();

  const [items, setItems] = useState<TrackedCatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<SellModalItem | null>(null);
  const [sellModalVisible, setSellModalVisible] = useState(false);

  const fetchTrackedItems = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      const userId = session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("catalogue")
        .select("id, name, selling_price, quantity, unit, reorder_level, track_stock")
        .eq("user_id", userId)
        .eq("track_stock", true)
        .order("name", { ascending: true });

      if (!error && data) {
        setItems(data);
        hasDataRef.current = data.length > 0;
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchTrackedItems();
    }, [fetchTrackedItems]),
  );

  const openSell = (item: TrackedCatalogueItem) => {
    setSelectedItem(item);
    setSellModalVisible(true);
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const isLowStock = (item: TrackedCatalogueItem) =>
    item.reorder_level > 0 && item.quantity <= item.reorder_level;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"))}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Quick Sell</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Search size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.inputText }]}
          placeholder="Search items to sell..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Item List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <ShoppingCart size={26} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyText, { color: colors.text }]}>
            {search ? "No matching items" : "No tracked catalogue items"}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            {search
              ? "Try checking your spelling or search for another item."
              : "Enable stock tracking for items in your Catalogue to make quick sales."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.itemCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
                isLowStock(item) && {
                  borderColor: colors.danger,
                },
              ]}
              onPress={() => openSell(item)}
              activeOpacity={0.7}
            >
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.itemPrice, { color: colors.textSecondary }]}>
                  {item.selling_price != null
                    ? formatCurrency(item.selling_price, currency)
                    : "No selling price"}
                </Text>
              </View>

              <View style={styles.itemStockWrapper}>
                <View
                  style={[
                    styles.stockBadge,
                    {
                      backgroundColor: isLowStock(item)
                        ? colors.dangerSurface
                        : colors.surfaceSubtle,
                      borderColor: isLowStock(item) ? colors.danger : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stockText,
                      {
                        color: isLowStock(item) ? colors.dangerText : colors.primary,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {item.quantity} {item.unit || "units"}
                  </Text>
                </View>
                {isLowStock(item) ? (
                  <Text style={[styles.lowStockLabel, { color: colors.dangerText }]}>
                    Low Stock
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Shared Sell Modal */}
      <SellModal
        visible={sellModalVisible}
        item={selectedItem}
        onClose={() => {
          setSellModalVisible(false);
          setSelectedItem(null);
        }}
        onComplete={fetchTrackedItems}
      />
    </KeyboardAvoidingView>
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
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyText: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  emptySubtext: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  itemInfo: { flex: 1, marginRight: 12 },
  itemName: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  itemPrice: { fontSize: 13, fontWeight: "500" },
  itemStockWrapper: { alignItems: "flex-end" },
  stockBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  stockText: { fontSize: 13 },
  lowStockLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },
});
