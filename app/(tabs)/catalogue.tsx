import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../constants/supabase";

type CatalogueItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  supplier: string;
  location: string;
};

export default function CatalogueScreen() {
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [movementModal, setMovementModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogueItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogueItem | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("General");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("units");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [reorderLevel, setReorderLevel] = useState("");
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

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("catalogue")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data);
    setLoading(false);
  };

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
    setSelectedItem(null);
    fetchItems();
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Item", "Are you sure? This cannot be undone.", [
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
    setQuantity(String(item.quantity));
    setUnit(item.unit);
    setCostPrice(item.cost_price ? String(item.cost_price) : "");
    setSellingPrice(item.selling_price ? String(item.selling_price) : "");
    setReorderLevel(item.reorder_level ? String(item.reorder_level) : "");
    setSupplier(item.supplier || "");
    setLocation(item.location || "");
    setModalVisible(true);
  };

  const openMovement = (item: CatalogueItem) => {
    setSelectedItem(item);
    setMovementModal(true);
  };

  const resetForm = () => {
    setName("");
    setCategory("General");
    setQuantity("");
    setUnit("units");
    setCostPrice("");
    setSellingPrice("");
    setReorderLevel("");
    setSupplier("");
    setLocation("");
    setEditingItem(null);
    setModalVisible(false);
  };

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase()) ||
      i.supplier?.toLowerCase().includes(search.toLowerCase()),
  );

  const isLowStock = (item: CatalogueItem) =>
    item.reorder_level > 0 && item.quantity <= item.reorder_level;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catalogue</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#0A0F1E" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color="#718096" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          placeholderTextColor="#718096"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={48} color="#4A5568" />
          <Text style={styles.emptyText}>No items yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first item</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.itemCard, isLowStock(item) && styles.itemCardLow]}
              onPress={() =>
                router.push(`/catalogue-detail?id=${item.id}` as any)
              }
              activeOpacity={0.8}
            >
              <View style={styles.itemTop}>
                <View style={styles.itemLeft}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemCategory}>{item.category}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text
                    style={[
                      styles.itemQty,
                      isLowStock(item) && styles.itemQtyLow,
                    ]}
                  >
                    {item.quantity} {item.unit}
                  </Text>
                  {isLowStock(item) && (
                    <Text style={styles.lowStockBadge}>Low Stock</Text>
                  )}
                </View>
              </View>

              {item.cost_price || item.supplier || item.location ? (
                <View style={styles.itemMeta}>
                  {item.cost_price ? (
                    <Text style={styles.metaText}>
                      Cost: ₦{item.cost_price.toLocaleString()}
                    </Text>
                  ) : null}
                  {item.selling_price ? (
                    <Text style={styles.metaText}>
                      Sell: ₦{item.selling_price.toLocaleString()}
                    </Text>
                  ) : null}
                  {item.supplier ? (
                    <Text style={styles.metaText}>📦 {item.supplier}</Text>
                  ) : null}
                  {item.location ? (
                    <Text style={styles.metaText}>📍 {item.location}</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.inBtn]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setMovementType("in");
                    openMovement(item);
                  }}
                >
                  <Text style={styles.inBtnText}>+ Stock In</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.outBtn]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setMovementType("out");
                    openMovement(item);
                  }}
                >
                  <Text style={styles.outBtnText}>- Stock Out</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openEdit(item);
                  }}
                >
                  <Ionicons name="pencil-outline" size={16} color="#A0AEC0" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleDelete(item.id);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color="#FC8181" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingItem ? "Edit Item" : "Add Item"}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Amoxicillin 500mg"
                placeholderTextColor="#718096"
                value={name}
                onChangeText={setName}
              />

              <Text style={styles.label}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.chip,
                        category === cat && styles.chipActive,
                      ]}
                      onPress={() => setCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          category === cat && styles.chipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Quantity *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#718096"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="units"
                    placeholderTextColor="#718096"
                    value={unit}
                    onChangeText={setUnit}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Cost Price (₦)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#718096"
                    value={costPrice}
                    onChangeText={setCostPrice}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>Selling Price (₦)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#718096"
                    value={sellingPrice}
                    onChangeText={setSellingPrice}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.label}>Reorder Level</Text>
              <TextInput
                style={styles.input}
                placeholder="Alert when stock falls below this"
                placeholderTextColor="#718096"
                value={reorderLevel}
                onChangeText={setReorderLevel}
                keyboardType="numeric"
              />

              <Text style={styles.label}>Supplier</Text>
              <TextInput
                style={styles.input}
                placeholder="Supplier name"
                placeholderTextColor="#718096"
                value={supplier}
                onChangeText={setSupplier}
              />

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Shelf A, Store Room"
                placeholderTextColor="#718096"
                value={location}
                onChangeText={setLocation}
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>
                  {editingItem ? "Update Item" : "Add Item"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Movement Modal */}
      <Modal visible={movementModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "50%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
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
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.movementToggle}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  movementType === "in" && styles.toggleBtnActiveIn,
                ]}
                onPress={() => setMovementType("in")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    movementType === "in" && styles.toggleBtnTextActive,
                  ]}
                >
                  + In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  movementType === "out" && styles.toggleBtnActiveOut,
                ]}
                onPress={() => setMovementType("out")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    movementType === "out" && styles.toggleBtnTextActive,
                  ]}
                >
                  - Out
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              placeholder="How many?"
              placeholderTextColor="#718096"
              value={movementQty}
              onChangeText={setMovementQty}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Reason (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sold to customer, New delivery"
              placeholderTextColor="#718096"
              value={movementReason}
              onChangeText={setMovementReason}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor:
                    movementType === "in" ? "#F6A623" : "#E53E3E",
                },
              ]}
              onPress={handleMovement}
            >
              <Text style={styles.saveButtonText}>
                Confirm {movementType === "in" ? "Stock In" : "Stock Out"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0F1E" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: "700", color: "#FFFFFF" },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F6A623",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131929",
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#FFFFFF" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#718096" },
  emptySubtext: { fontSize: 13, color: "#4A5568" },
  list: { padding: 20, gap: 12 },
  itemCard: {
    backgroundColor: "#131929",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  itemCardLow: { borderColor: "#FC8181", backgroundColor: "#2D1B00" },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  itemLeft: { flex: 1 },
  itemRight: { alignItems: "flex-end" },
  itemName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  itemCategory: { fontSize: 12, color: "#718096", marginTop: 2 },
  itemQty: { fontSize: 16, fontWeight: "700", color: "#F6A623" },
  itemQtyLow: { color: "#FC8181" },
  lowStockBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FC8181",
    backgroundColor: "#FC818122",
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
  metaText: { fontSize: 12, color: "#A0AEC0" },
  itemActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  inBtn: { backgroundColor: "#F6A62322" },
  outBtn: { backgroundColor: "#E53E3E22" },
  inBtnText: { fontSize: 12, fontWeight: "600", color: "#F6A623" },
  outBtnText: { fontSize: 12, fontWeight: "600", color: "#FC8181" },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#1E2A3D",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0F1923",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "90%",
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
    color: "#FFFFFF",
    flex: 1,
    marginRight: 8,
  },
  label: { fontSize: 13, fontWeight: "600", color: "#A0AEC0", marginBottom: 6 },
  input: {
    backgroundColor: "#131929",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#FFFFFF",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#131929",
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  chipActive: { backgroundColor: "#F6A623", borderColor: "#F6A623" },
  chipText: { fontSize: 13, fontWeight: "500", color: "#A0AEC0" },
  chipTextActive: { color: "#0A0F1E" },
  saveButton: {
    backgroundColor: "#F6A623",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#0A0F1E" },
  movementToggle: { flexDirection: "row", gap: 12, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#131929",
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  toggleBtnActiveIn: { backgroundColor: "#F6A62322", borderColor: "#F6A623" },
  toggleBtnActiveOut: { backgroundColor: "#E53E3E22", borderColor: "#E53E3E" },
  toggleBtnText: { fontSize: 14, fontWeight: "600", color: "#A0AEC0" },
  toggleBtnTextActive: { color: "#FFFFFF" },
});
