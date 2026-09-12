import * as Contacts from "expo-contacts";
import { MessageCircle, Phone } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { normalizePhone } from "../../constants/phone";
import { supabase } from "../../constants/supabase";
import { ThemeColors } from "../../constants/theme";
import { useTheme } from "../../context/theme-context";

type Customer = {
  id: number;
  name: string;
  phone: string;
  service_type: string;
  created_at: string;
};

function SearchHeader({
  colors,
  search,
  onSearchChange,
}: {
  colors: ThemeColors;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <View style={styles.searchWrapper}>
      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.inputText,
          },
        ]}
        placeholder="Search by name or phone..."
        placeholderTextColor={colors.placeholder}
        value={search}
        onChangeText={onSearchChange}
      />
    </View>
  );
}

export default function CustomersScreen() {
  const { colors, defaultCountryCode } = useTheme();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(search);
  const colorsRef = useRef(colors);
  searchRef.current = search;
  colorsRef.current = colors;

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false });
    if (!error && data) setCustomers(data);
    setLoading(false);
  };

  const handleAddCustomer = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = normalizePhone(phone, defaultCountryCode);

    if (!trimmedName || !trimmedPhone) {
      Alert.alert("Invalid phone", "Enter a valid phone number.");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const insertCustomer = async () => {
      const { error } = await supabase.from("customers").insert({
        user_id: user?.id,
        name: trimmedName,
        phone: trimmedPhone,
        service_type: serviceType,
      });

      setSaving(false);
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      setName("");
      setPhone("");
      setServiceType("");
      setModalVisible(false);
      fetchCustomers();
    };

    const { data: existingCustomer, error: lookupError } = await supabase
      .from("customers")
      .select("id, name")
      .eq("user_id", user?.id)
      .eq("phone", trimmedPhone)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      setSaving(false);
      Alert.alert("Error", lookupError.message);
      return;
    }

    if (!existingCustomer) {
      await insertCustomer();
      return;
    }

    setSaving(false);

    if (existingCustomer.name.trim() === trimmedName) {
      setName("");
      setPhone("");
      setServiceType("");
      setModalVisible(false);
      return;
    }

    Alert.alert(
      `A customer named ${existingCustomer.name} already uses this number. What would you like to do?`,
      undefined,
      [
        {
          text: "Use existing customer",
          style: "cancel",
          onPress: () => {
            setName("");
            setPhone("");
            setServiceType("");
            setModalVisible(false);
          },
        },
        { text: "Save as new", onPress: insertCustomer },
      ],
    );
  };

  const handleImportFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== Contacts.PermissionStatus.GRANTED) {
      Alert.alert(
        "Contacts permission needed",
        "TradeApp needs contacts access to import a customer's name and phone number.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    const contact = await Contacts.presentContactPickerAsync();
    if (!contact) return;

    const contactPhone = contact.phoneNumbers?.[0]?.number?.trim();
    if (!contact.name?.trim() || !contactPhone) {
      Alert.alert(
        "No phone number found",
        "The selected contact does not have a phone number to import.",
      );
      return;
    }

    setName(contact.name.trim());
    setPhone(normalizePhone(contactPhone, defaultCountryCode) ?? "");
  };

  const handleCall = (customer: Customer) =>
    Linking.openURL(`tel:${customer.phone}`);
  const handleSMS = (customer: Customer) =>
    Linking.openURL(`sms:${customer.phone}`);
  const handleWhatsApp = (customer: Customer) => {
    const clean = customer.phone.replace(/\D/g, "");
    const number = clean.replace(/^\+/, "");
    Linking.openURL(`https://wa.me/${number}`);
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(normalizePhone(search, defaultCountryCode) ?? ""),
  );

  const renderSearchHeader = useCallback(
    () => (
      <SearchHeader
        colors={colorsRef.current}
        search={searchRef.current}
        onSearchChange={setSearch}
      />
    ),
    [],
  );

  const renderCustomerItem = useCallback(
    ({ item: customer }: { item: Customer }) => (
      <View
        style={[
          styles.customerCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.customerTop}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.secondarySurface },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.secondary }]}>
              {customer.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.customerInfo}>
            <Text style={[styles.customerName, { color: colors.text }]}>
              {customer.name}
            </Text>
            <Text style={[styles.customerPhone, { color: colors.textMuted }]}>
              {customer.phone}
            </Text>
            {customer.service_type ? (
              <Text style={[styles.customerService, { color: colors.secondary }]}>
                {customer.service_type}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.contactButtons, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.contactBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
              },
            ]}
            onPress={() => handleCall(customer)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Phone size={15} color={colors.statusDone} />
            <Text style={[styles.contactBtnText, { color: colors.statusDone }]}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.contactBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
              },
            ]}
            onPress={() => handleWhatsApp(customer)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MessageCircle size={15} color="#25D366" />
            <Text style={[styles.contactBtnText, { color: "#25D366" }]}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.contactBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
              },
            ]}
            onPress={() => handleSMS(customer)}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MessageCircle size={15} color={colors.statusInProgress} />
            <Text style={[styles.contactBtnText, { color: colors.statusInProgress }]}>SMS</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [colors],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Customers</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Text style={[styles.addButtonText, { color: colors.primaryText }]}>+ Add</Text>
        </TouchableOpacity>
      </View>

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
              <View style={[styles.skeletonAvatar, { backgroundColor: colors.border }]} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.skeletonLine, { width: "52%", backgroundColor: colors.border }]} />
                <View style={[styles.skeletonLine, { width: "70%", backgroundColor: colors.border }]} />
                <View style={[styles.skeletonLine, { width: "38%", backgroundColor: colors.border }]} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCustomerItem}
          ListHeaderComponent={renderSearchHeader}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <Text style={[styles.emptyIconText, { color: colors.primary }]}>C</Text>
              </View>
              <Text style={[styles.emptyText, { color: colors.text }]}>No customers yet</Text>
              <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                Tap + Add to add your first customer
              </Text>
            </View>
          )}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
        />
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Customer</Text>

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
              placeholder="e.g. Emeka Okafor"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
            />

            <Text style={[styles.label, { color: colors.textSecondary }]}>Phone *</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="e.g. 08012345678"
              placeholderTextColor={colors.placeholder}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={[
                styles.importButton,
                {
                  backgroundColor: colors.secondarySurface,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleImportFromContacts}
              activeOpacity={0.7}
            >
              <Text style={[styles.importButtonText, { color: colors.secondaryText }]}>Import from Contacts</Text>
            </TouchableOpacity>

            <Text style={[styles.label, { color: colors.textSecondary }]}>Service Type</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="e.g. Car repair, Hair braiding"
              placeholderTextColor={colors.placeholder}
              value={serviceType}
              onChangeText={setServiceType}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: colors.primary },
                saving && styles.saveButtonDisabled,
              ]}
              onPress={handleAddCustomer}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>
                  Save Customer
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", flex: 1 },
  addButton: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: { fontSize: 14, fontWeight: "700" },
  searchWrapper: { paddingHorizontal: 20, marginBottom: 16 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  skeletonList: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
  },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyIconText: { fontSize: 20, fontWeight: "800" },
  emptyText: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySubText: { fontSize: 13, textAlign: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  customerCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  customerTop: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 18, fontWeight: "700" },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 17, fontWeight: "700" },
  customerPhone: { fontSize: 13, marginTop: 2 },
  customerService: { fontSize: 12, marginTop: 4, fontWeight: "600" },
  contactButtons: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    minHeight: 42,
  },
  contactBtnText: { fontSize: 12, fontWeight: "600" },
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
  importButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  importButtonText: { fontSize: 14, fontWeight: "600" },
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
