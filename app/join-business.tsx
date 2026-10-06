import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { showDialog, showToast } from "../components/app-feedback";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";

export default function JoinBusinessScreen() {
  const { colors, isPinUnlocked, pinUnlockedUserId } = useTheme();
  const { refreshBusiness } = useAuth();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [working, setWorking] = useState(false);

  const acceptInvite = async (inviteCode: string, workerName: string) => {
    setWorking(true);
    try {
      const { error } = await supabase.rpc("accept_invite", {
        p_code: inviteCode,
        p_display_name: workerName,
      });
      if (error) {
        showToast("Couldn't join business", error.message);
        return;
      }

      const businessResult = await refreshBusiness();
      if (businessResult.failed) {
        showToast(
          "Business joined",
          "Your membership was saved, but your business details could not be refreshed. Please retry.",
        );
        return;
      }

      showToast("You've joined the business");

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        showToast("Couldn't verify your PIN", "Please sign in again.");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("pin_hash")
        .eq("id", user.id)
        .single();
      if (profileError) {
        showToast("Couldn't verify your PIN", profileError.message);
        router.replace("/pin" as any);
        return;
      }

      router.replace(
        profile.pin_hash &&
          isPinUnlocked &&
          pinUnlockedUserId === user.id
          ? ("/(tabs)/home" as any)
          : ("/pin" as any),
      );
    } catch (error) {
      showToast(
        "Couldn't join business",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setWorking(false);
    }
  };

  const previewInvite = async () => {
    if (working) return;

    const workerName = displayName.trim();
    if (workerName.length < 2) {
      showToast("Name required", "Enter a name with at least 2 characters.");
      return;
    }

    const inviteCode = code.trim().replace(/-/g, "").toUpperCase();
    if (!inviteCode) {
      showToast("Invite code required", "Enter the code from the business owner.");
      return;
    }

    setWorking(true);
    try {
      const { data: businessName, error } = await supabase.rpc("preview_invite", {
        p_code: inviteCode,
      });
      if (error) {
        showToast("Couldn't preview invite", error.message);
        return;
      }
      if (typeof businessName !== "string" || !businessName.trim()) {
        showToast("Couldn't preview invite", "The server returned an invalid business name.");
        return;
      }

      showDialog(
        `Join ${businessName} as a worker?`,
        undefined,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Join",
            onPress: () => void acceptInvite(inviteCode, workerName),
          },
        ],
      );
    } catch (error) {
      showToast(
        "Couldn't preview invite",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Join a business</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Enter the invite code and the name you want displayed to your business team.
        </Text>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Your name</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
              color: colors.inputText,
            },
          ]}
          placeholder="Your name"
          placeholderTextColor={colors.placeholder}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="Your name"
        />
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Invite code</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
              color: colors.inputText,
            },
          ]}
          placeholder="ABCDE-12345"
          placeholderTextColor={colors.placeholder}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="join"
          onSubmitEditing={() => void previewInvite()}
          accessibilityLabel="Invite code"
        />
        <TouchableOpacity
          style={[styles.joinButton, { backgroundColor: colors.primary }]}
          onPress={() => void previewInvite()}
          disabled={working}
        >
          {working ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={[styles.joinButtonText, { color: colors.primaryText }]}>Join</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", marginLeft: 8 },
  content: { padding: 24 },
  description: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 15, fontSize: 17, letterSpacing: 1 },
  joinButton: { alignItems: "center", justifyContent: "center", minHeight: 50, borderRadius: 12, marginTop: 20 },
  joinButtonText: { fontSize: 16, fontWeight: "700" },
});
