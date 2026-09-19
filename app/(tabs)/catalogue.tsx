import { router, useFocusEffect } from "expo-router";
import {
    MapPin,
    Package,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { CURRENCIES, formatCurrency } from "../../constants/currency";
import { supabase } from "../../constants/supabase";
import { useAuth } from "../../context/auth-context";
import { useTheme } from "../../context/theme-context";

type CatalogueItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  track_stock: boolean;
  supplier: string;
  location: string;
};

export default function CatalogueScreen() {
  const { session } = useAuth();
  const { colors, currency } = useTheme();

  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [movementModal, setMovementModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogueItem | null>(null);
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [sellingItem, setSellingItem] = useState<CatalogueItem | null>(null);
  const [sellQuantity, setSellQuantity] = useState("1");
  const [sellPrice, setSellPrice] = useState("");
  const [sellingLoading, setSellingLoading] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("units");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
  const [trackStock, setTrackStock] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [location, setLocation] = useState("");

  const [movementType, setMovementType] = useState<"in" | "out">("in");
  const [movementQty, setMovementQty] = useState("");
  const [movementReason, setMovementReason] = useState("");

  const categories = [
    "General",
    "Drugs",
    "Equipment",
    "Raw Materials",
    "Tools",
    "Consumables",
  ];

  const fetchItems = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("catalogue")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setItems(data);
      hasDataRef.current = data.length > 0;
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchItems();
    }, [fetchItems]),
  );

  const handleSave = async () => {
    if (!name.trim() || !quantity) {
      Alert.alert("Missing info", "Please enter a name and quantity.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (editingItem) {
      const { error } = await supabase
        .from("catalogue")
        .update({
          name,
          category,
          quantity: parseFloat(quantity),
          unit,
          cost_price: costPrice ? parseFloat(costPrice) : null,
          selling_price: sellingPrice ? parseFloat(sellingPrice) : null,
          reorder_level: reorderLevel ? parseFloat(reorderLevel) : 0,
          track_stock: trackStock,
          supplier,
          location,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingItem.id);
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("catalogue").insert({
        user_id: user?.id,
        name,
        category,
        quantity: parseFloat(quantity),
        unit,
        cost_price: costPrice ? parseFloat(costPrice) : null,
        selling_price: sellingPrice ? parseFloat(sellingPrice) : null,
        reorder_level: reorderLevel ? parseFloat(reorderLevel) : 0,
        track_stock: trackStock,
        supplier,
        location,
      });
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
    }
    resetForm();
    fetchItems();
  };

  const handleMovement = async () => {
    if (!movementQty || !selectedItem) return;
    const qty = parseFloat(movementQty);

    if (movementType === "out" && qty > selectedItem.quantity) {
      Alert.alert("Error", "Cannot remove more than current stock.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: movError } = await supabase
      .from("catalogue_stock_movements")
      .insert({
        user_id: user?.id,
        catalogue_item_id: selectedItem.id,
        movement_type: movementType,
        quantity: qty,
        reason: movementReason,
      });

    if (movError) {
      Alert.alert("Error", movError.message);
      return;
    }

    const newQty =
      movementType === "in"
        ? selectedItem.quantity + qty
        : selectedItem.quantity - qty;

    await supabase
      .from("catalogue")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", selectedItem.id);

    setMovementModal(false);
    setMovementQty("");
    setMovementReason("");
    fetchItems();
  };

  const openSell = (item: CatalogueItem) => {
    setSellingItem(item);
    setSellQuantity("1");
    setSellPrice(item.selling_price != null ? item.selling_price.toString() : "");
    setSellModalVisible(true);
  };

  const handleCompleteSale = async () => {
    if (!sellingItem) return;

    const parsedQty = parseInt(sellQuantity.replace(/[^0-9]/g, ""), 10);
    if (!parsedQty || parsedQty <= 0) {
      Alert.alert("Invalid quantity", "Please enter a valid quantity greater than 0.");
      return;
    }

    const parsedPrice = parseFloat(sellPrice.replace(/[^0-9.]/g, "")) || 0;
    if (!parsedPrice || parsedPrice <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price greater than 0.");
      return;
    }

    setSellingLoading(true);
    try {
      const { data: stockData, error: stockError } = await supabase.rpc(
        "decrement_catalogue_stock",
        {
          p_catalogue_item_id: sellingItem.id,
          p_quantity: parsedQty,
          p_reason: "Sale",
        },
      );

      if (stockError) {
        Alert.alert("Stock update failed", stockError.message);
        setSellingLoading(false);
        return;
      }

      const stockResult = Array.isArray(stockData) ? stockData[0] : stockData;
      const stockUpdated = stockResult?.updated === true;
      const newQuantity =
        stockResult?.new_quantity != null
          ? Number(stockResult.new_quantity)
          : null;

      if (!stockUpdated) {
        if (typeof newQuantity === "number" && !isNaN(newQuantity)) {
          Alert.alert("Stock Error", `Only ${newQuantity} available`);
        } else {
          Alert.alert("Stock Error", "This item could not be found");
        }
        setSellingLoading(false);
        return;
      }

      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const year = now.getFullYear();
      const autoDate = `${day}/${month}/${year}`;

      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const autoTime = `${hours}:${minutes} ${ampm}`;

      const { error: jobError } = await supabase.from("jobs").insert({
        user_id: session?.user?.id,
        record_type: "sale",
        customer_name: null,
        customer_phone: null,
        service: sellingItem.name,
        price: parsedPrice,
        date: autoDate,
        time: autoTime,
      });

      if (jobError) {
        Alert.alert(
          "Sale not fully recorded",
          `Stock was already reduced by ${parsedQty}, but the sale record failed to save: ${jobError.message}. Please check the catalogue quantity and create the sale record manually if needed.`
        );
        fetchItems();
        setSellingLoading(false);
        return;
      }

      setSellModalVisible(false);
      setSellingItem(null);
      fetchItems();
      Alert.alert("Sale Complete", "Sale recorded successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "An unexpected error occurred.");
    } finally {
      setSellingLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Item", "Are you sure you want to delete this item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("catalogue").delete().eq("id", id);
          fetchItems();
        },
      },
    ]);
  };

  const openEdit = (item: CatalogueItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setQuantity(item.quantity.toString());
    setUnit(item.unit);
    setCostPrice(item.cost_price ? item.cost_price.toString() : "");
    setSellingPrice(item.selling_price ? item.selling_price.toString() : "");
    setReorderLevel(item.reorder_level ? item.reorder_level.toString() : "");
    setTrackStock(item.track_stock ?? false);
    setSupplier(item.supplier || "");
    setLocation(item.location || "");
    setModalVisible(true);
  };

  const openMovement = (item: CatalogueItem) => {
    setSelectedItem(item);
    setMovementQty("");
    setMovementReason("");
    setMovementModal(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setName("");
    setCategory("General");
    setQuantity("");
    setUnit("units");
    setCostPrice("");
    setSellingPrice("");
    setReorderLevel("");
    setTrackStock(false);
    setSupplier("");
    setLocation("");
    setModalVisible(false);
  };

  const isLowStock = (item: CatalogueItem) =>
    item.reorder_level > 0 && item.quantity <= item.reorder_level;

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      (item.supplier &&
        item.supplier.toLowerCase().includes(search.toLowerCase())) ||
      (item.location &&
        item.location.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Catalogue</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Plus size={22} color={colors.primaryText} />
        </TouchableOpacity>
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
          placeholder="Search catalogue by name, category..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <X size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : filteredItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {search ? "No matching items found" : "No items in catalogue yet"}
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Tap + to add your first item
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
                  backgroundColor: colors.dangerSurface,
                },
              ]}
              onPress={() =>
                router.push({
                  pathname: "/catalogue-detail",
                  params: { id: item.id },
                })
              }
              activeOpacity={0.8}
            >
              <View style={styles.itemTop}>
                <View style={styles.itemLeft}>
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.itemCategory, { color: colors.textSecondary }]}>
                    {item.category}
                  </Text>
                </View>
                <View style={styles.itemRight}>
                  <Text
                    style={[
                      styles.itemQty,
                      { color: colors.primary },
                      isLowStock(item) && { color: colors.danger },
                    ]}
                  >
                    {item.quantity} {item.unit}
                  </Text>
                  {isLowStock(item) && (
                    <Text
                      style={[
                        styles.lowStockBadge,
                        {
                          color: colors.dangerText,
                          backgroundColor: colors.dangerSurface,
                        },
                      ]}
                    >
                      Low Stock
                    </Text>
                  )}
                </View>
              </View>

              {item.cost_price || item.supplier || item.location ? (
                <View style={styles.itemMeta}>
                  {item.cost_price ? (
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      Cost: {formatCurrency(item.cost_price || 0, currency)}
                    </Text>
                  ) : null}
                  {item.selling_price ? (
                    <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                      Sell: {formatCurrency(item.selling_price || 0, currency)}
                    </Text>
                  ) : null}
                  {item.supplier ? (
                    <View style={styles.metaRow}>
                      <Package size={12} color={colors.textMuted} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {item.supplier}
                      </Text>
                    </View>
                  ) : null}
                  {item.location ? (
                    <View style={styles.metaRow}>
                      <MapPin size={12} color={colors.textMuted} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        {item.location}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.itemActions}>
                {item.track_stock ? (
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      openSell(item);
                    }}
                  >
                    <Text style={[styles.sellBtnText, { color: colors.primaryText }]}>
                      Sell
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: colors.secondarySurface },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setMovementType("in");
                    openMovement(item);
                  }}
                >
                  <Text style={[styles.inBtnText, { color: colors.primary }]}>
                    + Stock In
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: colors.dangerSurface },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setMovementType("out");
                    openMovement(item);
                  }}
                >
                  <Text style={[styles.outBtnText, { color: colors.danger }]}>
                    - Stock Out
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: colors.surfaceSubtle }]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openEdit(item);
                  }}
                >
                  <Pencil size={15} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: colors.dangerSurface }]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleDelete(item.id);
                  }}
                >
                  <Trash2 size={15} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
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
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingItem ? "Edit Item" : "Add Item"}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                placeholder="e.g. Amoxicillin 500mg"
                placeholderTextColor={colors.placeholder}
                value={name}
                onChangeText={setName}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {categories.map((cat) => {
                    const isSelected = category === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected
                              ? colors.primary
                              : colors.chipBackground,
                            borderColor: isSelected
                              ? colors.primary
                              : colors.chipBorder,
                          },
                        ]}
                        onPress={() => setCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: isSelected
                                ? colors.primaryText
                                : colors.chipText,
                              fontWeight: isSelected ? "700" : "500",
                            },
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Quantity *</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                        color: colors.inputText,
                      },
                    ]}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.rowItem}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Unit</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                        color: colors.inputText,
                      },
                    ]}
                    placeholder="units"
                    placeholderTextColor={colors.placeholder}
                    value={unit}
                    onChangeText={setUnit}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Cost Price ({CURRENCIES[currency].symbol})</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                        color: colors.inputText,
                      },
                    ]}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    value={costPrice}
                    onChangeText={setCostPrice}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.rowItem}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Selling Price ({CURRENCIES[currency].symbol})</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                        color: colors.inputText,
                      },
                    ]}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    value={sellingPrice}
                    onChangeText={setSellingPrice}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Reorder Level</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                placeholder="Alert when stock falls below this"
                placeholderTextColor={colors.placeholder}
                value={reorderLevel}
                onChangeText={setReorderLevel}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={styles.trackStockRow}
                onPress={() => setTrackStock((current) => !current)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.trackStockCheckbox,
                    {
                      backgroundColor: trackStock
                        ? colors.primary
                        : colors.inputBackground,
                      borderColor: trackStock
                        ? colors.primary
                        : colors.inputBorder,
                    },
                  ]}
                >
                  {trackStock ? <Text style={{ color: colors.primaryText }}>✓</Text> : null}
                </View>
                <Text style={[styles.trackStockText, { color: colors.text }]}>Track stock for this item</Text>
              </TouchableOpacity>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Supplier</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                placeholder="Supplier name"
                placeholderTextColor={colors.placeholder}
                value={supplier}
                onChangeText={setSupplier}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                placeholder="e.g. Shelf A, Store Room"
                placeholderTextColor={colors.placeholder}
                value={location}
                onChangeText={setLocation}
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>
                  {editingItem ? "Update Item" : "Add Item"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Movement Modal */}
      <Modal visible={movementModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                maxHeight: "55%",
                backgroundColor: colors.modalBackground,
                borderColor: colors.modalBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {movementType === "in" ? "Stock In" : "Stock Out"} —{" "}
                {selectedItem?.name}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setMovementModal(false);
                  setMovementQty("");
                  setMovementReason("");
                }}
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.movementToggle}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor:
                      movementType === "in"
                        ? colors.primary
                        : colors.surfaceSubtle,
                    borderColor:
                      movementType === "in"
                        ? colors.primary
                        : colors.border,
                  },
                ]}
                onPress={() => setMovementType("in")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    {
                      color:
                        movementType === "in"
                          ? colors.primaryText
                          : colors.textSecondary,
                      fontWeight: movementType === "in" ? "700" : "500",
                    },
                  ]}
                >
                  + In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor:
                      movementType === "out"
                        ? colors.danger
                        : colors.surfaceSubtle,
                    borderColor:
                      movementType === "out"
                        ? colors.danger
                        : colors.border,
                  },
                ]}
                onPress={() => setMovementType("out")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    {
                      color:
                        movementType === "out"
                          ? "#FFFFFF"
                          : colors.textSecondary,
                      fontWeight: movementType === "out" ? "700" : "500",
                    },
                  ]}
                >
                  - Out
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Quantity</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="How many?"
              placeholderTextColor={colors.placeholder}
              value={movementQty}
              onChangeText={setMovementQty}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Reason (optional)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="e.g. Sold to customer, New delivery"
              placeholderTextColor={colors.placeholder}
              value={movementReason}
              onChangeText={setMovementReason}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor:
                    movementType === "in" ? colors.primary : colors.danger,
                },
              ]}
              onPress={handleMovement}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  {
                    color:
                      movementType === "in"
                        ? colors.primaryText
                        : "#FFFFFF",
                  },
                ]}
              >
                Confirm {movementType === "in" ? "Stock In" : "Stock Out"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sell Modal */}
      <Modal visible={sellModalVisible} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                maxHeight: "60%",
                backgroundColor: colors.modalBackground,
                borderColor: colors.modalBorder,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Sell — {sellingItem?.name}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setSellModalVisible(false);
                  setSellingItem(null);
                }}
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Quantity</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="1"
              placeholderTextColor={colors.placeholder}
              value={sellQuantity}
              onChangeText={setSellQuantity}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Price ({CURRENCIES[currency].symbol})
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              value={sellPrice}
              onChangeText={setSellPrice}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: colors.primary,
                  opacity: sellingLoading ? 0.7 : 1,
                },
              ]}
              onPress={handleCompleteSale}
              disabled={sellingLoading}
            >
              {sellingLoading ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>
                  Complete Sale
                </Text>
              )}
            </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: "700" },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubtext: { fontSize: 13 },
  list: { padding: 20, gap: 12 },
  itemCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemLeft: { flex: 1 },
  itemRight: { alignItems: "flex-end" },
  itemName: { fontSize: 15, fontWeight: "700" },
  itemCategory: { fontSize: 12, marginTop: 2 },
  itemQty: { fontSize: 16, fontWeight: "700" },
  lowStockBadge: {
    fontSize: 10,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  itemMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: { fontSize: 12 },
  itemActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  inBtnText: { fontSize: 12, fontWeight: "600" },
  outBtnText: { fontSize: 12, fontWeight: "600" },
  sellBtnText: { fontSize: 12, fontWeight: "700" },
  trackStockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  trackStockCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  trackStockText: { fontSize: 14, fontWeight: "600" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13 },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
  movementToggle: { flexDirection: "row", gap: 12, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  toggleBtnText: { fontSize: 14 },
});
