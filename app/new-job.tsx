import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../constants/supabase";

export default function NewJobScreen() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [service, setService] = useState("");
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!customerName || !service || !price) {
      Alert.alert(
        "Missing info",
        "Please fill in customer name, service and price.",
      );
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Insert the Job
    const { error: jobError } = await supabase.from("jobs").insert({
      user_id: user?.id,
      customer_name: customerName,
      service,
      price: parseInt(price.replace(/[^0-9]/g, ""), 10) || 0,
      date,
      time,
      notes,
      status: "pending",
    });

    // 2. Format the phone number perfectly for WhatsApp and SMS
    // Strips out any spaces, and removes the leading 0 if they typed it
    let formattedPhone = "";
    if (customerPhone) {
      const cleanInput = customerPhone.replace(/\D/g, "").replace(/^0+/, "");
      formattedPhone = `234${cleanInput}`;
    }

    // 3. Silently sync to Customers table
    if (formattedPhone && !jobError) {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("user_id", user?.id)
        .eq("phone", formattedPhone)
        .single();

      if (!existingCustomer) {
        await supabase.from("customers").insert({
          user_id: user?.id,
          name: customerName,
          phone: formattedPhone,
          service_type: service,
        });
      }
    }

    setLoading(false);

    if (jobError) {
      Alert.alert("Error", jobError.message);
    } else {
      Alert.alert("Success", "Job saved!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0A0F1E" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Job</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Emeka Okafor"
            placeholderTextColor="#4A5568"
            value={customerName}
            onChangeText={setCustomerName}
          />
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Customer Phone (Optional)</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[styles.input, styles.countryCodeBox]}>
              <Text style={styles.countryCodeText}>+234</Text>
            </View>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="801 234 5678"
              placeholderTextColor="#4A5568"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Service *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Full car service"
            placeholderTextColor="#4A5568"
            value={service}
            onChangeText={setService}
          />
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Price (₦) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 15000"
            placeholderTextColor="#4A5568"
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.fieldWrapper, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#4A5568"
              value={date}
              onChangeText={setDate}
            />
          </View>
          <View style={[styles.fieldWrapper, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Time</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10:00 AM"
              placeholderTextColor="#4A5568"
              value={time}
              onChangeText={setTime}
            />
          </View>
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Any extra details about the job..."
            placeholderTextColor="#4A5568"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.fieldWrapper}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Pending</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0A0F1E" />
          ) : (
            <Text style={styles.saveButtonText}>Save Job</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  backButton: { width: 60 },
  backText: { fontSize: 15, color: "#F6A623" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  fieldWrapper: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "500", color: "#A0AEC0", marginBottom: 8 },
  input: {
    backgroundColor: "#131929",
    borderWidth: 1,
    borderColor: "#1E2A3D",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#FFFFFF",
  },
  countryCodeBox: {
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E2A3D",
  },
  countryCodeText: { color: "#A0AEC0", fontSize: 15, fontWeight: "700" },
  textArea: { height: 100, textAlignVertical: "top" },
  row: { flexDirection: "row" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131929",
    borderWidth: 1,
    borderColor: "#1E2A3D",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignSelf: "flex-start",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F6A623",
    marginRight: 8,
  },
  statusText: { fontSize: 14, color: "#F6A623", fontWeight: "600" },
  saveButton: {
    backgroundColor: "#F6A623",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 16, fontWeight: "700", color: "#0A0F1E" },
});
