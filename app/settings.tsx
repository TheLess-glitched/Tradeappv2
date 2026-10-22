import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  KeyRound,
  LogOut,
  Moon,
  Search,
  Smartphone,
  Sun,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import UpdateInfo from "../components/update-info";
import { CURRENCIES, CurrencyCode, DEFAULT_CURRENCY } from "../constants/currency";
import { DEFAULT_COUNTRY_CODE } from "../constants/phone";
import { signOutIfOnline } from "../constants/safe-sign-out";
import { getUnsyncedSalesCountForUser } from "../constants/sale-queue";
import { supabase } from "../constants/supabase";
import { ThemeMode } from "../constants/theme";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";

export default function SettingsScreen() {
  const { role, user } = useAuth();
  const isOwner = role === "owner";
  const { colors, isDark, themeMode, setThemeMode, setPinUnlocked, currency, setCurrency, defaultCountryCode, setDefaultCountryCode } = useTheme();

  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [completionMessage, setCompletionMessage] = useState(
    "Hi {name}, your job is completed and ready!",
  );
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);

  const loadSettings = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) setUserEmail(user.email);
    const saved = await AsyncStorage.getItem("business_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setBusinessName(parsed.businessName || "");
      setOwnerName(parsed.ownerName || "");
      setPhone(parsed.phone || "");
      setCompletionMessage(
        parsed.completionMessage ||
          "Hi {name}, your job is completed and ready!",
      );
      setCurrency(
        parsed.currency && parsed.currency in CURRENCIES
          ? parsed.currency
          : DEFAULT_CURRENCY,
      );
      setCountryCode(parsed.default_country_code || DEFAULT_COUNTRY_CODE);
    }
    setLoading(false);
  }, [setCurrency]);

  useEffect(() => {
    const timer = setTimeout(() => void loadSettings(), 0);
    return () => clearTimeout(timer);
  }, [loadSettings]);

  const currencyOptions = useMemo(
    () =>
      (Object.entries(CURRENCIES) as [
        CurrencyCode,
        (typeof CURRENCIES)[CurrencyCode],
      ][]).map(([code, meta]) => ({ code, ...meta })),
    [],
  );
  const filteredCurrencies = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) return currencyOptions;
    return currencyOptions.filter(
      ({ code, name, symbol }) =>
        name.toLowerCase().includes(query) ||
        code.toLowerCase().includes(query) ||
        symbol.toLowerCase().includes(query),
    );
  }, [currencyOptions, currencySearch]);

  const handleSave = async () => {
    setSaving(true);
    await AsyncStorage.setItem(
      "business_settings",
      JSON.stringify({
        businessName,
        ownerName,
        phone,
        completionMessage,
        currency,
        default_country_code: countryCode.replace(/\D/g, "") || DEFAULT_COUNTRY_CODE,
      }),
    );
    await setDefaultCountryCode(countryCode);
    setSaving(false);
    showFeedback("Saved", "Your settings have been updated.");
  };

  const handleChangePin = async () => {
    showFeedback(
      "Change PIN",
      "This will ask you to set a new PIN on the next screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            const {
              data: { user: currentUser },
            } = await supabase.auth.getUser();
            if (!currentUser) return;
            const { error } = await supabase
              .from("profiles")
              .update({ pin_hash: null, pin_set_at: null })
              .eq("id", currentUser.id);
            if (error) {
              showFeedback("Error", error.message);
              return;
            }
            setPinUnlocked(false);
            router.replace("/pin" as any);
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    showFeedback("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          if (user?.id) {
            try {
              const count = await getUnsyncedSalesCountForUser(user.id);
              if (count > 0) {
                showFeedback(
                  "Items not synced",
                  `Sync or resolve ${count} unsynced ${count === 1 ? "item" : "items"} before signing out.`,
                );
                return;
              }
            } catch (error) {
              showFeedback(
                "Couldn't check offline sales",
                error instanceof Error ? error.message : "Please try again.",
              );
              return;
            }
          }
          const result = await signOutIfOnline();
          if (!result.ok) {
            showFeedback("Can't sign out", result.message ?? "Please try again.");
            return;
          }
          setPinUnlocked(false);
          router.replace("/" as any);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const themeOptions: { key: ThemeMode; label: string; icon: any }[] = [
    { key: "system", label: "System", icon: Smartphone },
    { key: "light", label: "Light", icon: Sun },
    { key: "dark", label: "Dark", icon: Moon },
  ];

  const handleCurrencyPress = (code: CurrencyCode) => {
    setCurrency(code);
    setCurrencyModalVisible(false);
    setCurrencySearch("");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Settings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {isOwner ? (
          <View
            style={[
              styles.accountCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.accountAvatar,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text
                style={[
                  styles.accountAvatarText,
                  { color: colors.primaryText },
                ]}
              >
                {businessName ? businessName.charAt(0).toUpperCase() : "T"}
              </Text>
            </View>
            <View>
              <Text style={[styles.accountName, { color: colors.text }]}>
                {businessName || "Your Business"}
              </Text>
              <Text style={[styles.accountEmail, { color: colors.textMuted }]}>
                {userEmail}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Appearance / Theme Selector */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Appearance
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.themeToggleRow}>
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = themeMode === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.themeOptionBtn,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? colors.surfaceHighlight
                          : colors.secondarySurface
                        : colors.inputBackground,
                      borderColor: isSelected
                        ? colors.primary
                        : colors.inputBorder,
                    },
                  ]}
                  onPress={() => setThemeMode(opt.key)}
                  activeOpacity={0.7}
                >
                  <Icon
                    size={18}
                    color={
                      isSelected
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      {
                        color: isSelected
                          ? colors.text
                          : colors.textSecondary,
                        fontWeight: isSelected ? "700" : "500",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {isOwner ? <>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Currency
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.currencyField,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
              },
            ]}
            onPress={() => setCurrencyModalVisible(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Currency: ${CURRENCIES[currency].name}, ${currency}, ${CURRENCIES[currency].symbol}`}
          >
            <Text
              style={[styles.currencyFieldName, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {CURRENCIES[currency].name}
            </Text>
            <View style={styles.currencyFieldAside}>
              <Text style={[styles.currencyFieldCode, { color: colors.textSecondary }]}>
                {currency}
              </Text>
              <Text style={[styles.currencyFieldSymbol, { color: colors.text }]}>
                {CURRENCIES[currency].symbol}
              </Text>
              <ChevronDown size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
          <Text style={[styles.currencyHelper, { color: colors.textMuted }]}>
            Changes the symbol only. Amounts are not converted.
          </Text>
        </View>
        </> : null}

        {isOwner ? <>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Business Details
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Business Name
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
            placeholder="e.g. Emeka's Auto Repairs"
            placeholderTextColor={colors.placeholder}
            value={businessName}
            onChangeText={setBusinessName}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Owner Name
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
            placeholder="e.g. Emeka Okafor"
            placeholderTextColor={colors.placeholder}
            value={ownerName}
            onChangeText={setOwnerName}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Phone Number
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
            placeholder="e.g. 08012345678"
            placeholderTextColor={colors.placeholder}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
            <Text style={[styles.label, { color: colors.textSecondary }]}>Default Country Code</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  borderColor: colors.inputBorder,
                  color: colors.inputText,
                },
              ]}
              placeholder="234"
              placeholderTextColor={colors.placeholder}
              value={countryCode}
              onChangeText={setCountryCode}
              keyboardType="number-pad"
            />
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Completion Message Template
          </Text>
          <Text style={[styles.helperText, { color: colors.textMuted }]}>
            Use {"{name}"} to insert the customer&apos;s name.
          </Text>
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
            placeholder="Hi {name}, your job is ready!"
            placeholderTextColor={colors.placeholder}
            value={completionMessage}
            onChangeText={setCompletionMessage}
            multiline
          />
        </View>

        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: colors.primary },
            saving && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                { color: colors.primaryText },
              ]}
            >
              Save Changes
            </Text>
          )}
        </TouchableOpacity>
        </> : null}

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Security
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity style={styles.menuRow} onPress={handleChangePin}>
            <View style={styles.menuRowLeft}>
              <KeyRound size={20} color={colors.primary} />
              <Text style={[styles.menuRowText, { color: colors.text }]}>
                Change PIN
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          Account
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity style={styles.menuRow} onPress={handleLogout}>
            <View style={styles.menuRowLeft}>
              <LogOut size={20} color={colors.danger} />
              <Text style={[styles.menuRowText, { color: colors.danger }]}>
                Log Out
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: colors.textMuted }]}>
          <UpdateInfo />
          TradeApp v1.0.0
        </Text>
      </ScrollView>

      <Modal
        visible={currencyModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setCurrencyModalVisible(false);
          setCurrencySearch("");
        }}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.currencyModal,
              {
                backgroundColor: colors.modalBackground,
                borderColor: colors.modalBorder,
              },
            ]}
          >
            <View style={styles.currencyModalHeader}>
              <Text style={[styles.currencyModalTitle, { color: colors.text }]}>
                Select Currency
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCurrencyModalVisible(false);
                  setCurrencySearch("");
                }}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close currency picker"
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
              <Search size={18} color={colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.inputText }]}
                placeholder="Search currency or code..."
                placeholderTextColor={colors.placeholder}
                value={currencySearch}
                onChangeText={setCurrencySearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {currencySearch.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setCurrencySearch("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear currency search"
                >
                  <X size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={[styles.emptyCurrencyText, { color: colors.textMuted }]}>
                  No currencies found
                </Text>
              }
              renderItem={({ item }) => {
                const isSelected = item.code === currency;
                return (
                  <TouchableOpacity
                    style={[
                      styles.currencyItem,
                      isSelected && { backgroundColor: colors.surfaceHighlight },
                    ]}
                    onPress={() => handleCurrencyPress(item.code)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.currencyItemName, { color: colors.text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.name}
                    </Text>
                    <View style={styles.currencyItemAside}>
                      <Text style={[styles.currencyItemCode, { color: colors.textSecondary }]}>
                        {item.code}
                      </Text>
                      <Text style={[styles.currencyItemSymbol, { color: colors.text }]}>
                        {item.symbol}
                      </Text>
                      {isSelected ? (
                        <Check size={18} color={colors.primary} />
                      ) : (
                        <View style={styles.currencyItemCheckSpace} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "700", flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarText: { fontSize: 22, fontWeight: "700" },
  accountName: { fontSize: 16, fontWeight: "700" },
  accountEmail: { fontSize: 13, marginTop: 2 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  themeToggleRow: { flexDirection: "row", gap: 10 },
  themeOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  themeOptionText: {
    fontSize: 13,
  },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  helperText: { fontSize: 11, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  textArea: { height: 80, textAlignVertical: "top", marginBottom: 0 },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  menuRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuRowText: { fontSize: 15, fontWeight: "500" },
  version: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 8,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  currencyModal: {
    width: "100%",
    maxHeight: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  currencyModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  currencyModalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: { padding: 6 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  currencyField: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  currencyFieldName: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "600" },
  currencyFieldAside: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 12,
  },
  currencyFieldCode: { fontSize: 13, fontWeight: "600" },
  currencyFieldSymbol: { fontSize: 16, fontWeight: "700" },
  currencyHelper: { fontSize: 11, marginTop: 8 },
  currencyItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  currencyItemName: { flex: 1, minWidth: 0, fontSize: 15, fontWeight: "500" },
  currencyItemAside: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginLeft: 12,
  },
  currencyItemCode: { fontSize: 13, fontWeight: "600" },
  currencyItemSymbol: { minWidth: 28, textAlign: "right", fontSize: 15, fontWeight: "600" },
  currencyItemCheckSpace: { width: 18 },
  emptyCurrencyText: { paddingVertical: 20, textAlign: "center", fontSize: 14 },
});
