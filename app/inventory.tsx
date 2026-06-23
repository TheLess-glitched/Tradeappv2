import { DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "@react-navigation/native";
import { ArrowLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../constants/supabase";

type Item = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  low_stock_alert: number;
};

export default function InventoryScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [lowStockAlert, setLowStockAlert] = useState("5");
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("user_id", user?.id)
      .order("name", { ascending: true });
    if (!error && data) setItems(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!name || !quantity) {
      Alert.alert("Missing info", "Please enter item name and quantity.");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("inventory").insert({
      user_id: user?.id,
      name,
      quantity: parseInt(quantity),
      unit,
      low_stock_alert: parseInt(lowStockAlert) || 5,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setName("");
      setQuantity("");
      setUnit("");
      setLowStockAlert("5");
      setModalVisible(false);
      fetchItems();
    }
  };

  const adjustQuantity = (item: Item, change: number) => {
    const newQty = item.quantity + change;
    if (newQty < 0) return;
    Alert.alert(
      "Update Stock",
      `Set ${item.name} to ${newQty} ${item.unit || "units"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: async () => {
            const { error } = await supabase
              .from("inventory")
              .update({ quantity: newQty })
              .eq("id", item.id);
            if (error) {
              Alert.alert("Error", error.message);
            } else {
              fetchItems();
            }
          },
        },
      ],
    );
  };

  const deleteItem = (id: number, itemName: string) => {
    Alert.alert("Delete Item", `Remove "${itemName}" from inventory?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("inventory")
            .delete()
            .eq("id", id);
          if (error) {
            Alert.alert("Error", error.message);
          } else {
            fetchItems();
          }
        },
      },
    ]);
  };

  const lowStockItems = items.filter((i) => i.quantity <= i.low_stock_alert);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.menuButton}
        >
          <ArrowLeft size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {lowStockItems.length > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""}{" "}
            running low
          </Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color="#F6A623" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No items yet</Text>
          <Text style={styles.emptySubText}>
            Tap "+ Add" to track your first item
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {items.map((item) => {
            const isLow = item.quantity <= item.low_stock_alert;
            return (
              <View
                key={item.id}
                style={[styles.itemCard, isLow && styles.itemCardLow]}
              >
                <View style={styles.itemTop}>
                  <View>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemUnit}>
                      {item.unit || "units"} · Alert at {item.low_stock_alert}
                    </Text>
                  </View>
                  {isLow && (
                    <View style={styles.lowBadge}>
                      <Text style={styles.lowBadgeText}>Low</Text>
                    </View>
                  )}
                </View>

                <View style={styles.itemBottom}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => adjustQuantity(item, -1)}
                  >
                    <Text style={styles.qtyButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={[styles.qtyValue, isLow && styles.qtyValueLow]}>
                    {item.quantity}
                  </Text>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => adjustQuantity(item, 1)}
                  >
                    <Text style={styles.qtyButtonText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteItem(item.id, item.name)}
                  >
                    <Text style={styles.deleteText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Item</Text>

            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Engine Oil, Hair relaxer"
              placeholderTextColor="#4A5568"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Quantity *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10"
              placeholderTextColor="#4A5568"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Unit</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. litres, packs, pieces"
              placeholderTextColor="#4A5568"
              value={unit}
              onChangeText={setUnit}
            />

            <Text style={styles.label}>Low Stock Alert</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 5"
              placeholderTextColor="#4A5568"
              value={lowStockAlert}
              onChangeText={setLowStockAlert}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#0A0F1E" />
              ) : (
                <Text style={styles.saveButtonText}>Save Item</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    gap: 12,
  },
  menuButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFFFFF", flex: 1 },
  addButton: {
    backgroundColor: "#F6A623",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: { fontSize: 14, fontWeight: "700", color: "#0A0F1E" },
  warningBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#2D1B00",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#F6A623",
  },
  warningText: { fontSize: 13, color: "#F6A623", fontWeight: "600" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  itemCard: {
    backgroundColor: "#131929",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  itemCardLow: { borderColor: "#F6A623" },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  itemName: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
  itemUnit: { fontSize: 12, color: "#718096", marginTop: 2 },
  lowBadge: {
    backgroundColor: "#F6A623",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lowBadgeText: { fontSize: 11, fontWeight: "700", color: "#0A0F1E" },
  itemBottom: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#1E2A3D",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButtonText: { fontSize: 20, color: "#FFFFFF", fontWeight: "600" },
  qtyValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    minWidth: 40,
    textAlign: "center",
  },
  qtyValueLow: { color: "#F6A623" },
  deleteButton: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteText: { fontSize: 12, color: "#E53E3E", fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#4A5568" },
  emptySubText: { fontSize: 13, color: "#2D3748", marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#0F1923",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 20,
  },
  label: { fontSize: 13, fontWeight: "500", color: "#A0AEC0", marginBottom: 6 },
  input: {
    backgroundColor: "#131929",
    borderWidth: 1,
    borderColor: "#1E2A3D",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFFFFF",
    marginBottom: 16,
  },
  saveButton: {
    backgroundColor: "#F6A623",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#0A0F1E" },
  cancelButton: { alignItems: "center", paddingVertical: 12 },
  cancelButtonText: { fontSize: 15, color: "#718096" },
});
