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
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../constants/supabase";

type Note = {
  id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  created_at: string;
};

export default function NotesScreen() {
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
    Alert.alert("Delete Note", "Are you sure?", [
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notes</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Plus size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Search size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search notes..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <FileText size={48} color="#cccccc" />
          <Text style={styles.emptyText}>No notes yet</Text>
          <Text style={styles.emptySubtext}>Tap + to add your first note</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.noteCard}
              onPress={() => openEdit(item)}
            >
              <View style={styles.noteHeader}>
                <Text style={styles.noteTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Trash2 size={16} color="#cccccc" />
                </TouchableOpacity>
              </View>
              {item.body ? (
                <Text style={styles.noteBody} numberOfLines={2}>
                  {item.body}
                </Text>
              ) : null}
              <View style={styles.noteMeta}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.category}</Text>
                </View>
                <Text style={styles.noteDate}>
                  {formatDate(item.created_at)}
                </Text>
              </View>
              {item.tags?.length > 0 && (
                <View style={styles.tagsRow}>
                  {item.tags.map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingNote ? "Edit Note" : "New Note"}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <X size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Note title"
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
              />

              <Text style={styles.label}>Body</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Write your note here..."
                placeholderTextColor="#999"
                value={body}
                onChangeText={setBody}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 16 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {categories
                    .filter((c) => c !== "All")
                    .map((cat) => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryChip,
                          category === cat && styles.categoryChipActive,
                        ]}
                        onPress={() => setCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            category === cat && styles.categoryChipTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>

              <Text style={styles.label}>Tags (comma separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. urgent, supplier, friday"
                placeholderTextColor="#999"
                value={tagsInput}
                onChangeText={setTagsInput}
              />

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>
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
  container: { flex: 1, backgroundColor: "#ffffff" },
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
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#00A86B",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#1a1a1a" },
  categoryScroll: { maxHeight: 44 },
  categoryContent: { paddingHorizontal: 20, gap: 8 },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#eeeeee",
  },
  categoryChipActive: { backgroundColor: "#00A86B", borderColor: "#00A86B" },
  categoryChipText: { fontSize: 13, fontWeight: "500", color: "#666666" },
  categoryChipTextActive: { color: "#ffffff" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#999999" },
  emptySubtext: { fontSize: 13, color: "#cccccc" },
  list: { padding: 20, gap: 12 },
  noteCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eeeeee",
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
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  noteBody: {
    fontSize: 13,
    color: "#666666",
    lineHeight: 18,
    marginBottom: 10,
  },
  noteMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryBadge: {
    backgroundColor: "#00A86B22",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: "600", color: "#00A86B" },
  noteDate: { fontSize: 11, color: "#999999" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: {
    backgroundColor: "#f0f0f0",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11, color: "#666666" },
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
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
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
  textArea: { height: 100, textAlignVertical: "top" },
  saveButton: {
    backgroundColor: "#00A86B",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#ffffff" },
});
