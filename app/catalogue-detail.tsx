import { router, useLocalSearchParams } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  FileText,
  Pencil,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
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
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  cost_price: number | null;
  selling_price: number | null;
  reorder_level: number;
  supplier: string | null;
  location: string | null;
  created_at: string;
};

type Movement = {
  id: string;
  movement_type: "in" | "out";
  quantity: number;
  reason: string | null;
  created_at: string;
};

type Note = {
  id: string;
  note_type: string;
  status: string;
  description: string;
  cost: number | null;
  created_at: string;
  resolved_at: string | null;
};

const noteTypeColors: Record<string, string> = {
  damage: "#E53E3E",
  repair: "#F6A623",
  maintenance: "#00A86B",
  inspection: "#76E4F7",
  custom: "#B794F4",
  general: "#999999",
};

const statusColors: Record<string, string> = {
  reported: "#E53E3E",
  in_progress: "#F6A623",
  awaiting_parts: "#B794F4",
  repaired: "#00A86B",
  retired: "#999999",
  resolved: "#00A86B",
};

const noteTypes = [
  "general",
  "damage",
  "repair",
  "maintenance",
  "inspection",
  "custom",
];
const statuses = [
  "reported",
  "in_progress",
  "awaiting_parts",
  "repaired",
  "retired",
  "resolved",
];

export default function CatalogueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<Item | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const [noteModal, setNoteModal] = useState(false);
  const [noteType, setNoteType] = useState("general");
  const [noteStatus, setNoteStatus] = useState("reported");
  const [noteDesc, setNoteDesc] = useState("");
  const [noteCost, setNoteCost] = useState("");

  const [movModal, setMovModal] = useState(false);
  const [movType, setMovType] = useState<"in" | "out">("in");
  const [movQty, setMovQty] = useState("");
  const [movReason, setMovReason] = useState("");

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: itemData } = await supabase
      .from("catalogue")
      .select("*")
      .eq("id", id)
      .eq("user_id", user?.id)
      .single();
    const { data: movData } = await supabase
      .from("catalogue_stock_movements")
      .select("*")
      .eq("catalogue_item_id", id)
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });
    const { data: noteData } = await supabase
      .from("catalogue_notes")
      .select("*")
      .eq("catalogue_item_id", id)
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });

    if (itemData) setItem(itemData);
    if (movData) setMovements(movData);
    if (noteData) setNotes(noteData);
    setLoading(false);
  };

  const handleAddNote = async () => {
    if (!noteDesc.trim()) {
      Alert.alert("Missing info", "Please enter a description.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("catalogue_notes").insert({
      user_id: user?.id,
      catalogue_item_id: id,
      note_type: noteType,
      status: noteStatus,
      description: noteDesc,
      cost: noteCost ? parseFloat(noteCost) : null,
    });
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    resetNoteForm();
    fetchAll();
  };

  const handleMovement = async () => {
    if (!movQty || !item) return;
    const qty = parseFloat(movQty);
    if (movType === "out" && qty > item.quantity) {
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
        catalogue_item_id: id,
        movement_type: movType,
        quantity: qty,
        reason: movReason,
      });
    if (movError) {
      Alert.alert("Error", movError.message);
      return;
    }
    const newQty = movType === "in" ? item.quantity + qty : item.quantity - qty;
    await supabase
      .from("catalogue")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", id);
    resetMovForm();
    fetchAll();
  };

  const resetNoteForm = () => {
    setNoteModal(false);
    setNoteType("general");
    setNoteStatus("reported");
    setNoteDesc("");
    setNoteCost("");
  };
  const resetMovForm = () => {
    setMovModal(false);
    setMovType("in");
    setMovQty("");
    setMovReason("");
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const isLowStock = item
    ? item.reorder_level > 0 && item.quantity <= item.reorder_level
    : false;

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Text style={{ color: "#999" }}>Loading...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Text style={{ color: "#999" }}>Item not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 16 }}
        >
          <Text style={{ color: "#00A86B", fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {item.name}
        </Text>
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Edit Item", "Edit functionality coming soon.")
          }
        >
          <Pencil size={22} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.heroCard, isLowStock && styles.heroCardLow]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.heroQty, isLowStock && styles.heroQtyLow]}>
                {item.quantity}
              </Text>
              <Text style={styles.heroUnit}>{item.unit}</Text>
            </View>
            <View
              style={[styles.categoryBadge, { backgroundColor: "#00A86B22" }]}
            >
              <Text style={[styles.categoryBadgeText, { color: "#00A86B" }]}>
                {item.category}
              </Text>
            </View>
          </View>
          {isLowStock && (
            <View style={styles.lowStockRow}>
              <AlertTriangle size={14} color="#E53E3E" />
              <Text style={styles.lowStockText}>
                Below reorder level ({item.reorder_level} {item.unit})
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metaGrid}>
          {item.cost_price ? (
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>Cost Price</Text>
              <Text style={styles.metaValue}>
                ₦{item.cost_price.toLocaleString()}
              </Text>
            </View>
          ) : null}
          {item.selling_price ? (
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>Selling Price</Text>
              <Text style={styles.metaValue}>
                ₦{item.selling_price.toLocaleString()}
              </Text>
            </View>
          ) : null}
          {item.supplier ? (
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>Supplier</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {item.supplier}
              </Text>
            </View>
          ) : null}
          {item.location ? (
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>Location</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Reorder Level</Text>
            <Text style={styles.metaValue}>
              {item.reorder_level} {item.unit}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#00A86B" }]}
            onPress={() => setMovModal(true)}
          >
            <ArrowLeftRight size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Record Movement</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "#1a1a1a" }]}
            onPress={() => setNoteModal(true)}
          >
            <FileText size={16} color="#fff" />
            <Text style={styles.actionBtnText}>Add Note</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stock History</Text>
          {movements.length === 0 ? (
            <Text style={styles.emptySection}>No movements recorded yet.</Text>
          ) : (
            movements.map((m) => (
              <View key={m.id} style={styles.movementRow}>
                <View
                  style={[
                    styles.movementDot,
                    {
                      backgroundColor:
                        m.movement_type === "in" ? "#00A86B" : "#E53E3E",
                    },
                  ]}
                />
                <View style={styles.movementBody}>
                  <Text style={styles.movementText}>
                    <Text style={{ fontWeight: "700" }}>
                      {m.movement_type === "in" ? "+" : "-"}
                      {m.quantity}
                    </Text>{" "}
                    {item.unit}
                  </Text>
                  {m.reason ? (
                    <Text style={styles.movementReason}>{m.reason}</Text>
                  ) : null}
                  <Text style={styles.movementDate}>
                    {formatDate(m.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Item Notes</Text>
          {notes.length === 0 ? (
            <Text style={styles.emptySection}>
              No notes yet. Tap "Add Note" to create one.
            </Text>
          ) : (
            notes.map((n) => (
              <View key={n.id} style={styles.noteCard}>
                <View style={styles.noteHeader}>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          (noteTypeColors[n.note_type] || "#999") + "22",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: noteTypeColors[n.note_type] || "#999" },
                      ]}
                    >
                      {n.note_type}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          (statusColors[n.status] || "#999") + "22",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: statusColors[n.status] || "#999" },
                      ]}
                    >
                      {n.status.replace("_", " ")}
                    </Text>
                  </View>
                </View>
                <Text style={styles.noteDesc}>{n.description}</Text>
                {n.cost ? (
                  <Text style={styles.noteCost}>
                    Cost: ₦{n.cost.toLocaleString()}
                  </Text>
                ) : null}
                <Text style={styles.noteDate}>{formatDate(n.created_at)}</Text>
                {n.resolved_at ? (
                  <Text style={styles.noteResolved}>
                    Resolved: {formatDate(n.resolved_at)}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={noteModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Item Note</Text>
              <TouchableOpacity onPress={resetNoteForm}>
                <X size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Note Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {noteTypes.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.chip,
                        noteType === t && {
                          backgroundColor: noteTypeColors[t],
                          borderColor: noteTypeColors[t],
                        },
                      ]}
                      onPress={() => setNoteType(t)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          noteType === t && { color: "#fff" },
                        ]}
                      >
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Status</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {statuses.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.chip,
                        noteStatus === s && {
                          backgroundColor: statusColors[s],
                          borderColor: statusColors[s],
                        },
                      ]}
                      onPress={() => setNoteStatus(s)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          noteStatus === s && { color: "#fff" },
                        ]}
                      >
                        {s.replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the issue or update..."
                placeholderTextColor="#999"
                value={noteDesc}
                onChangeText={setNoteDesc}
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Cost (optional, ₦)</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor="#999"
                value={noteCost}
                onChangeText={setNoteCost}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAddNote}
              >
                <Text style={styles.saveButtonText}>Save Note</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={movModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "55%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Stock Movement</Text>
              <TouchableOpacity onPress={resetMovForm}>
                <X size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <View style={styles.movementToggle}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  movType === "in" && styles.toggleBtnActiveIn,
                ]}
                onPress={() => setMovType("in")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    movType === "in" && styles.toggleBtnTextActive,
                  ]}
                >
                  + Stock In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  movType === "out" && styles.toggleBtnActiveOut,
                ]}
                onPress={() => setMovType("out")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    movType === "out" && styles.toggleBtnTextActive,
                  ]}
                >
                  - Stock Out
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              placeholder="How many?"
              placeholderTextColor="#999"
              value={movQty}
              onChangeText={setMovQty}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Reason (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. New delivery, Sold to customer"
              placeholderTextColor="#999"
              value={movReason}
              onChangeText={setMovReason}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: movType === "in" ? "#00A86B" : "#E53E3E" },
              ]}
              onPress={handleMovement}
            >
              <Text style={styles.saveButtonText}>
                Confirm {movType === "in" ? "Stock In" : "Stock Out"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    flex: 1,
    marginHorizontal: 12,
  },
  heroCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#eeeeee",
    marginBottom: 16,
  },
  heroCardLow: { borderColor: "#FEB2B2", backgroundColor: "#FFF5F5" },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroQty: { fontSize: 36, fontWeight: "800", color: "#00A86B" },
  heroQtyLow: { color: "#E53E3E" },
  heroUnit: { fontSize: 14, color: "#666", marginTop: 2 },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  categoryBadgeText: { fontSize: 12, fontWeight: "600" },
  lowStockRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  lowStockText: { fontSize: 13, color: "#E53E3E", fontWeight: "600" },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  metaBox: {
    width: "47%",
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#eeeeee",
  },
  metaLabel: {
    fontSize: 11,
    color: "#999",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  emptySection: { fontSize: 13, color: "#999", fontStyle: "italic" },
  movementRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  movementDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  movementBody: { flex: 1 },
  movementText: { fontSize: 14, color: "#1a1a1a" },
  movementReason: { fontSize: 12, color: "#666", marginTop: 2 },
  movementDate: { fontSize: 11, color: "#999", marginTop: 2 },
  noteCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eeeeee",
    marginBottom: 10,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  noteDesc: { fontSize: 14, color: "#1a1a1a", lineHeight: 20, marginBottom: 6 },
  noteCost: {
    fontSize: 12,
    color: "#00A86B",
    fontWeight: "600",
    marginBottom: 4,
  },
  noteDate: { fontSize: 11, color: "#999" },
  noteResolved: { fontSize: 11, color: "#00A86B", marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#ffffff",
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
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  label: { fontSize: 13, fontWeight: "600", color: "#666666", marginBottom: 6 },
  input: {
    backgroundColor: "#f5f5f5",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 16,
  },
  textArea: { height: 80, textAlignVertical: "top" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#eeeeee",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666666",
    textTransform: "capitalize",
  },
  saveButton: {
    backgroundColor: "#00A86B",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
  movementToggle: { flexDirection: "row", gap: 12, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#eeeeee",
  },
  toggleBtnActiveIn: { backgroundColor: "#00A86B22", borderColor: "#00A86B" },
  toggleBtnActiveOut: { backgroundColor: "#E53E3E22", borderColor: "#E53E3E" },
  toggleBtnText: { fontSize: 14, fontWeight: "600", color: "#666666" },
  toggleBtnTextActive: { color: "#1a1a1a" },
});
