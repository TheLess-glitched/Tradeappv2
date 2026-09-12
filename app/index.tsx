import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";

export default function LoginScreen() {
  const { colors, isPinUnlocked } = useTheme();
  const { session, isSessionReady } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSessionReady) {
      return;
    }

    if (session) {
      if (isPinUnlocked) {
        router.replace("/(tabs)/home" as any);
      } else {
        router.replace("/pin" as any);
      }
    } else {
      setLoading(false);
    }
  }, [isSessionReady, session, isPinUnlocked]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Missing info", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert("Login failed", error.message);
    } else {
      router.replace("/pin" as any);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <View style={styles.loadingShell}>
          <View style={[styles.loadingLogo, { backgroundColor: colors.primary }]} />
          <View style={[styles.loadingLine, { backgroundColor: colors.border, width: 160 }]} />
          <View style={[styles.loadingLine, { backgroundColor: colors.border, width: 120 }]} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.brandSection}>
        <View style={[styles.logoBox, { backgroundColor: colors.primary }]}>
          <Text style={[styles.logoText, { color: colors.primaryText }]}>T</Text>
        </View>
        <Text style={[styles.appName, { color: colors.text }]}>TradeApp</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>
          Run your business. Your way.
        </Text>
      </View>

      <View style={styles.formSection}>
        <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome back</Text>

        <View style={styles.inputWrapper}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
            placeholder="you@business.com"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputWrapper}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Password</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
            placeholder="••••••••"
            placeholderTextColor={colors.placeholder}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.forgotPassword}>
          <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
            Forgot password?
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.loginButton,
            { backgroundColor: colors.primary },
            loading && styles.loginButtonDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[styles.loginButtonText, { color: colors.primaryText }]}>
              Sign In
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.signupRow}>
          <Text style={[styles.signupPrompt, { color: colors.textMuted }]}>
            New to TradeApp?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/signup" as any)}>
            <Text style={[styles.signupLink, { color: colors.primary }]}>
              Create account
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingShell: {
    alignItems: "center",
    gap: 12,
  },
  loadingLogo: {
    width: 64,
    height: 64,
    borderRadius: 18,
  },
  loadingLine: {
    height: 12,
    borderRadius: 6,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  brandSection: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: {
    fontSize: 32,
    fontWeight: "800",
  },
  appName: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    marginTop: 4,
  },
  formSection: {
    width: "100%",
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 24,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
    marginTop: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
  },
  loginButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  signupPrompt: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: "600",
  },
});
