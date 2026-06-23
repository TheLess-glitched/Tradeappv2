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

    const { error } = await supabase.from("jobs").insert({
      user_id: user?.id,
      customer_name: customerName,
      service,
      price: parseInt(price),
      date,
      time,
      notes,
      status: "pending",
    });

    setLoading(false);

    if (error) {
      Alert.alert("Error", error.message);
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
          <Text style={styles.label}>Service *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Full car service, Hair braiding"
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
  container: {
    flex: 1,
    backgroundColor: "#0A0F1E",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: {
    width: 60,
  },
  backText: {
    fontSize: 15,
    color: "#F6A623",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  fieldWrapper: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    color: "#A0AEC0",
    marginBottom: 8,
  },
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
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
  },
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
  statusText: {
    fontSize: 14,
    color: "#F6A623",
    fontWeight: "600",
  },
  saveButton: {
    backgroundColor: "#F6A623",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0A0F1E",
  },
});
