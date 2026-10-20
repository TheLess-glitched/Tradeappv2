import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { showDialog, showToast } from "../components/app-feedback";
import { getUnsyncedSalesCountForUser } from "../constants/sale-queue";
import { signOutIfOnline } from "../constants/safe-sign-out";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";

export default function NoBusinessScreen() {
  const { colors, setPinUnlocked } = useTheme();
  const { refreshBusiness, user } = useAuth();
  const [creatingBusiness, setCreatingBusiness] = useState(false);

  const signOut = async () => {
    if (user?.id) {
      try {
        const count = await getUnsyncedSalesCountForUser(user.id);
        if (count > 0) {
          showToast(
            "Items not synced",
            `Sync or resolve ${count} unsynced ${count === 1 ? "item" : "items"} before signing out.`,
          );
          return;
        }
      } catch (error) {
        showToast(
          "Couldn't check offline sales",
          error instanceof Error ? error.message : "Please try again.",
        );
        return;
      }
    }
    const result = await signOutIfOnline();
    if (!result.ok) {
      showToast("Can't sign out", result.message ?? "Please try again.");
      return;
    }
    setPinUnlocked(false);
    router.replace("/");
  };

  const createOwnBusiness = async () => {
    if (creatingBusiness) return;
    setCreatingBusiness(true);
    try {
      const { error } = await supabase.rpc("create_own_business");
      if (error) {
        showToast("Couldn't create business", error.message);
        return;
      }

      const result = await refreshBusiness();
      if (result.failed) {
        showToast(
          "Business created",
          "Business created. Reopen the app to continue.",
        );
        return;
      }

      router.replace("/(tabs)/home" as any);
    } catch (error) {
      showToast(
        "Couldn't create business",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setCreatingBusiness(false);
    }
  };

  const confirmCreateBusiness = () => {
    showDialog(
      "Start my own business?",
      "This creates a new, empty business that you'll own.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create business",
          onPress: () => void createOwnBusiness(),
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        You&apos;re not part of a business
      </Text>
      <TouchableOpacity
        disabled={creatingBusiness}
        onPress={() => router.push("/join-business" as any)}
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.primaryButtonText, { color: colors.primaryText }]}>
          Join a business
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={confirmCreateBusiness}
        disabled={creatingBusiness}
        style={[
          styles.secondaryButton,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        {creatingBusiness ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Start my own business
          </Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => void signOut()}
        disabled={creatingBusiness}
        style={[
          styles.secondaryButton,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 24 },
  primaryButton: {
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  primaryButtonText: { fontWeight: "700" },
  secondaryButton: {
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  secondaryButtonText: { fontWeight: "700" },
});
