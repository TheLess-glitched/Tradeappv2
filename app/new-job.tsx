import { router } from "expo-router";
import { Calendar, Check, ChevronDown, Clock, Search, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
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
import { showFeedback } from "../components/app-feedback";
import { COUNTRIES, Country, DEFAULT_COUNTRY } from "../constants/countries";
import { CURRENCIES, formatCurrency } from "../constants/currency";
import { normalizePhone } from "../constants/phone";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
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
  const { businessId } = useAuth();
  const { colors, currency, defaultCountryCode } = useTheme();

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [service, setService] = useState("");
  const [price, setPrice] = useState("");
  const [catalogueItems, setCatalogueItems] = useState<CatalogueItem[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [cataloguePickerVisible, setCataloguePickerVisible] = useState(false);
  const [selectedCatalogueItem, setSelectedCatalogueItem] = useState<CatalogueItem | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false);
  const wasSelectedFromPickerRef = useRef(false);
  const [estimatedFinishAt, setEstimatedFinishAt] = useState<Date | null>(null);
  const [finishPickerVisible, setFinishPickerVisible] = useState(false);
  const [tempFinishDate, setTempFinishDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const upcomingDays = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const formatEstimatedFinish = (date: Date) => {
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear();

    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const timePart = `${hours}:${minutes} ${ampm}`;

    if (isToday) {
      return `Today at ${timePart}`;
    }
    if (isTomorrow) {
      return `Tomorrow at ${timePart}`;
    }

    const datePart = date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `${datePart} at ${timePart}`;
  };

  useEffect(() => {
    const loadCatalogueItems = async () => {
      setCatalogueLoading(true);
      try {
        if (!businessId) {
          setCatalogueItems([]);
          return;
        }

        const { data } = await supabase
          .from("catalogue")
          .select("id, name, quantity, unit, selling_price, track_stock, reorder_level")
          .eq("business_id", businessId)
          .order("name", { ascending: true });

        setCatalogueItems(data ?? []);
      } finally {
        setCatalogueLoading(false);
      }
    };

    loadCatalogueItems();

    const loadCustomers = async () => {
      if (!businessId) {
        setCustomers([]);
        return;
      }
      const { data } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("business_id", businessId)
        .order("name", { ascending: true });
      setCustomers(data ?? []);
    };
    loadCustomers();
  }, [businessId]);

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
      showFeedback(
        "Missing info",
        "Please fill in service and price.",
      );
      return;
    }

    setLoading(true);

    if (!businessId) {
      setLoading(false);
      showFeedback("Error", "No active business is available.");
      return;
    }

    const trimmedCustomerName = customerName.trim();

    // 1. Format the phone number dynamically using the selected country code
    let formattedPhone: string | null = "";
    if (customerPhone.trim()) {
      formattedPhone = normalizePhone(customerPhone, defaultCountryCode);
      if (!formattedPhone) {
        setLoading(false);
        showFeedback("Invalid phone", "Enter a valid phone number.");
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
        .eq("business_id", businessId)
        .eq("phone", formattedPhone)
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        setLoading(false);
        showFeedback("Error", lookupError.message);
        return;
      }

      if (!existingCustomer) {
        shouldInsertCustomer = true;
      } else if (existingCustomer.name.trim() !== trimmedCustomerName) {
        const saveAsNew = await new Promise<boolean>((resolve) => {
          showFeedback(
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

    // Insert the Job with customer_phone saved directly
    const { data: createdJob, error: jobError } = await supabase
      .from("jobs")
      .insert({
        user_id: businessId,
        business_id: businessId,
        customer_name: customerName.trim() || null,
        customer_phone: formattedPhone || null,
        service: service.trim(),
        price: parseInt(price.replace(/[^0-9]/g, ""), 10) || 0,
        estimated_finish_at: estimatedFinishAt
          ? estimatedFinishAt.toISOString()
          : null,
        notes: notes.trim(),
        status: "pending",
      })
      .select("id")
      .single();

    const lowStockAlertMessage: string | null = null;



    // 4. Silently sync to Customers table
    if (shouldInsertCustomer && !jobError) {
      await supabase.from("customers").insert({
        user_id: businessId,
        business_id: businessId,
        name: trimmedCustomerName,
        phone: formattedPhone,
        service_type: service.trim(),
      });
    }

    setLoading(false);

    if (jobError) {
      showFeedback("Error", jobError.message);
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
        showFeedback("Success", "Job saved!", [
          {
            text: "OK",
            onPress: navigateToJobs,
          },
        ]);
      };

      if (lowStockAlertMessage) {
        showFeedback("Low stock alert", lowStockAlertMessage, [
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
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Estimated Finish (Optional)
            </Text>
            {estimatedFinishAt ? (
              <TouchableOpacity
                onPress={() => setEstimatedFinishAt(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.clearLinkText, { color: colors.danger }]}>
                  No deadline
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {estimatedFinishAt ? (
            <TouchableOpacity
              style={[
                styles.deadlineActiveCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => {
                setTempFinishDate(new Date(estimatedFinishAt));
                setFinishPickerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.deadlineIconBox, { backgroundColor: colors.primary + "1A" }]}>
                <Clock size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.deadlineActiveValue, { color: colors.text }]}>
                  {formatEstimatedFinish(estimatedFinishAt)}
                </Text>
                <Text style={[styles.deadlineActiveSubtitle, { color: colors.textMuted }]}>
                  Tap to change target finish time
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.removeDeadlineButton, { backgroundColor: colors.surfaceHighlight }]}
                onPress={() => setEstimatedFinishAt(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          ) : (
            <View>
              <TouchableOpacity
                style={[
                  styles.deadlineEmptyButton,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                  },
                ]}
                onPress={() => {
                  const d = new Date();
                  d.setHours(d.getHours() + 2, 0, 0, 0);
                  setTempFinishDate(d);
                  setFinishPickerVisible(true);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Calendar size={18} color={colors.textMuted} />
                  <Text style={[styles.deadlineEmptyText, { color: colors.placeholder }]}>
                    No deadline set (Tap to set)
                  </Text>
                </View>
                <ChevronDown size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.quickPresetRow}>
                <TouchableOpacity
                  style={[
                    styles.quickPresetChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    const d = new Date();
                    d.setHours(d.getHours() + 2, 0, 0, 0);
                    setEstimatedFinishAt(d);
                  }}
                >
                  <Text style={[styles.quickPresetText, { color: colors.textSecondary }]}>
                    +2 hrs
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.quickPresetChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    const d = new Date();
                    d.setHours(17, 0, 0, 0);
                    if (d.getTime() <= Date.now()) {
                      d.setDate(d.getDate() + 1);
                    }
                    setEstimatedFinishAt(d);
                  }}
                >
                  <Text style={[styles.quickPresetText, { color: colors.textSecondary }]}>
                    Today 5 PM
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.quickPresetChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(12, 0, 0, 0);
                    setEstimatedFinishAt(d);
                  }}
                >
                  <Text style={[styles.quickPresetText, { color: colors.textSecondary }]}>
                    Tomorrow 12 PM
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.quickPresetChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 2);
                    d.setHours(17, 0, 0, 0);
                    setEstimatedFinishAt(d);
                  }}
                >
                  <Text style={[styles.quickPresetText, { color: colors.textSecondary }]}>
                    In 2 days
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
            {catalogueLoading ? (
              <ActivityIndicator color={colors.primary} style={{ paddingVertical: 32 }} />
            ) : catalogueItems.length === 0 ? (
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

      {/* Estimated Finish Date/Time Picker Modal */}
      <Modal
        visible={finishPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFinishPickerVisible(false)}
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
              <View>
                <Text style={[styles.countryModalTitle, { color: colors.text }]}>
                  Estimated Finish
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  Optional target completion date & time
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setFinishPickerVisible(false)}
                style={styles.closeBtn}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Quick Presets */}
              <Text style={[styles.pickerSectionLabel, { color: colors.textSecondary }]}>
                Quick Presets
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsScroll}
              >
                {[
                  {
                    label: "+1 Hour",
                    getDate: () => {
                      const d = new Date();
                      d.setHours(d.getHours() + 1, 0, 0, 0);
                      return d;
                    },
                  },
                  {
                    label: "+2 Hours",
                    getDate: () => {
                      const d = new Date();
                      d.setHours(d.getHours() + 2, 0, 0, 0);
                      return d;
                    },
                  },
                  {
                    label: "Today 5 PM",
                    getDate: () => {
                      const d = new Date();
                      d.setHours(17, 0, 0, 0);
                      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
                      return d;
                    },
                  },
                  {
                    label: "Tomorrow 10 AM",
                    getDate: () => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(10, 0, 0, 0);
                      return d;
                    },
                  },
                  {
                    label: "Tomorrow 5 PM",
                    getDate: () => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      d.setHours(17, 0, 0, 0);
                      return d;
                    },
                  },
                  {
                    label: "In 2 Days",
                    getDate: () => {
                      const d = new Date();
                      d.setDate(d.getDate() + 2);
                      d.setHours(17, 0, 0, 0);
                      return d;
                    },
                  },
                  {
                    label: "In 1 Week",
                    getDate: () => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      d.setHours(17, 0, 0, 0);
                      return d;
                    },
                  },
                ].map((p, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.modalPresetChip,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => setTempFinishDate(p.getDate())}
                  >
                    <Text style={[styles.modalPresetText, { color: colors.text }]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Date Selection (Next 14 Days) */}
              <Text style={[styles.pickerSectionLabel, { color: colors.textSecondary }]}>
                Select Day
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.daysScroll}
              >
                {upcomingDays.map((dayDate, idx) => {
                  const isSelected =
                    tempFinishDate.getDate() === dayDate.getDate() &&
                    tempFinishDate.getMonth() === dayDate.getMonth() &&
                    tempFinishDate.getFullYear() === dayDate.getFullYear();

                  const dayName =
                    idx === 0
                      ? "Today"
                      : idx === 1
                      ? "Tmrw"
                      : dayDate.toLocaleDateString("en-GB", { weekday: "short" });
                  const dateNumber = dayDate.getDate();
                  const monthName = dayDate.toLocaleDateString("en-GB", { month: "short" });

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.dayCard,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        const next = new Date(tempFinishDate);
                        next.setFullYear(
                          dayDate.getFullYear(),
                          dayDate.getMonth(),
                          dayDate.getDate(),
                        );
                        setTempFinishDate(next);
                      }}
                    >
                      <Text
                        style={[
                          styles.dayNameText,
                          { color: isSelected ? colors.primaryText : colors.textMuted },
                        ]}
                      >
                        {dayName}
                      </Text>
                      <Text
                        style={[
                          styles.dayNumberText,
                          { color: isSelected ? colors.primaryText : colors.text },
                        ]}
                      >
                        {dateNumber}
                      </Text>
                      <Text
                        style={[
                          styles.dayMonthText,
                          { color: isSelected ? colors.primaryText : colors.textSecondary },
                        ]}
                      >
                        {monthName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Time Selection */}
              <Text style={[styles.pickerSectionLabel, { color: colors.textSecondary }]}>
                Select Time
              </Text>

              {/* AM / PM Selector */}
              <View style={styles.ampmRow}>
                <TouchableOpacity
                  style={[
                    styles.ampmButton,
                    {
                      backgroundColor:
                        tempFinishDate.getHours() < 12 ? colors.primary : colors.surface,
                      borderColor:
                        tempFinishDate.getHours() < 12 ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    const next = new Date(tempFinishDate);
                    const h = next.getHours();
                    if (h >= 12) next.setHours(h - 12);
                    setTempFinishDate(next);
                  }}
                >
                  <Text
                    style={[
                      styles.ampmText,
                      {
                        color:
                          tempFinishDate.getHours() < 12
                            ? colors.primaryText
                            : colors.textSecondary,
                        fontWeight: tempFinishDate.getHours() < 12 ? "700" : "500",
                      },
                    ]}
                  >
                    AM (Morning)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.ampmButton,
                    {
                      backgroundColor:
                        tempFinishDate.getHours() >= 12 ? colors.primary : colors.surface,
                      borderColor:
                        tempFinishDate.getHours() >= 12 ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => {
                    const next = new Date(tempFinishDate);
                    const h = next.getHours();
                    if (h < 12) next.setHours(h + 12);
                    setTempFinishDate(next);
                  }}
                >
                  <Text
                    style={[
                      styles.ampmText,
                      {
                        color:
                          tempFinishDate.getHours() >= 12
                            ? colors.primaryText
                            : colors.textSecondary,
                        fontWeight: tempFinishDate.getHours() >= 12 ? "700" : "500",
                      },
                    ]}
                  >
                    PM (Afternoon/Eve)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Hours Grid */}
              <Text style={[styles.pickerSubLabel, { color: colors.textMuted }]}>Hour</Text>
              <View style={styles.hoursGrid}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => {
                  const currentH = tempFinishDate.getHours();
                  const currentH12 = currentH % 12 === 0 ? 12 : currentH % 12;
                  const isSelected = currentH12 === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      style={[
                        styles.hourChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        const next = new Date(tempFinishDate);
                        const isPm = next.getHours() >= 12;
                        const h24 = (h % 12) + (isPm ? 12 : 0);
                        next.setHours(h24);
                        setTempFinishDate(next);
                      }}
                    >
                      <Text
                        style={[
                          styles.hourChipText,
                          {
                            color: isSelected ? colors.primaryText : colors.text,
                            fontWeight: isSelected ? "700" : "500",
                          },
                        ]}
                      >
                        {h}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Minutes Row */}
              <Text style={[styles.pickerSubLabel, { color: colors.textMuted }]}>Minute</Text>
              <View style={styles.minutesRow}>
                {[0, 15, 30, 45].map((m) => {
                  const isSelected = tempFinishDate.getMinutes() === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.minuteChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        const next = new Date(tempFinishDate);
                        next.setMinutes(m, 0, 0);
                        setTempFinishDate(next);
                      }}
                    >
                      <Text
                        style={[
                          styles.minuteChipText,
                          {
                            color: isSelected ? colors.primaryText : colors.text,
                            fontWeight: isSelected ? "700" : "500",
                          },
                        ]}
                      >
                        :{String(m).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Target Preview */}
            <View
              style={[
                styles.modalPreviewBar,
                { backgroundColor: colors.surfaceHighlight, borderColor: colors.border },
              ]}
            >
              <Clock size={16} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.modalPreviewText, { color: colors.text }]}>
                Selected: <Text style={{ fontWeight: "700" }}>{formatEstimatedFinish(tempFinishDate)}</Text>
              </Text>
            </View>

            {/* Modal Actions: No deadline vs Apply */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[
                  styles.modalSkipButton,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
                onPress={() => {
                  setEstimatedFinishAt(null);
                  setFinishPickerVisible(false);
                }}
              >
                <Text style={[styles.modalSkipText, { color: colors.textSecondary }]}>
                  No Deadline (Skip)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalApplyButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setEstimatedFinishAt(new Date(tempFinishDate));
                  setFinishPickerVisible(false);
                }}
              >
                <Text style={[styles.modalApplyText, { color: colors.primaryText }]}>
                  Set Deadline
                </Text>
              </TouchableOpacity>
            </View>
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
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  clearLinkText: {
    fontSize: 13,
    fontWeight: "600",
  },
  deadlineActiveCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  deadlineIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deadlineActiveValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  deadlineActiveSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  removeDeadlineButton: {
    padding: 6,
    borderRadius: 6,
  },
  deadlineEmptyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deadlineEmptyText: {
    fontSize: 15,
  },
  quickPresetRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  quickPresetChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickPresetText: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  pickerSectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  presetsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  modalPresetChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalPresetText: {
    fontSize: 13,
    fontWeight: "600",
  },
  daysScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  dayCard: {
    width: 68,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNameText: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  dayNumberText: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 1,
  },
  dayMonthText: {
    fontSize: 11,
    fontWeight: "500",
  },
  ampmRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  ampmButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  ampmText: {
    fontSize: 13,
  },
  pickerSubLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  hoursGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  hourChip: {
    width: "14.8%",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  hourChipText: {
    fontSize: 13,
  },
  minutesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  minuteChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  minuteChipText: {
    fontSize: 13,
  },
  modalPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    marginBottom: 14,
  },
  modalPreviewText: {
    fontSize: 13,
    flex: 1,
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalSkipButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalSkipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalApplyButton: {
    flex: 1.2,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalApplyText: {
    fontSize: 14,
    fontWeight: "700",
  },
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
