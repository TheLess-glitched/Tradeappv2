import { useNavigation } from "expo-router";
import { DrawerNavigationProp } from "expo-router/drawer";
import { AlertTriangle, ArrowLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../constants/supabase";
import { useTheme } from "../context/theme-context";

type Item = {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  low_stock_alert: number;
};

export default function InventoryScreen() {
  const { colors } = useTheme();

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.menuButton}
        >
          <ArrowLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Inventory</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Text style={[styles.addButtonText, { color: colors.primaryText }]}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {lowStockItems.length > 0 && (
        <View
          style={[
            styles.warningBanner,
            {
              backgroundColor: colors.dangerSurface,
              borderColor: colors.danger,
            },
          ]}
        >
          <AlertTriangle size={16} color={colors.danger} />
          <Text style={[styles.warningText, { color: colors.danger }]}>
            {lowStockItems.length} item{lowStockItems.length > 1 ? "s" : ""}{" "}
            running low
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((item) => (
            <View
              key={item}
              style={[
                styles.skeletonCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.skeletonLine, { width: "48%", backgroundColor: colors.border }]} />
              <View style={[styles.skeletonLine, { width: "30%", backgroundColor: colors.border }]} />
            </View>
          ))}
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <AlertTriangle size={24} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.text }]}>No items yet</Text>
          <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
            Tap + Add to track your first item
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
                style={[
                  styles.itemCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  isLow && {
                    borderColor: colors.danger,
                    backgroundColor: colors.dangerSurface,
                  },
                ]}
              >
                <View style={styles.itemTop}>
                  <View>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.itemUnit, { color: colors.textMuted }]}>
                      {item.unit || "units"} · Alert at {item.low_stock_alert}
                    </Text>
                  </View>
                  {isLow && (
                    <View
                      style={[
                        styles.lowBadge,
                        { backgroundColor: colors.danger },
                      ]}
                    >
                      <Text style={styles.lowBadgeText}>Low</Text>
                    </View>
                  )}
                </View>

                <View style={styles.itemBottom}>
                  <TouchableOpacity
                    style={[
                      styles.qtyButton,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => adjustQuantity(item, -1)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.qtyButtonText, { color: colors.text }]}>−</Text>
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.qtyValue,
                      { color: colors.text },
                      isLow && { color: colors.danger },
                    ]}
                  >
                    {item.quantity}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.qtyButton,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => adjustQuantity(item, 1)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.qtyButtonText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteItem(item.id, item.name)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.deleteText, { color: colors.danger }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.modalBox,
              {
                backgroundColor: colors.modalBackground,
                borderColor: colors.modalBorder,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Item</Text>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Item Name *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="e.g. Engine Oil, Hair relaxer"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
            />

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
              placeholder="e.g. 10"
              placeholderTextColor={colors.placeholder}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />

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
              placeholder="e.g. litres, packs, pieces"
              placeholderTextColor={colors.placeholder}
              value={unit}
              onChangeText={setUnit}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Low Stock Alert</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="e.g. 5"
              placeholderTextColor={colors.placeholder}
              value={lowStockAlert}
              onChangeText={setLowStockAlert}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                saving && styles.saveButtonDisabled,
              ]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>
                  Save Item
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textMuted }]}>Cancel</Text>
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
  headerTitle: { fontSize: 22, fontWeight: "700", flex: 1 },
  addButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: { fontSize: 14, fontWeight: "700" },
  warningBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningText: { fontSize: 13, fontWeight: "600" },
  skeletonList: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  skeletonCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  itemCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  itemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  itemName: { fontSize: 15, fontWeight: "700" },
  itemUnit: { fontSize: 12, marginTop: 2 },
  lowBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lowBadgeText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  itemBottom: { flexDirection: "row", alignItems: "center", gap: 12 },
  qtyButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButtonText: { fontSize: 20, fontWeight: "600" },
  qtyValue: {
    fontSize: 20,
    fontWeight: "800",
    minWidth: 40,
    textAlign: "center",
  },
  deleteButton: {
    marginLeft: "auto",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  deleteText: { fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyText: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySubText: { fontSize: 13, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBox: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 20,
  },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
  cancelButton: { alignItems: "center", paddingVertical: 12 },
  cancelButtonText: { fontSize: 15 },
});
