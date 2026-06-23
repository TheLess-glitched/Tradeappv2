import { MessageCircle, Phone } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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

type Customer = {
  id: number;
  name: string;
  phone: string;
  service_type: string;
  created_at: string;
};

export default function CustomersScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

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
    if (!name || !phone) {
      Alert.alert("Missing info", "Please enter name and phone number.");
      return;
    }
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("customers").insert({
      user_id: user?.id,
      name,
      phone,
      service_type: serviceType,
    });
    setSaving(false);
    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setName("");
      setPhone("");
      setServiceType("");
      setModalVisible(false);
      fetchCustomers();
    }
  };

  const handleCall = (customer: Customer) =>
    Linking.openURL(`tel:${customer.phone}`);
  const handleSMS = (customer: Customer) =>
    Linking.openURL(`sms:${customer.phone}`);
  const handleWhatsApp = (customer: Customer) => {
    const number = customer.phone.replace(/^0/, "234");
    Linking.openURL(`whatsapp://send?phone=${number}`);
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search),
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Customers</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          placeholderTextColor="#4A5568"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator color="#F6A623" style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No customers yet</Text>
          <Text style={styles.emptySubText}>
            Tap "+ Add" to add your first customer
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {filtered.map((customer) => (
            <View key={customer.id} style={styles.customerCard}>
              <View style={styles.customerTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {customer.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>{customer.name}</Text>
                  <Text style={styles.customerPhone}>{customer.phone}</Text>
                  {customer.service_type ? (
                    <Text style={styles.customerService}>
                      {customer.service_type}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.contactButtons}>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => handleCall(customer)}
                >
                  <Phone size={16} color="#68D391" />
                  <Text style={[styles.contactBtnText, { color: "#68D391" }]}>
                    Call
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => handleWhatsApp(customer)}
                >
                  <MessageCircle size={16} color="#25D366" />
                  <Text style={[styles.contactBtnText, { color: "#25D366" }]}>
                    WhatsApp
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => handleSMS(customer)}
                >
                  <MessageCircle size={16} color="#63B3ED" />
                  <Text style={[styles.contactBtnText, { color: "#63B3ED" }]}>
                    SMS
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>New Customer</Text>

            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Emeka Okafor"
              placeholderTextColor="#4A5568"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Phone *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 08012345678"
              placeholderTextColor="#4A5568"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Service Type</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Car repair, Hair braiding"
              placeholderTextColor="#4A5568"
              value={serviceType}
              onChangeText={setServiceType}
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleAddCustomer}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#0A0F1E" />
              ) : (
                <Text style={styles.saveButtonText}>Save Customer</Text>
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFFFFF", flex: 1 },
  addButton: {
    backgroundColor: "#F6A623",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: { fontSize: 14, fontWeight: "700", color: "#0A0F1E" },
  searchWrapper: { paddingHorizontal: 20, marginBottom: 16 },
  searchInput: {
    backgroundColor: "#131929",
    borderWidth: 1,
    borderColor: "#1E2A3D",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: "#FFFFFF",
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  customerCard: {
    backgroundColor: "#131929",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  customerTop: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F6A623",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#0A0F1E" },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: "600", color: "#FFFFFF" },
  customerPhone: { fontSize: 13, color: "#718096", marginTop: 2 },
  customerService: { fontSize: 12, color: "#F6A623", marginTop: 4 },
  contactButtons: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#1E2A3D",
    paddingTop: 12,
  },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0A0F1E",
    borderRadius: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  contactBtnText: { fontSize: 12, fontWeight: "600" },
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
