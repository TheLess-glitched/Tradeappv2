import { router } from "expo-router";
import {
  ArrowLeft,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
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
import { supabase } from "../constants/supabase";
import { useTheme } from "../context/theme-context";

type Note = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  created_at: string;
};

export default function NotesScreen() {
  const { colors } = useTheme();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("General");
  const [tagsInput, setTagsInput] = useState("");

  const categories = [
    "All",
    "General",
    "Supplier",
    "Urgent",
    "Ideas",
    "Finance",
  ];

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("general_notes")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });
    if (!error && data) setNotes(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing info", "Please enter a title.");
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingNote) {
      const { error } = await supabase
        .from("general_notes")
        .update({
          title,
          body,
          category,
          tags,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingNote.id);
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from("general_notes")
        .insert({ user_id: user?.id, title, body, category, tags });
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
    }

    resetForm();
    fetchNotes();
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete Note", "Are you sure you want to delete this note?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await supabase.from("general_notes").delete().eq("id", id);
          fetchNotes();
        },
      },
    ]);
  };

  const openEdit = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setBody(note.body || "");
    setCategory(note.category);
    setTagsInput(note.tags?.join(", ") || "");
    setModalVisible(true);
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setCategory("General");
    setTagsInput("");
    setEditingNote(null);
    setModalVisible(false);
  };

  const filtered = notes.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.body?.toLowerCase().includes(search.toLowerCase()) ||
      n.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory =
      selectedCategory === "All" || n.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notes</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Plus size={24} color={colors.primaryText} />
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
          placeholder="Search notes..."
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: isSelected
                    ? colors.primary
                    : colors.chipBackground,
                  borderColor: isSelected
                    ? colors.primary
                    : colors.chipBorder,
                },
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryChipText,
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
      </ScrollView>

      {loading ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Loading...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <FileText size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No notes yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Tap + to add your first note
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.noteCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => openEdit(item)}
            >
              <View style={styles.noteHeader}>
                <Text
                  style={[styles.noteTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Trash2 size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
              {item.body ? (
                <Text
                  style={[styles.noteBody, { color: colors.textSecondary }]}
                  numberOfLines={2}
                >
                  {item.body}
                </Text>
              ) : null}
              <View style={styles.noteMeta}>
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: colors.secondarySurface },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryBadgeText,
                      { color: colors.secondaryText },
                    ]}
                  >
                    {item.category}
                  </Text>
                </View>
                <Text style={[styles.noteDate, { color: colors.textMuted }]}>
                  {formatDate(item.created_at)}
                </Text>
              </View>
              {item.tags?.length > 0 && (
                <View style={styles.tagsRow}>
                  {item.tags.map((tag) => (
                    <View
                      key={tag}
                      style={[
                        styles.tag,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[styles.tagText, { color: colors.secondary }]}>
                        #{tag}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Add / Edit Note Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingNote ? "Edit Note" : "New Note"}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                placeholder="Note title"
                placeholderTextColor={colors.placeholder}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Body</Text>
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
                placeholder="Write your note here..."
                placeholderTextColor={colors.placeholder}
                value={body}
                onChangeText={setBody}
                multiline
                numberOfLines={4}
              />

              <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {categories
                    .filter((c) => c !== "All")
                    .map((cat) => {
                      const isSelected = category === cat;
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.categoryChip,
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
                              styles.categoryChipText,
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

              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Tags (comma separated)
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
                placeholder="e.g. urgent, supplier, friday"
                placeholderTextColor={colors.placeholder}
                value={tagsInput}
                onChangeText={setTagsInput}
              />

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>
                  {editingNote ? "Update Note" : "Save Note"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
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
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
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
  categoryScroll: { maxHeight: 44 },
  categoryContent: { paddingHorizontal: 20, gap: 8 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 13 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptySubtext: { fontSize: 13 },
  list: { padding: 20, gap: 12 },
  noteCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  noteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  noteBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  noteMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: "600" },
  noteDate: { fontSize: 11 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, fontWeight: "500" },
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
  modalTitle: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
});
