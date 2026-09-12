import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Delete } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    Vibration,
    View,
} from "react-native";
import { supabase } from "../constants/supabase";
import { useTheme } from "../context/theme-context";

export default function PinScreen() {
  const { colors, setPinUnlocked } = useTheme();

  const [pin, setPin] = useState("");
  const [mode, setMode] = useState<"enter" | "set" | "confirm">("enter");
  const [tempPin, setTempPin] = useState("");
  const [error, setError] = useState("");
  const [pinKey, setPinKey] = useState("user_pin");
  const [hasSetKey, setHasSetKey] = useState("has_set_pin");

  useEffect(() => {
    checkMode();
  }, []);

  const checkMode = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const key = user?.id ? `user_pin_${user.id}` : "user_pin";
    const hsk = user?.id ? `has_set_pin_${user.id}` : "has_set_pin";
    setPinKey(key);
    setHasSetKey(hsk);

    const hasSetPinEver = await AsyncStorage.getItem(hsk);
    const existingPin = await AsyncStorage.getItem(key);

    if (existingPin) {
      setMode("enter");
    } else if (hasSetPinEver === "true") {
      // User logged out — PIN was cleared but they've set one before
      setMode("enter");
    } else {
      // Brand new user
      setMode("set");
    }
  };

  const handleNumber = async (num: string) => {
    if (pin.length >= 6) return;
    const newPin = pin + num;
    setPin(newPin);
    setError("");
    if (newPin.length === 6) {
      await processPin(newPin);
    }
  };

  const processPin = async (enteredPin: string) => {
    if (mode === "set") {
      setTempPin(enteredPin);
      setMode("confirm");
      setPin("");
    } else if (mode === "confirm") {
      if (enteredPin === tempPin) {
        await AsyncStorage.setItem(pinKey, enteredPin);
        await AsyncStorage.setItem(hasSetKey, "true");
        setPinUnlocked(true);
        router.replace("/(tabs)/home");
      } else {
        setError("PINs don't match. Try again.");
        setPin("");
        setMode("set");
        setTempPin("");
        Vibration.vibrate(400);
      }
    } else {
      const savedPin = await AsyncStorage.getItem(pinKey);
      if (enteredPin === savedPin) {
        setPinUnlocked(true);
        router.replace("/(tabs)/home");
      } else {
        setError("Incorrect PIN");
        setPin("");
        Vibration.vibrate(400);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError("");
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.brandSection}>
        <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
          <Text style={[styles.logoText, { color: colors.primaryText }]}>T</Text>
        </View>
        <Text style={[styles.appName, { color: colors.text }]}>TradeApp</Text>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {mode === "set"
          ? "Set your PIN"
          : mode === "confirm"
            ? "Confirm your PIN"
            : "Enter your PIN"}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {mode === "set"
          ? "Choose a 6-digit PIN to secure your account"
          : mode === "confirm"
            ? "Enter your PIN again to confirm"
            : "Welcome back"}
      </Text>

      <View style={styles.dotsRow}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              { borderColor: colors.primary },
              pin.length > i && { backgroundColor: colors.primary },
            ]}
          />
        ))}
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <View style={styles.keypad}>
        {keys.map((key, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.key,
              { backgroundColor: colors.surface, borderColor: colors.border },
              key === "" && styles.keyEmpty,
            ]}
            onPress={() => {
              if (key === "del") handleDelete();
              else if (key !== "") handleNumber(key);
            }}
            disabled={key === ""}
            activeOpacity={0.8}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            {key === "del" ? (
              <Delete size={22} color={colors.text} />
            ) : (
              <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brandSection: { alignItems: "center", marginBottom: 32 },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoText: { fontSize: 28, fontWeight: "800" },
  appName: { fontSize: 22, fontWeight: "700" },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 8 },
  subtitle: {
    fontSize: 14,
    marginBottom: 32,
    textAlign: "center",
  },
  dotsRow: { flexDirection: "row", gap: 16, marginBottom: 16 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  error: { fontSize: 13, marginBottom: 16 },
  keypad: { flexDirection: "row", flexWrap: "wrap", width: 300, marginTop: 16 },
  key: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    margin: 6,
    borderRadius: 40,
    borderWidth: 1,
  },
  keyEmpty: { backgroundColor: "transparent", borderWidth: 0 },
  keyText: { fontSize: 24, fontWeight: "600" },
});
