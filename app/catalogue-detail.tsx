import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
    AlertTriangle,
    ArrowLeft,
    ArrowLeftRight,
    FileText,
    Pencil,
    X,
} from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { CURRENCIES, formatCurrency } from "../constants/currency";
import { supabase } from "../constants/supabase";
import { useTheme } from "../context/theme-context";

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
  const { colors, currency } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<Item | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  const [noteModal, setNoteModal] = useState(false);
  const [noteType, setNoteType] = useState("general");
  const [noteStatus, setNoteStatus] = useState("reported");
  const [noteDesc, setNoteDesc] = useState("");
  const [noteCost, setNoteCost] = useState("");

  const [movModal, setMovModal] = useState(false);
  const [movType, setMovType] = useState<"in" | "out">("in");
  const [movQty, setMovQty] = useState("");
  const [movReason, setMovReason] = useState("");

  const noteTypeColors: Record<string, string> = {
    damage: colors.danger,
    repair: colors.primary,
    maintenance: colors.statusDone,
    inspection: colors.statusInProgress,
    custom: colors.secondary,
    general: colors.textMuted,
  };

  const statusColors: Record<string, string> = {
    reported: colors.danger,
    in_progress: colors.primary,
    awaiting_parts: colors.secondary,
    repaired: colors.statusDone,
    retired: colors.textMuted,
    resolved: colors.statusDone,
  };

  const fetchAll = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }
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

    if (itemData) {
      setItem(itemData);
      hasDataRef.current = true;
    }
    if (movData) setMovements(movData);
    if (noteData) setNotes(noteData);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (id) fetchAll();
    }, [id, fetchAll]),
  );

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

    const newQty =
      movType === "in" ? item.quantity + qty : item.quantity - qty;

    await supabase
      .from("catalogue")
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq("id", id);

    resetMovForm();
    fetchAll();
  };

  const resetNoteForm = () => {
    setNoteType("general");
    setNoteStatus("reported");
    setNoteDesc("");
    setNoteCost("");
    setNoteModal(false);
  };

  const resetMovForm = () => {
    setMovType("in");
    setMovQty("");
    setMovReason("");
    setMovModal(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const isLowStock =
    item && item.reorder_level > 0 && item.quantity <= item.reorder_level;

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: colors.textMuted }}>Loading item...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: colors.textMuted }}>Item not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 16 }}
        >
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Edit Item", "Edit functionality coming soon.")
          }
        >
          <Pencil size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            isLowStock && {
              borderColor: colors.danger,
              backgroundColor: colors.dangerSurface,
            },
          ]}
        >
          <View style={styles.heroTop}>
            <View>
              <Text
                style={[
                  styles.heroQty,
                  { color: colors.statusDone },
                  isLowStock && { color: colors.danger },
                ]}
              >
                {item.quantity}
              </Text>
              <Text style={[styles.heroUnit, { color: colors.textMuted }]}>{item.unit}</Text>
            </View>
            <View
              style={[
                styles.categoryBadge,
                { backgroundColor: colors.secondarySurface },
              ]}
            >
              <Text style={[styles.categoryBadgeText, { color: colors.secondaryText }]}>
                {item.category}
              </Text>
            </View>
          </View>
          {isLowStock && (
            <View style={styles.lowStockRow}>
              <AlertTriangle size={14} color={colors.danger} />
              <Text style={[styles.lowStockText, { color: colors.danger }]}>
                Below reorder level ({item.reorder_level} {item.unit})
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metaGrid}>
          {item.cost_price ? (
            <View
              style={[
                styles.metaBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Cost Price</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {formatCurrency(item.cost_price || 0, currency)}
              </Text>
            </View>
          ) : null}
          {item.selling_price ? (
            <View
              style={[
                styles.metaBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Selling Price</Text>
              <Text style={[styles.metaValue, { color: colors.text }]}>
                {formatCurrency(item.selling_price || 0, currency)}
              </Text>
            </View>
          ) : null}
          {item.supplier ? (
            <View
              style={[
                styles.metaBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Supplier</Text>
              <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
                {item.supplier}
              </Text>
            </View>
          ) : null}
          {item.location ? (
            <View
              style={[
                styles.metaBox,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Location</Text>
              <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
                {item.location}
              </Text>
            </View>
          ) : null}
          <View
            style={[
              styles.metaBox,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Reorder Level</Text>
            <Text style={[styles.metaValue, { color: colors.text }]}>
              {item.reorder_level} {item.unit}
            </Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => setMovModal(true)}
          >
            <ArrowLeftRight size={16} color={colors.primaryText} />
            <Text style={[styles.actionBtnText, { color: colors.primaryText }]}>
              Record Movement
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                backgroundColor: colors.secondarySurface,
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
            onPress={() => setNoteModal(true)}
          >
            <FileText size={16} color={colors.secondaryText} />
            <Text style={[styles.actionBtnText, { color: colors.secondaryText }]}>
              Add Note
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Stock History</Text>
          {movements.length === 0 ? (
            <Text style={[styles.emptySection, { color: colors.textMuted }]}>
              No movements recorded yet.
            </Text>
          ) : (
            movements.map((m) => (
              <View key={m.id} style={styles.movementRow}>
                <View
                  style={[
                    styles.movementDot,
                    {
                      backgroundColor:
                        m.movement_type === "in" ? colors.statusDone : colors.danger,
                    },
                  ]}
                />
                <View style={styles.movementBody}>
                  <Text style={[styles.movementText, { color: colors.text }]}>
                    <Text style={{ fontWeight: "700" }}>
                      {m.movement_type === "in" ? "+" : "-"}
                      {m.quantity}
                    </Text>{" "}
                    {item.unit}
                  </Text>
                  {m.reason ? (
                    <Text style={[styles.movementReason, { color: colors.textSecondary }]}>
                      {m.reason}
                    </Text>
                  ) : null}
                  <Text style={[styles.movementDate, { color: colors.textMuted }]}>
                    {formatDate(m.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Item Notes</Text>
          {notes.length === 0 ? (
            <Text style={[styles.emptySection, { color: colors.textMuted }]}>
              No notes yet. Tap &quot;Add Note&quot; to create one.
            </Text>
          ) : (
            notes.map((n) => (
              <View
                key={n.id}
                style={[
                  styles.noteCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.noteHeader}>
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          (noteTypeColors[n.note_type] || colors.textMuted) + "22",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeBadgeText,
                        { color: noteTypeColors[n.note_type] || colors.textMuted },
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
                          (statusColors[n.status] || colors.textMuted) + "22",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: statusColors[n.status] || colors.textMuted },
                      ]}
                    >
                      {n.status.replace("_", " ")}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.noteDesc, { color: colors.text }]}>
                  {n.description}
                </Text>
                {n.cost ? (
                  <Text style={[styles.noteCost, { color: colors.statusDone }]}>
                    Cost: {formatCurrency(n.cost || 0, currency)}
                  </Text>
                ) : null}
                <Text style={[styles.noteDate, { color: colors.textMuted }]}>
                  {formatDate(n.created_at)}
                </Text>
                {n.resolved_at ? (
                  <Text style={[styles.noteResolved, { color: colors.statusDone }]}>
                    Resolved: {formatDate(n.resolved_at)}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Note Modal */}
      <Modal visible={noteModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.modalBackground,
                borderColor: colors.modalBorder,
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Item Note</Text>
              <TouchableOpacity onPress={resetNoteForm}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Note Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {noteTypes.map((t) => {
                    const isSelected = noteType === t;
                    return (
                      <TouchableOpacity
                        key={t}
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
                        onPress={() => setNoteType(t)}
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
                          {t}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {statuses.map((s) => {
                    const isSelected = noteStatus === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isSelected
                              ? colors.secondary
                              : colors.chipBackground,
                            borderColor: isSelected
                              ? colors.secondary
                              : colors.chipBorder,
                          },
                        ]}
                        onPress={() => setNoteStatus(s)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: isSelected
                                ? "#FFFFFF"
                                : colors.chipText,
                              fontWeight: isSelected ? "700" : "500",
                            },
                          ]}
                        >
                          {s.replace("_", " ")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                placeholder="Describe the issue or update..."
                placeholderTextColor={colors.placeholder}
                value={noteDesc}
                onChangeText={setNoteDesc}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Cost (optional, {CURRENCIES[currency].symbol})
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
                value={noteCost}
                onChangeText={setNoteCost}
                keyboardType="numeric"
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleAddNote}
              >
                <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>
                  Save Note
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Movement Modal */}
      <Modal visible={movModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                maxHeight: "55%",
                backgroundColor: colors.modalBackground,
                borderColor: colors.modalBorder,
                borderWidth: 1,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Record Stock Movement
              </Text>
              <TouchableOpacity onPress={resetMovForm}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.movementToggle}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor:
                      movType === "in" ? colors.primary : colors.surfaceSubtle,
                    borderColor:
                      movType === "in" ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setMovType("in")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    {
                      color:
                        movType === "in"
                          ? colors.primaryText
                          : colors.textSecondary,
                      fontWeight: movType === "in" ? "700" : "500",
                    },
                  ]}
                >
                  + Stock In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  {
                    backgroundColor:
                      movType === "out" ? colors.danger : colors.surfaceSubtle,
                    borderColor:
                      movType === "out" ? colors.danger : colors.border,
                  },
                ]}
                onPress={() => setMovType("out")}
              >
                <Text
                  style={[
                    styles.toggleBtnText,
                    {
                      color: movType === "out" ? "#FFFFFF" : colors.textSecondary,
                      fontWeight: movType === "out" ? "700" : "500",
                    },
                  ]}
                >
                  - Stock Out
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
              value={movQty}
              onChangeText={setMovQty}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Reason (optional)
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
              placeholder="e.g. New delivery, Sold to customer"
              placeholderTextColor={colors.placeholder}
              value={movReason}
              onChangeText={setMovReason}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor:
                    movType === "in" ? colors.primary : colors.danger,
                },
              ]}
              onPress={handleMovement}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  {
                    color:
                      movType === "in" ? colors.primaryText : "#FFFFFF",
                  },
                ]}
              >
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
  container: { flex: 1 },
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
    flex: 1,
    marginHorizontal: 12,
  },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroQty: { fontSize: 36, fontWeight: "800" },
  heroUnit: { fontSize: 14, marginTop: 2 },
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
  lowStockText: { fontSize: 13, fontWeight: "600" },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  metaBox: {
    width: "47%",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  metaLabel: {
    fontSize: 11,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: { fontSize: 14, fontWeight: "700" },
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
  actionBtnText: { fontSize: 14, fontWeight: "700" },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  emptySection: { fontSize: 13, fontStyle: "italic" },
  movementRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  movementDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  movementBody: { flex: 1 },
  movementText: { fontSize: 14 },
  movementReason: { fontSize: 12, marginTop: 2 },
  movementDate: { fontSize: 11, marginTop: 2 },
  noteCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
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
  noteDesc: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  noteCost: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  noteDate: { fontSize: 11 },
  noteResolved: { fontSize: 11, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
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
  textArea: { height: 80, textAlignVertical: "top" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    textTransform: "capitalize",
  },
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
