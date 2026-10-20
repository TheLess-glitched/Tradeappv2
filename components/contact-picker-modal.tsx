import * as Contacts from "expo-contacts/legacy";
import { X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../context/theme-context";

type PickableContact = { id: string; name: string; number: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, number: string) => void;
};

// The sheet only exists while the modal is open, so its state starts fresh
// (empty search, loading) every time the list is opened.
function ContactPickerSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (name: string, number: string) => void;
}) {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<PickableContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
      sort: Contacts.SortTypes.FirstName,
    })
      .then((result) => {
        if (!active) return;
        const list: PickableContact[] = [];
        for (const contact of result.data) {
          const number = contact.phoneNumbers?.[0]?.number?.trim();
          const name = contact.name?.trim();
          if (contact.id && name && number) {
            list.push({ id: contact.id, name, number });
          }
        }
        setContacts(list);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return contacts;
    const digits = query.replace(/\D/g, "");
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        (digits.length > 0 && contact.number.replace(/\D/g, "").includes(digits)),
    );
  }, [contacts, search]);

  return (
    <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.modalBackground, borderColor: colors.modalBorder },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Choose a contact</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close contact list"
          >
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TextInput
          style={[
            styles.search,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
              color: colors.inputText,
            },
          ]}
          placeholder="Search by name or number..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />

        {loading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : failed ? (
          <Text style={[styles.message, { color: colors.textMuted }]}>
            Couldn&apos;t read your contacts. Close this and try again.
          </Text>
        ) : filtered.length === 0 ? (
          <Text style={[styles.message, { color: colors.textMuted }]}>
            {search ? "No matching contacts" : "No contacts with a phone number"}
          </Text>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            windowSize={7}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: colors.border }]}
                onPress={() => onSelect(item.name, item.number)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Use ${item.name}`}
              >
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.number, { color: colors.textMuted }]}>
                  {item.number}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </View>
  );
}

export default function ContactPickerModal({ visible, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible ? <ContactPickerSheet onClose={onClose} onSelect={onSelect} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    height: "85%",
    borderWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "700" },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 8,
  },
  loader: { marginTop: 32 },
  message: { textAlign: "center", marginTop: 32, fontSize: 14 },
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 15, fontWeight: "600" },
  number: { fontSize: 13, marginTop: 2 },
});