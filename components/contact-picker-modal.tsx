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

export type PickerSource = "recent" | "contact";
export type RecentCustomer = { id: string; name: string; number: string };

type PickableContact = { id: string; name: string; number: string };

type Row =
  | { key: string; kind: "header"; title: string }
  | { key: string; kind: "item"; name: string; number: string; source: PickerSource };

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, number: string, source: PickerSource) => void;
  // Saved customers (and ones waiting to sync), shown first.
  recents?: RecentCustomer[];
  // Set to false when contacts permission was not granted: only recents are shown.
  loadContacts?: boolean;
};

const NO_RECENTS: RecentCustomer[] = [];

function lastDigits(value: string): string {
  return value.replace(/\D/g, "").slice(-9);
}

// The sheet only exists while the modal is open, so its state starts fresh
// (empty search, loading) every time the list is opened.
function ContactPickerSheet({
  onClose,
  onSelect,
  recents,
  loadContacts,
}: {
  onClose: () => void;
  onSelect: (name: string, number: string, source: PickerSource) => void;
  recents: RecentCustomer[];
  loadContacts: boolean;
}) {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<PickableContact[]>([]);
  const [loading, setLoading] = useState(loadContacts);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loadContacts) return;
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
  }, [loadContacts]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const digits = query.replace(/\D/g, "");
    const matches = (name: string, number: string) =>
      !query ||
      name.toLowerCase().includes(query) ||
      (digits.length > 0 && number.replace(/\D/g, "").includes(digits));

    const recentMatches = recents.filter((r) => matches(r.name, r.number));
    const recentKeys = new Set(recents.map((r) => lastDigits(r.number)));
    const contactMatches = contacts.filter(
      (c) => !recentKeys.has(lastDigits(c.number)) && matches(c.name, c.number),
    );

    const list: Row[] = [];
    if (recentMatches.length > 0) {
      list.push({ key: "h-recent", kind: "header", title: "Your customers" });
      recentMatches.forEach((r) =>
        list.push({
          key: `r-${r.id}`,
          kind: "item",
          name: r.name,
          number: r.number,
          source: "recent",
        }),
      );
    }
    if (contactMatches.length > 0) {
      list.push({ key: "h-contacts", kind: "header", title: "Phone contacts" });
      contactMatches.forEach((c) =>
        list.push({
          key: `c-${c.id}`,
          kind: "item",
          name: c.name,
          number: c.number,
          source: "contact",
        }),
      );
    }
    return list;
  }, [contacts, recents, search]);

  return (
    <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.modalBackground, borderColor: colors.modalBorder },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Choose a customer</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Close customer list"
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

        {!loadContacts ? (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Contacts access is off, so only saved customers are shown.
          </Text>
        ) : null}

        {!loading && rows.length === 0 ? (
          <Text style={[styles.message, { color: colors.textMuted }]}>
            {failed
              ? "Could not read your contacts. Close this and try again."
              : search
                ? "No matching customers or contacts"
                : "No customers or contacts yet"}
          </Text>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            windowSize={7}
            ListFooterComponent={
              loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null
            }
            renderItem={({ item }) =>
              item.kind === "header" ? (
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {item.title}
                </Text>
              ) : (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: colors.border }]}
                  onPress={() => onSelect(item.name, item.number, item.source)}
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
              )
            }
          />
        )}
      </View>
    </View>
  );
}

export default function ContactPickerModal({
  visible,
  onClose,
  onSelect,
  recents = NO_RECENTS,
  loadContacts = true,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {visible ? (
        <ContactPickerSheet
          onClose={onClose}
          onSelect={onSelect}
          recents={recents}
          loadContacts={loadContacts}
        />
      ) : null}
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
  note: { fontSize: 12, marginBottom: 8 },
  loader: { marginTop: 16, marginBottom: 16 },
  message: { textAlign: "center", marginTop: 32, fontSize: 14 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: 12,
    marginBottom: 4,
  },
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 15, fontWeight: "600" },
  number: { fontSize: 13, marginTop: 2 },
});