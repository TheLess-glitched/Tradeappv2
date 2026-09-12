import { router } from "expo-router";
import { Check, ChevronDown, Search, X } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COUNTRIES, Country, DEFAULT_COUNTRY } from "../constants/countries";
import { CURRENCIES, formatCurrency } from "../constants/currency";
import { normalizePhone } from "../constants/phone";
import { supabase } from "../constants/supabase";
import { useTheme } from "../context/theme-context";

type CatalogueItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  selling_price: number | null;
  track_stock: boolean;
};

type Customer = {
  id: number;
  name: string;
  phone: string;
};

export default function NewJobScreen() {
  const { colors, currency, defaultCountryCode } = useTheme();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [service, setService] = useState("");
  const [price, setPrice] = useState("");
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[]>([]);
  const [cataloguePickerVisible, setCataloguePickerVisible] = useState(false);
  const [selectedCatalogueItem, setSelectedCatalogueItem] = useState<CatalogueItem | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const wasSelectedFromPickerRef = useRef(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadCatalogueItems = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;

      const { data } = await supabase
        .from("catalogue")
        .select("id, name, quantity, unit, selling_price, track_stock, reorder_level")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      setCatalogueItems(data ?? []);
    };

    loadCatalogueItems();

    const loadCustomers = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      setCustomers(data ?? []);
    };
    loadCustomers();
  }, []);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return COUNTRIES;
    const q = searchQuery.toLowerCase().trim();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial_code.includes(q) ||
        c.code.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleCustomerNameChange = (text: string) => {
    wasSelectedFromPickerRef.current = false;
    // Auto-capitalize the first letter of each word as the user types
    const titleCased = text.replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
    setCustomerName(titleCased);
  };

  const handleCustomerPhoneChange = (text: string) => {
    wasSelectedFromPickerRef.current = false;
    setCustomerPhone(text);
  };

  const handleCatalogueSelect = (item: CatalogueItem) => {
    setSelectedCatalogueItem(item);
    setService(item.name);
    setPrice(item.selling_price?.toString() ?? "");
    setCataloguePickerVisible(false);
  };

  const handleCustomerSelect = (customer: Customer) => {
    wasSelectedFromPickerRef.current = true;
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerPickerVisible(false);
  };

  const handleSave = async () => {
    if (!service.trim() || !price.trim()) {
      Alert.alert(
        "Missing info",
        "Please fill in service and price.",
      );
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const trimmedCustomerName = customerName.trim();

    // 1. Format the phone number dynamically using the selected country code
    let formattedPhone: string | null = "";
    if (customerPhone.trim()) {
      formattedPhone = normalizePhone(customerPhone, defaultCountryCode);
      if (!formattedPhone) {
        setLoading(false);
        Alert.alert("Invalid phone", "Enter a valid phone number.");
        return;
      }
    }

    let shouldInsertCustomer = false;
    if (
      formattedPhone &&
      trimmedCustomerName &&
      !wasSelectedFromPickerRef.current
    ) {
      const { data: existingCustomer, error: lookupError } = await supabase
        .from("customers")
        .select("id, name")
        .eq("user_id", user?.id)
        .eq("phone", formattedPhone)
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        setLoading(false);
        Alert.alert("Error", lookupError.message);
        return;
      }

      if (!existingCustomer) {
        shouldInsertCustomer = true;
      } else if (existingCustomer.name.trim() !== trimmedCustomerName) {
        const saveAsNew = await new Promise<boolean>((resolve) => {
          Alert.alert(
            `A customer named ${existingCustomer.name} already uses this number. What would you like to do?`,
            undefined,
            [
              {
                text: "Use existing customer",
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: "Save as new",
                onPress: () => resolve(true),
              },
            ],
          );
        });
        shouldInsertCustomer = saveAsNew;
      }
    }

    // 2. Auto-generate local Date and Time at the exact moment user saves
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const autoDate = `${day}/${month}/${year}`;

    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const autoTime = `${hours}:${minutes} ${ampm}`;

    // 3. Insert the Job with customer_phone saved directly
    const { data: createdJob, error: jobError } = await supabase
      .from("jobs")
      .insert({
        user_id: user?.id,
        customer_name: customerName.trim() || null,
        customer_phone: formattedPhone || null,
        service: service.trim(),
        price: parseInt(price.replace(/[^0-9]/g, ""), 10) || 0,
        date: autoDate,
        time: autoTime,
        notes: notes.trim(),
        status: selectedCatalogueItem?.track_stock ? "done" : "pending",
      })
      .select("id")
      .single();

    let lowStockAlertMessage: string | null = null;

    if (!jobError && selectedCatalogueItem?.track_stock) {
      try {
        const { data: stockData, error: stockError } = await supabase.rpc(
          "decrement_catalogue_stock",
          {
            p_catalogue_item_id: selectedCatalogueItem.id,
          },
        );

        const stockResult = Array.isArray(stockData) ? stockData[0] : stockData;
        const stockUpdated = stockResult?.updated;
        const newQuantity =
          stockResult?.new_quantity != null
            ? Number(stockResult.new_quantity)
            : null;
        const reorderLevel = Number(
          stockResult?.reorder_level ?? selectedCatalogueItem.reorder_level ?? 0,
        );
        const crossedThreshold = stockResult?.crossed_threshold === true;

        if (stockError || stockUpdated !== true) {
          Alert.alert(
            "Stock update failed",
            stockError?.message ??
              "The job was saved, but the catalogue stock could not be updated.",
          );
        } else if (stockUpdated === true) {
          if (
            reorderLevel > 0 &&
            newQuantity != null &&
            newQuantity <= reorderLevel
          ) {
            if (crossedThreshold) {
              lowStockAlertMessage = `${selectedCatalogueItem.name} just dropped to ${newQuantity} ${selectedCatalogueItem.unit} — at or below your reorder level of ${reorderLevel}.`;
            }
          }
        }
      } catch (rpcException) {
      }
    }

    // 4. Silently sync to Customers table
    if (shouldInsertCustomer && !jobError) {
      await supabase.from("customers").insert({
        user_id: user?.id,
        name: trimmedCustomerName,
        phone: formattedPhone,
        service_type: service.trim(),
      });
    }

    setLoading(false);

    if (jobError) {
      Alert.alert("Error", jobError.message);
    } else {
      const navigateToJobs = () => {
        router.replace({
          pathname: "/(tabs)/jobs",
          params:
            selectedCatalogueItem?.track_stock && createdJob?.id
              ? { completedJobId: String(createdJob.id) }
              : undefined,
        } as any);
      };

      const showJobSavedAlert = () => {
        Alert.alert("Success", "Job saved!", [
          {
            text: "OK",
            onPress: navigateToJobs,
          },
        ]);
      };

      if (lowStockAlertMessage) {
        Alert.alert("Low stock alert", lowStockAlertMessage, [
          {
            text: "OK",
            onPress: showJobSavedAlert,
          },
        ]);
      } else {
        showJobSavedAlert();
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Job</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.fieldWrapper}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Customer Name *</Text>
          <TouchableOpacity
            style={[styles.customerPickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setCustomerPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cataloguePickerText, { color: colors.textSecondary }]}>Choose Existing Customer</Text>
            <ChevronDown size={16} color={colors.textMuted} />
          </TouchableOpacity>
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
            value={customerName}
            onChangeText={handleCustomerNameChange}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Customer Phone (Optional)</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              style={[
                styles.input,
                styles.countryCodeBox,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                },
              ]}
              onPress={() => setCountryModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.codeBadge, { backgroundColor: colors.chipBackground, borderColor: colors.chipBorder }]}>
                <Text style={[styles.codeBadgeText, { color: colors.chipText }]}>
                  {selectedCountry.code}
                </Text>
              </View>
              <Text style={[styles.countryCodeText, { color: colors.text }]}>
                {selectedCountry.dial_code}
              </Text>
              <ChevronDown size={14} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
            <TextInput
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="801 234 5678"
              placeholderTextColor={colors.placeholder}
              value={customerPhone}
              onChangeText={handleCustomerPhoneChange}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Service *</Text>
          <TouchableOpacity
            style={[
              styles.cataloguePickerButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            onPress={() => setCataloguePickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={[styles.cataloguePickerText, { color: colors.textSecondary }]}>Choose from Catalogue</Text>
            <ChevronDown size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
            placeholder="e.g. Full car service"
            placeholderTextColor={colors.placeholder}
            value={service}
            onChangeText={setService}
          />
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Price ({CURRENCIES[currency].symbol}) *</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
            placeholder="e.g. 15000"
            placeholderTextColor={colors.placeholder}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
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
            placeholder="Any extra details about the job..."
            placeholderTextColor={colors.placeholder}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Status</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: colors.statusPending + "22",
                borderColor: colors.border,
              },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: colors.statusPending }]} />
            <Text style={[styles.statusText, { color: colors.statusPending }]}>Pending</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            loading && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.85}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>
              Save Job
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Country Code Picker Modal */}
      <Modal
        visible={countryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCountryModalVisible(false);
          setSearchQuery("");
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.countryModalContent,
              {
                backgroundColor: colors.modalBackground,
                borderColor: colors.modalBorder,
              },
            ]}
          >
            <View style={styles.countryModalHeader}>
              <Text style={[styles.countryModalTitle, { color: colors.text }]}>
                Select Country Code
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCountryModalVisible(false);
                  setSearchQuery("");
                }}
                style={styles.closeBtn}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.searchBox,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.inputText }]}
                placeholder="Search country or code..."
                placeholderTextColor={colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => `${item.code}-${item.dial_code}`}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected =
                  item.code === selectedCountry.code &&
                  item.dial_code === selectedCountry.dial_code;
                return (
                  <TouchableOpacity
                    style={[
                      styles.countryItem,
                      isSelected && {
                        backgroundColor: colors.surfaceHighlight,
                      },
                    ]}
                    onPress={() => {
                      setSelectedCountry(item);
                      setCountryModalVisible(false);
                      setSearchQuery("");
                    }}
                  >
                    <View
                      style={[
                        styles.codeBadge,
                        {
                          backgroundColor: colors.chipBackground,
                          borderColor: colors.chipBorder,
                          marginRight: 12,
                        },
                      ]}
                    >
                      <Text style={[styles.codeBadgeText, { color: colors.chipText }]}>
                        {item.code}
                      </Text>
                    </View>
                    <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.itemDialCode, { color: colors.textSecondary }]}>
                      {item.dial_code}
                    </Text>
                    {isSelected && (
                      <Check size={18} color={colors.primary} style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={customerPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomerPickerVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}> 
          <View style={[styles.countryModalContent, { backgroundColor: colors.modalBackground, borderColor: colors.modalBorder }]}>
            <View style={styles.countryModalHeader}>
              <Text style={[styles.countryModalTitle, { color: colors.text }]}>Choose Existing Customer</Text>
              <TouchableOpacity onPress={() => setCustomerPickerVisible(false)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={customers}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={[styles.emptyPickerText, { color: colors.textMuted }]}>No saved customers available.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.customerPickerItem}
                  onPress={() => {
                    handleCustomerSelect(item);
                  }}
                >
                  <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.itemDialCode, { color: colors.textSecondary }]}>{item.phone}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={cataloguePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCataloguePickerVisible(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}> 
          <View
            style={[
              styles.countryModalContent,
              {
                backgroundColor: colors.modalBackground,
                borderColor: colors.modalBorder,
              },
            ]}
          >
            <View style={styles.countryModalHeader}>
              <Text style={[styles.countryModalTitle, { color: colors.text }]}>Choose Catalogue Item</Text>
              <TouchableOpacity onPress={() => setCataloguePickerVisible(false)} style={styles.closeBtn}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {catalogueItems.length === 0 ? (
              <Text style={[styles.emptyPickerText, { color: colors.textMuted }]}>No catalogue items available.</Text>
            ) : (
              <FlatList
                data={catalogueItems}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.catalogueItem,
                      item.id === selectedCatalogueItem?.id && {
                        backgroundColor: colors.surfaceHighlight,
                      },
                    ]}
                    onPress={() => handleCatalogueSelect(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.itemDialCode, { color: colors.textSecondary }]}>
                        {item.selling_price == null ? "No selling price" : formatCurrency(item.selling_price, currency)}
                        {item.track_stock ? ` · ${item.quantity} ${item.unit || "units"} in stock` : ""}
                      </Text>
                    </View>
                    {item.id === selectedCatalogueItem?.id ? <Check size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  backButton: { width: 60 },
  backText: { fontSize: 15, fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  fieldWrapper: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  cataloguePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cataloguePickerText: { fontSize: 14, fontWeight: "600" },
  customerPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  customerPickerItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  catalogueItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  emptyPickerText: { textAlign: "center", paddingVertical: 32, fontSize: 14 },
  countryCodeBox: {
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  codeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6,
  },
  codeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  countryCodeText: { fontSize: 14, fontWeight: "600" },
  textArea: { height: 100, textAlignVertical: "top" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignSelf: "flex-start",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: { fontSize: 14, fontWeight: "600" },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  countryModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    borderWidth: 1,
  },
  countryModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  countryModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 6,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
  itemDialCode: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
});
