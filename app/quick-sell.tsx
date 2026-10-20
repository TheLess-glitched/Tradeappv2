import * as Crypto from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Search, ShoppingCart, X } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { showDialog, showToast } from "../components/app-feedback";
import SellModal, { SellModalItem } from "../components/sell-modal";
import { CURRENCIES, formatCurrency } from "../constants/currency";
import { friendlyError, isNetworkError } from "../constants/network-error";
import { plural } from "../constants/plural";
import { trackedCatalogueListQuery } from "../constants/queries";
import {
  enqueueSale,
  QueuedSale,
  removeSale,
  retrySale,
} from "../constants/sale-queue";
import { supabase } from "../constants/supabase";
import { fetchTodayRecords } from '../constants/today-records';
import { useAuth } from "../context/auth-context";
import { CartLine, useCart } from "../context/cart-context";
import { useTheme } from "../context/theme-context";
import { getOfflinePendingQuantities, useOfflineSales } from "../hooks/use-offline-sales";

type TrackedCatalogueItem = {
  id: string;
  name: string;
  selling_price: number | null;
  cost_price: number | null;
  quantity: number;
  unit: string;
  reorder_level: number;
  track_stock: boolean;
};

type QuickSellRowProps = {
  item: TrackedCatalogueItem;
  cartLine: CartLine | undefined;
  colors: ReturnType<typeof useTheme>["colors"];
  isLowStock: boolean;
  onAdd: (item: TrackedCatalogueItem) => void;
  onDecrement: (itemId: string, quantity: number) => void;
  onEdit: (item: TrackedCatalogueItem) => void;
  currency: ReturnType<typeof useTheme>["currency"];
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

const QuickSellRow = memo(function QuickSellRow({
  item,
  cartLine,
  colors,
  isLowStock,
  onAdd,
  onDecrement,
  onEdit,
  currency,
}: QuickSellRowProps) {
  return (
    <TouchableOpacity
      style={[
        styles.itemCard,
        {
          backgroundColor: cartLine ? colors.surfaceHighlight : colors.surface,
          borderColor: cartLine ? colors.primary : colors.border,
        },
        isLowStock && !cartLine && { borderColor: colors.danger },
      ]}
      onPress={() => {
        if (item.quantity > 0) onAdd(item);
      }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Add ${item.name} to cart`}
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
              backgroundColor: isLowStock
                ? colors.dangerSurface
                : colors.surfaceSubtle,
              borderColor: isLowStock ? colors.danger : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.stockText,
              {
                color: isLowStock ? colors.dangerText : colors.primary,
                fontWeight: "700",
              },
            ]}
          >
            {item.quantity} {item.unit || "units"}
          </Text>
        </View>
        {isLowStock ? (
          <Text style={[styles.lowStockLabel, { color: colors.dangerText }]}>
            Low Stock
          </Text>
        ) : null}
      </View>

      {cartLine ? (
        <View style={styles.stepper}>
          <TouchableOpacity
            style={[styles.stepperButton, { borderColor: colors.border }]}
            onPress={() => onDecrement(item.id, cartLine.qty)}
            accessibilityRole="button"
            accessibilityLabel={`Remove one ${item.name}`}
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quantityButton, { borderColor: colors.border }]}
            onPress={() => onEdit(item)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name} quantity and price`}
          >
            <Text style={[styles.stepperText, { color: colors.text }]}>
              {cartLine.qty}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.stepperButton, { borderColor: colors.border }]}
            onPress={() => onAdd(item)}
            disabled={item.quantity <= 0}
            accessibilityState={{ disabled: item.quantity <= 0 }}
            accessibilityRole="button"
            accessibilityLabel={`Add one ${item.name}`}
          >
            <Text
              style={[
                styles.stepperText,
                { color: item.quantity <= 0 ? colors.textMuted : colors.text },
              ]}
            >
              +
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View
          style={[
            styles.addButton,
            {
              backgroundColor: item.quantity <= 0 ? colors.surfaceSubtle : colors.primary,
            },
          ]}
        >
          <Text
            style={[
              styles.addButtonText,
              { color: item.quantity <= 0 ? colors.textMuted : colors.primaryText },
            ]}
          >
            +
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

});

export default function QuickSellScreen() {
  const { businessId, user } = useAuth();
  const { colors, currency } = useTheme();
  const {
    items: cartItems,
    itemCount,
    total,
    addOne,
    setQty,
    setAvailableStock,
    setPrice,
    remove,
    clear,
  } = useCart();

  const [items, setItems] = useState<TrackedCatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<SellModalItem | null>(null);
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [quantityEditId, setQuantityEditId] = useState<string | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [totalDrafts, setTotalDrafts] = useState<Record<string, string>>({});
  const [stockErrorItemId, setStockErrorItemId] = useState<string | null>(null);
  const queuedSales = useOfflineSales(user?.id, businessId);
  const saleIdRef = useRef<{ fingerprint: string; id: string; occurredAt: string } | null>(null);

  const pendingSalesCount = queuedSales.filter((sale) => sale.status === "pending").length;
  const needsAttentionCount = queuedSales.filter(
    (sale) => sale.status === "needs_attention",
  ).length;
  const pendingQuantities = useMemo(
    () => getOfflinePendingQuantities(queuedSales),
    [queuedSales],
  );
  const displayItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        quantity: Math.max(
          0,
          Math.floor(item.quantity) - (pendingQuantities[item.id] ?? 0),
        ),
      })),
    [items, pendingQuantities],
  );

  const fetchTrackedItems = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      if (!businessId) {
        setItems([]);
        return;
      }

      const { data, error } = await trackedCatalogueListQuery(businessId);

      if (!error && data) {
        setItems(data);
        hasDataRef.current = data.length > 0;
      } else if (error && !hasDataRef.current) {
        showToast("Items not saved yet", "Connect to the internet once to load your items.");
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useFocusEffect(
    useCallback(() => {
      fetchTrackedItems();
    }, [fetchTrackedItems]),
  );

  useEffect(() => {
    for (const line of cartItems) {
      const item = displayItems.find((entry) => entry.id === line.itemId);
      if (item && item.quantity !== line.availableStock) {
        setAvailableStock(line.itemId, item.quantity);
      }
    }
  }, [cartItems, displayItems, setAvailableStock]);

  const handleAdd = useCallback(
    (item: TrackedCatalogueItem) => {
      const currentLine = cartItems.find((line) => line.itemId === item.id);
      const atStockLimit = currentLine
        ? currentLine.qty >= Math.floor(item.quantity)
        : item.quantity < 1;
      addOne(item);
      if (atStockLimit) showToast(`Only ${Math.floor(item.quantity)} left`);
    },
    [addOne, cartItems],
  );

  const handleDecrement = useCallback(
    (itemId: string, quantity: number) => setQty(itemId, quantity - 1),
    [setQty],
  );

  const openCartEditor = useCallback((item: TrackedCatalogueItem) => {
    setSelectedItem(item);
    setSellModalVisible(true);
  }, []);

  const handleCartSave = useCallback(
    (quantity: number, price: number) => {
      if (!selectedItem) return;
      if (quantity === 0) {
        remove(selectedItem.id);
        return;
      }
      addOne({
        id: selectedItem.id,
        name: selectedItem.name,
        selling_price: selectedItem.selling_price ?? null,
        quantity: selectedItem.quantity,
      });
      setQty(selectedItem.id, quantity);
      setPrice(selectedItem.id, price);
    },
    [addOne, remove, selectedItem, setPrice, setQty],
  );

  const handleQuantityChange = useCallback(
    (itemId: string, quantity: number) => {
      setQty(itemId, quantity);
      setPriceDrafts((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
      setTotalDrafts((current) => {
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    },
    [setQty],
  );

  const commitQuantityDraft = useCallback(
    (itemId: string) => {
      const line = cartItems.find((cartLine) => cartLine.itemId === itemId);
      const parsed = Number(quantityDraft);
      if (
        !line ||
        quantityDraft.trim() === "" ||
        !Number.isInteger(parsed) ||
        parsed < 1
      ) {
        showToast("Enter a valid quantity");
      } else {
        if (parsed > line.availableStock) {
          showToast(`Only ${line.availableStock} left`);
        }
        const qty = Math.min(parsed, line.availableStock);
        setQty(itemId, qty);
        setPriceDrafts((current) => {
          const next = { ...current };
          delete next[itemId];
          return next;
        });
        setTotalDrafts((current) => {
          const next = { ...current };
          delete next[itemId];
          return next;
        });
      }
      setQuantityEditId(null);
      setQuantityDraft("");
    },
    [cartItems, quantityDraft, setQty],
  );

  const handlePriceDraft = useCallback(
    (itemId: string, value: string) => {
      setPriceDrafts((current) => ({ ...current, [itemId]: value }));
      const parsed = parseAmount(value);
      const line = cartItems.find((cartLine) => cartLine.itemId === itemId);
      if (Number.isFinite(parsed) && parsed > 0 && line) {
        setPrice(itemId, parsed);
        setTotalDrafts((current) => ({
          ...current,
          [itemId]: String(roundMoney(parsed * line.qty)),
        }));
      } else {
        setTotalDrafts((current) => ({ ...current, [itemId]: "" }));
      }
    },
    [cartItems, setPrice],
  );

  const commitPriceDraft = useCallback((itemId: string) => {
    setPriceDrafts((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    setTotalDrafts((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const handleTotalDraft = useCallback(
    (itemId: string, value: string) => {
      setTotalDrafts((current) => ({ ...current, [itemId]: value }));
      const parsedTotal = parseAmount(value);
      const line = cartItems.find((cartLine) => cartLine.itemId === itemId);
      if (line && Number.isFinite(parsedTotal) && parsedTotal > 0 && line.qty > 0) {
        const unitPrice = parsedTotal / line.qty;
        setPrice(itemId, unitPrice);
        setPriceDrafts((current) => ({
          ...current,
          [itemId]: String(unitPrice),
        }));
      } else {
        setPriceDrafts((current) => ({ ...current, [itemId]: "" }));
      }
    },
    [cartItems, setPrice],
  );

  const commitTotalDraft = useCallback((itemId: string) => {
    setTotalDrafts((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    setPriceDrafts((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }, []);

  const handleClearCart = useCallback(() => {
    showDialog("Clear cart?", "Remove all items from this cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear cart",
        style: "destructive",
        onPress: () => {
          clear();
          saleIdRef.current = null;
          setStockErrorItemId(null);
          setPriceDrafts({});
          setTotalDrafts({});
        },
      },
    ]);
  }, [clear]);

  const reviewAttentionSale = useCallback((sale: QueuedSale) => {
    showDialog("Offline sale needs attention", sale.error || "The server rejected this sale.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Retry",
        onPress: () => {
          void retrySale(sale.id);
        },
      },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          void removeSale(sale.id);
        },
      },
    ]);
  }, []);

  const handleStockError = useCallback(
    (error: { message: string; details?: string | null }) => {
      if (error.message.startsWith("Not enough stock for")) {
        let details: unknown;
        try {
          details = JSON.parse(error.details ?? "");
        } catch {
          showToast("Couldn't complete sale", error.message);
          return;
        }

        if (
          typeof details === "object" &&
          details !== null &&
          "catalogue_item_id" in details &&
          typeof details.catalogue_item_id === "string" &&
          "available" in details &&
          typeof details.available === "number" &&
          Number.isFinite(details.available)
        ) {
          const itemId = details.catalogue_item_id;
          const available = Math.max(0, Math.floor(details.available));
          setStockErrorItemId(itemId);
          showDialog(
            "Not enough stock",
            `Only ${available} available. Update this cart line or remove it.`,
            [
              {
                text: `Set to ${available} available`,
                onPress: () => {
                  setAvailableStock(itemId, available);
                  setStockErrorItemId(null);
                },
              },
              {
                text: "Remove line",
                style: "destructive",
                onPress: () => {
                  remove(itemId);
                  setStockErrorItemId(null);
                },
              },
            ],
          );
          return;
        }
      }
      showToast("Couldn't complete sale", error.message);
    },
    [remove, setAvailableStock],
  );

  const completeCartSale = useCallback(async () => {
    if (submittingRef.current || cartItems.length === 0) return;
    if (!businessId || !user?.id) {
      showToast("Couldn't complete sale", "Your business account is not ready.");
      return;
    }

    const lines = cartItems.map((line) => {
      const draft = priceDrafts[line.itemId];
      const unitPrice = draft == null ? line.unitPrice : parseAmount(draft);
      return { line, unitPrice };
    });
    const invalidPrice = lines.find(
      ({ line, unitPrice }) =>
        !Number.isInteger(line.qty) ||
        line.qty < 1 ||
        !Number.isFinite(unitPrice) ||
        unitPrice <= 0 ||
        !Number.isFinite(unitPrice * line.qty) ||
        unitPrice * line.qty <= 0,
    );
    if (invalidPrice) {
      showToast("Enter a valid total", invalidPrice.line.name);
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    const saleLines = lines.map(({ line, unitPrice }) => ({
      catalogue_item_id: line.itemId,
      quantity: line.qty,
      unit_price: unitPrice,
    }));
    const fingerprint = JSON.stringify([businessId, user.id, saleLines]);
    if (!saleIdRef.current || saleIdRef.current.fingerprint !== fingerprint) {
      saleIdRef.current = {
        fingerprint,
        id: Crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
      };
    }
    const sale = saleIdRef.current;

    const saveOfflineSale = async () => {
      await enqueueSale({
        id: sale.id,
        businessId,
        userId: user.id,
        lines: lines.map(({ line, unitPrice }) => ({
          catalogue_item_id: line.itemId,
          quantity: line.qty,
          unit_price: unitPrice,
          name: line.name,
        })),
        reason: "Sale",
        occurredAt: sale.occurredAt,
      });
      clear();
      saleIdRef.current = null;
      setPriceDrafts({});
      setTotalDrafts({});
      setStockErrorItemId(null);
      setReviewVisible(false);
      showToast("Sale saved offline", "It will sync when your connection returns.");
    };
    try {
      const { error } = await supabase.rpc("record_sale_cart_v2", {
        p_client_id: sale.id,
        p_lines: saleLines,
        p_reason: "Sale",
        p_occurred_at: sale.occurredAt,
        p_offline: false,
      });
      if (error) {
        const code = (error as { code?: string }).code;
        if (!code && isNetworkError(error)) {
          await saveOfflineSale();
          return;
        }
        handleStockError(error);
        return;
      }
      clear();
      saleIdRef.current = null;
      setPriceDrafts({});
      setTotalDrafts({});
      setStockErrorItemId(null);
      setReviewVisible(false);
      showToast("Sale recorded");
      await fetchTrackedItems();
      if (businessId) void fetchTodayRecords(businessId).catch(() => {});
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (!code && isNetworkError(error)) {
        try {
          await saveOfflineSale();
        } catch (queueError) {
          showToast(
            "Sale not saved",
            friendlyError(queueError, "Unable to store the sale on this device."),
          );
        }
      } else {
        showToast("Couldn't complete sale", friendlyError(error, "An unexpected error occurred."));
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [businessId, user, cartItems, priceDrafts, handleStockError, clear, fetchTrackedItems]);

  const cartById = useMemo(
    () => new Map(cartItems.map((line) => [line.itemId, line])),
    [cartItems],
  );

  const filteredItems = useMemo(
    () =>
      displayItems.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [displayItems, search],
  );

  const isLowStock = (item: TrackedCatalogueItem) =>
    item.reorder_level > 0 && item.quantity <= item.reorder_level;

  const renderItem = useCallback(
    ({ item }: { item: TrackedCatalogueItem }) => (
      <QuickSellRow
        item={item}
        cartLine={cartById.get(item.id)}
        colors={colors}
        currency={currency}
        isLowStock={isLowStock(item)}
        onAdd={handleAdd}
        onDecrement={handleDecrement}
        onEdit={openCartEditor}
      />
    ),
    [cartById, colors, currency, handleAdd, handleDecrement, openCartEditor],
  );

  const selectedCartLine = selectedItem
    ? cartById.get(selectedItem.id)
    : undefined;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
          style={styles.listView}
          data={filteredItems}
          extraData={cartItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          renderItem={renderItem}
        />
      )}

      {itemCount > 0 ? (
        <TouchableOpacity
          style={[styles.cartBar, { backgroundColor: colors.primary }]}
          onPress={() => setReviewVisible(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Review ${itemCount} cart items, total ${formatCurrency(roundMoney(total), currency)}`}
        >
          <Text style={[styles.cartBarText, { color: colors.primaryText }]}>
            {plural(cartItems.length, "item")} · {plural(itemCount, "unit")}
          </Text>
          <Text style={[styles.cartBarText, { color: colors.primaryText }]}>
            {formatCurrency(roundMoney(total), currency)}
          </Text>
          <Text style={[styles.reviewText, { color: colors.primaryText }]}>Review</Text>
        </TouchableOpacity>
      ) : null}

      <SellModal
        visible={sellModalVisible}
        item={selectedItem}
        mode="cart"
        initialQuantity={selectedCartLine?.qty}
        initialPrice={selectedCartLine?.unitPrice}
        maxQuantity={selectedItem?.quantity}
        onCartSave={handleCartSave}
        onClose={() => {
          setSellModalVisible(false);
          setSelectedItem(null);
        }}
      />
      <Modal
        visible={reviewVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!submitting) setReviewVisible(false);
        }}
      >
        <View style={[styles.reviewOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.reviewSheet,
              { backgroundColor: colors.modalBackground, borderColor: colors.modalBorder },
            ]}
          >
            <View style={styles.reviewHeader}>
              <Text style={[styles.reviewTitle, { color: colors.text }]}>Review cart</Text>
              <TouchableOpacity
                style={styles.clearCartButton}
                onPress={handleClearCart}
                disabled={submitting || cartItems.length === 0}
                accessibilityRole="button"
              >
                <Text style={[styles.clearCartText, { color: colors.dangerText }]}>
                  Clear cart
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.reviewLines}
              contentContainerStyle={styles.reviewLinesContent}
              keyboardShouldPersistTaps="handled"
            >
              {cartItems.map((line) => {
                const priceText = priceDrafts[line.itemId] ?? line.unitPrice.toString();
                const draftPrice = parseAmount(priceText);
                const displayPrice =
                  Number.isFinite(draftPrice) && draftPrice > 0
                    ? draftPrice
                    : line.unitPrice;
                const totalText =
                  totalDrafts[line.itemId] ??
                  String(roundMoney(line.qty * displayPrice));
                const cataloguePrice =
                  items.find((item) => item.id === line.itemId)?.selling_price;
                const discount =
                  cataloguePrice != null && displayPrice < cataloguePrice
                    ? roundMoney((cataloguePrice - displayPrice) * line.qty)
                    : 0;
                return (
                  <View
                    key={line.itemId}
                    style={[
                      styles.reviewLine,
                      {
                        backgroundColor:
                          stockErrorItemId === line.itemId
                            ? colors.dangerSurface
                            : colors.surface,
                        borderColor:
                          stockErrorItemId === line.itemId
                            ? colors.danger
                            : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.reviewLineHeading}>
                      <Text style={[styles.reviewItemName, { color: colors.text }]}>
                        {line.name}
                      </Text>
                      <TouchableOpacity
                        style={styles.removeLineButton}
                        onPress={() => remove(line.itemId)}
                        disabled={submitting}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${line.name}`}
                      >
                        <X size={18} color={colors.dangerText} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.reviewLineControls}>
                      <View style={styles.reviewMoneyFields}>
                        <View style={styles.reviewPriceWrap}>
                          <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>
                            Price ({CURRENCIES[currency].symbol})
                          </Text>
                          <TextInput
                            style={[
                              styles.reviewPriceInput,
                              {
                                backgroundColor: colors.inputBackground,
                                borderColor: colors.inputBorder,
                                color: colors.inputText,
                              },
                            ]}
                            value={priceText}
                            onChangeText={(value) => handlePriceDraft(line.itemId, value)}
                            onEndEditing={() => commitPriceDraft(line.itemId)}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                            editable={!submitting}
                            accessibilityLabel={`${line.name} price`}
                          />
                        </View>
                        <View style={styles.reviewPriceWrap}>
                          <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>
                            Total ({CURRENCIES[currency].symbol})
                          </Text>
                          <TextInput
                            style={[
                              styles.reviewPriceInput,
                              {
                                backgroundColor: colors.inputBackground,
                                borderColor: colors.inputBorder,
                                color: colors.inputText,
                              },
                            ]}
                            value={totalText}
                            onChangeText={(value) => handleTotalDraft(line.itemId, value)}
                            onEndEditing={() => commitTotalDraft(line.itemId)}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                            editable={!submitting}
                            accessibilityLabel={`${line.name} total`}
                          />
                        </View>
                      </View>
                      <View style={styles.reviewQuantityBlock}>
                        <Text style={[styles.reviewLabel, { color: colors.textSecondary }]}>
                          Quantity
                        </Text>
                        <View style={styles.stepper}>
                          <TouchableOpacity
                            style={[styles.stepperButton, { borderColor: colors.border }]}
                            onPress={() => handleQuantityChange(line.itemId, line.qty - 1)}
                            disabled={submitting}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove one ${line.name}`}
                          >
                            <Text style={[styles.stepperText, { color: colors.text }]}>−</Text>
                          </TouchableOpacity>
                          {quantityEditId === line.itemId ? (
                            <TextInput
                              style={[
                                styles.reviewQuantityInput,
                                {
                                  backgroundColor: colors.inputBackground,
                                  borderColor: colors.inputBorder,
                                  color: colors.inputText,
                                },
                              ]}
                              value={quantityDraft}
                              onChangeText={setQuantityDraft}
                              onBlur={() => commitQuantityDraft(line.itemId)}
                              onSubmitEditing={() => Keyboard.dismiss()}
                              returnKeyType="done"
                              keyboardType="number-pad"
                              autoFocus
                              selectTextOnFocus
                              editable={!submitting}
                              accessibilityLabel={`${line.name} exact quantity`}
                            />
                          ) : (
                            <TouchableOpacity
                              style={[
                                styles.quantityButton,
                                { borderColor: colors.border },
                              ]}
                              onPress={() => {
                                setQuantityDraft(line.qty.toString());
                                setQuantityEditId(line.itemId);
                              }}
                              disabled={submitting}
                              accessibilityRole="button"
                              accessibilityLabel={`Enter exact quantity for ${line.name}`}
                            >
                              <Text style={[styles.stepperText, { color: colors.text }]}>
                                {line.qty}
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[
                              styles.stepperButton,
                              {
                                borderColor: colors.border,
                                opacity: line.qty >= line.availableStock ? 0.45 : 1,
                              },
                            ]}
                            onPress={() =>
                              handleQuantityChange(line.itemId, line.qty + 1)
                            }
                            disabled={submitting || line.qty >= line.availableStock}
                            accessibilityRole="button"
                            accessibilityLabel={`Add one ${line.name}`}
                          >
                            <Text style={[styles.stepperText, { color: colors.text }]}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                    {discount > 0 ? (
                      <Text style={[styles.discountHint, { color: colors.textMuted }]}>
                        Discount: {formatCurrency(discount, currency)}
                      </Text>
                    ) : null}
                    <Text style={[styles.lineTotal, { color: colors.text }]}>
                      Line total:{" "}
                      {formatCurrency(roundMoney(line.qty * displayPrice), currency)}
                    </Text>
                    {stockErrorItemId === line.itemId ? (
                      <Text style={[styles.stockErrorText, { color: colors.dangerText }]}>
                        Stock changed. Choose how to update this line.
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>

            <View style={[styles.reviewFooter, { borderTopColor: colors.border }]}>
              <View style={styles.totalRow}>
                <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
                <Text style={[styles.totalValue, { color: colors.text }]}>
                  {formatCurrency(roundMoney(total), currency)}
                </Text>
              </View>
              {pendingSalesCount > 0 ? (
                <Text style={[styles.queueSummary, { color: colors.textSecondary }]}>
                  Includes {plural(pendingSalesCount, "offline sale")} in today&apos;s totals
                </Text>
              ) : null}
              {needsAttentionCount > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    const sale = queuedSales.find(
                      (entry) => entry.status === "needs_attention",
                    );
                    if (sale) reviewAttentionSale(sale);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.queueAttention, { color: colors.dangerText }]}>
                    {plural(needsAttentionCount, "offline sale")} need attention · Tap to review
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.completeSaleButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: submitting || cartItems.length === 0 ? 0.65 : 1,
                  },
                ]}
                onPress={completeCartSale}
                disabled={submitting || cartItems.length === 0}
                accessibilityRole="button"
              >
                {submitting ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <Text style={[styles.completeSaleText, { color: colors.primaryText }]}>
                    Complete sale ({formatCurrency(roundMoney(total), currency)})
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  listView: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 16, gap: 10 },
  itemCard: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  itemInfo: { flex: 1, marginRight: 8 },
  itemName: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  itemPrice: { fontSize: 13, fontWeight: "500" },
  itemStockWrapper: { alignItems: "flex-end", marginRight: 8 },
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
  stepper: { flexDirection: "row", alignItems: "center" },
  stepperButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
  },
  quantityButton: {
    minWidth: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  stepperText: { fontSize: 18, fontWeight: "700" },
  addButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  addButtonText: { fontSize: 24, fontWeight: "600" },
  cartBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 64,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  cartBarText: { fontSize: 15, fontWeight: "700" },
  reviewText: { fontSize: 15, fontWeight: "700" },
  reviewOverlay: { flex: 1, justifyContent: "flex-end" },
  reviewSheet: {
    maxHeight: "88%",
    borderWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  reviewTitle: { fontSize: 20, fontWeight: "700" },
  clearCartButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  clearCartText: { fontSize: 14, fontWeight: "700" },
  reviewLines: { flexShrink: 1 },
  reviewLinesContent: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  reviewLine: { borderWidth: 1, borderRadius: 14, padding: 12 },
  reviewLineHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewItemName: { flex: 1, fontSize: 15, fontWeight: "700" },
  removeLineButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewLineControls: {
    gap: 10,
  },
  reviewMoneyFields: { flexDirection: "row", gap: 10 },
  reviewPriceWrap: { flex: 1 },
  reviewLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  reviewPriceInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 15,
  },
  reviewQuantityBlock: { alignItems: "flex-start" },
  reviewQuantityInput: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: "center",
    marginHorizontal: 4,
  },
  lineTotal: { fontSize: 14, fontWeight: "700", textAlign: "right", marginTop: 10 },
  discountHint: { fontSize: 12, marginTop: 8 },
  stockErrorText: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  reviewFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    marginTop: 4,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  totalLabel: { fontSize: 15, fontWeight: "600" },
  totalValue: { fontSize: 20, fontWeight: "800" },
  queueSummary: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 8,
  },
  queueAttention: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  completeSaleButton: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  completeSaleText: { fontSize: 15, fontWeight: "700", textAlign: "center" },
});
