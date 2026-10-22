import * as Updates from "expo-updates";
import { useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../context/theme-context";

export default function UpdateInfo() {
  const { colors } = useTheme();
  const { currentlyRunning, isUpdatePending, downloadError, checkError } =
    Updates.useUpdates();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!Updates.isEnabled) return null;

  const checkNow = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        setMessage("You already have the latest update.");
        return;
      }
      await Updates.fetchUpdateAsync();
      setMessage("Update downloaded. Restarting...");
      await Updates.reloadAsync();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check for updates.");
    } finally {
      setBusy(false);
    }
  };

  const published = currentlyRunning.createdAt
    ? currentlyRunning.createdAt.toLocaleString()
    : "unknown";
  const source = currentlyRunning.isEmbeddedLaunch
    ? "Installed build (no downloaded update running)"
    : "Downloaded update";
  const problem = downloadError?.message ?? checkError?.message ?? null;

  return (
    <View style={{ alignItems: "center", paddingHorizontal: 20, marginTop: 8 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
        Update {currentlyRunning.updateId?.slice(0, 8) ?? "none"} - {source}
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
        Published {published}
      </Text>
      {isUpdatePending ? (
        <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: "center" }}>
          A newer update is downloaded and will apply on the next launch.
        </Text>
      ) : null}
      {problem ? (
        <Text style={{ color: colors.dangerText, fontSize: 12, textAlign: "center" }}>
          {problem}
        </Text>
      ) : null}
      {message ? (
        <Text style={{ color: colors.textSecondary, fontSize: 12, textAlign: "center" }}>
          {message}
        </Text>
      ) : null}
      <TouchableOpacity
        style={{
          marginTop: 10,
          paddingVertical: 10,
          paddingHorizontal: 18,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        }}
        onPress={() => void checkNow()}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
            Check for update
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}