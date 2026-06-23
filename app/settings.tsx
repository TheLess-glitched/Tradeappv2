import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { ArrowLeft, ChevronRight, KeyRound, LogOut } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../constants/supabase";

export default function SettingsScreen() {
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
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
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await AsyncStorage.setItem(
      "business_settings",
      JSON.stringify({ businessName, ownerName, phone }),
    );
    setSaving(false);
    Alert.alert("Saved", "Your settings have been updated.");
  };

  const handleChangePin = async () => {
    Alert.alert(
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
            const key = currentUser?.id
              ? `user_pin_${currentUser.id}`
              : "user_pin";
            await AsyncStorage.removeItem(key);
            router.replace("/pin" as any);
          },
        },
      ],
    );
  };

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace("/" as any);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#F6A623" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.accountCard}>
          <View style={styles.accountAvatar}>
            <Text style={styles.accountAvatarText}>
              {businessName ? businessName.charAt(0).toUpperCase() : "T"}
            </Text>
          </View>
          <View>
            <Text style={styles.accountName}>
              {businessName || "Your Business"}
            </Text>
            <Text style={styles.accountEmail}>{userEmail}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Business Details</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Business Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Emeka's Auto Repairs"
            placeholderTextColor="#4A5568"
            value={businessName}
            onChangeText={setBusinessName}
          />
          <Text style={styles.label}>Owner Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Emeka Okafor"
            placeholderTextColor="#4A5568"
            value={ownerName}
            onChangeText={setOwnerName}
          />
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={[styles.input, { marginBottom: 0 }]}
            placeholder="e.g. 08012345678"
            placeholderTextColor="#4A5568"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#0A0F1E" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuRow} onPress={handleChangePin}>
            <View style={styles.menuRowLeft}>
              <KeyRound size={20} color="#F6A623" />
              <Text style={styles.menuRowText}>Change PIN</Text>
            </View>
            <ChevronRight size={18} color="#4A5568" />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuRow} onPress={handleLogout}>
            <View style={styles.menuRowLeft}>
              <LogOut size={20} color="#E53E3E" />
              <Text style={[styles.menuRowText, { color: "#E53E3E" }]}>
                Log Out
              </Text>
            </View>
            <ChevronRight size={18} color="#4A5568" />
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>TradeApp v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0A0F1E",
    alignItems: "center",
    justifyContent: "center",
  },
  container: { flex: 1, backgroundColor: "#0A0F1E" },
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
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#FFFFFF", flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 60 },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#131929",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  accountAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F6A623",
    alignItems: "center",
    justifyContent: "center",
  },
  accountAvatarText: { fontSize: 22, fontWeight: "700", color: "#0A0F1E" },
  accountName: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
  accountEmail: { fontSize: 13, color: "#718096", marginTop: 2 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4A5568",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#131929",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1E2A3D",
  },
  label: { fontSize: 13, fontWeight: "500", color: "#A0AEC0", marginBottom: 6 },
  input: {
    backgroundColor: "#0A0F1E",
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
    marginBottom: 24,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#0A0F1E" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  menuRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuRowText: { fontSize: 15, fontWeight: "500", color: "#FFFFFF" },
  version: {
    textAlign: "center",
    fontSize: 12,
    color: "#2D3748",
    marginTop: 8,
  },
});
