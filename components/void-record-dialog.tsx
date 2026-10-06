import { useState } from "react";
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { getAccountPinHash, verifyAccountPin } from "../constants/account-pin";
import { useTheme } from "../context/theme-context";
import { showToast } from "./app-feedback";

interface VoidRecordDialogProps {
  visible: boolean;
  recordLabel: string;
  userId: string | null;
  showNoStockWarning?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<boolean>;
}

export default function VoidRecordDialog({
  visible,
  recordLabel,
  userId,
  showNoStockWarning = false,
  onCancel,
  onConfirm,
}: VoidRecordDialogProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [step, setStep] = useState<"reason" | "pin">("reason");
  const [busy, setBusy] = useState(false);

  const resetAndClose = () => {
    setReason("");
    setPin("");
    setStep("reason");
    setBusy(false);
    onCancel();
  };

  const submitVoid = async () => {
    setBusy(true);
    try {
      const succeeded = await onConfirm(reason.trim());
      if (succeeded) resetAndClose();
    } catch (error) {
      showToast(
        "Void failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const continueFromReason = async () => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      showToast("Reason required", "Enter a reason before voiding this record.");
      return;
    }
    if (!userId) {
      showToast("Unable to verify account", "Please sign in again and retry.");
      return;
    }

    setBusy(true);
    const { pinHash, error } = await getAccountPinHash(userId);
    setBusy(false);
    if (error) {
      showToast("Unable to verify PIN", "Please retry before voiding this record.");
      return;
    }

    if (!pinHash) {
      await submitVoid();
    } else {
      setStep("pin");
    }
  };

  const verifyPinAndSubmit = async () => {
    if (!userId || pin.length !== 6) {
      showToast("PIN required", "Enter your 6-digit owner PIN.");
      return;
    }

    setBusy(true);
    const { pinHash, error } = await getAccountPinHash(userId);
    if (error || !pinHash) {
      setBusy(false);
      showToast("Unable to verify PIN", "Please retry before voiding this record.");
      return;
    }

    if (!(await verifyAccountPin(pin, userId, pinHash))) {
      setBusy(false);
      setPin("");
      showToast("Incorrect PIN", "The owner PIN did not match.");
      return;
    }

    await submitVoid();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={resetAndClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <View
          style={[
            styles.dialog,
            { backgroundColor: colors.modalBackground, borderColor: colors.modalBorder },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>Void {recordLabel}</Text>
          {step === "reason" ? (
            <>
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                This record will remain in your history as voided. Enter a reason to continue.
              </Text>
              {showNoStockWarning ? (
                <Text style={[styles.warning, { color: colors.statusInProgress }]}>
                  This sale has no catalogue link, so stock will not be restored.
                </Text>
              ) : null}
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Reason for voiding"
                placeholderTextColor={colors.placeholder}
                multiline
                maxLength={500}
                style={[
                  styles.reasonInput,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                editable={!busy}
              />
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={resetAndClose}
                  disabled={busy}
                >
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.danger, borderColor: colors.danger }]}
                  onPress={continueFromReason}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.actionText, styles.destructiveText]}>Continue</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                Enter the 6-digit owner PIN to confirm.
              </Text>
              <TextInput
                value={pin}
                onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit PIN"
                placeholderTextColor={colors.placeholder}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                style={[
                  styles.pinInput,
                  {
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.inputBorder,
                    color: colors.inputText,
                  },
                ]}
                editable={!busy}
              />
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => {
                    setPin("");
                    setStep("reason");
                  }}
                  disabled={busy}
                >
                  <Text style={[styles.actionText, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: colors.danger, borderColor: colors.danger }]}
                  onPress={verifyPinAndSubmit}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.actionText, styles.destructiveText]}>Void</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: 20 },
  dialog: { borderWidth: 1, borderRadius: 14, padding: 20 },
  title: { fontSize: 18, fontWeight: "700" },
  message: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  warning: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  reasonInput: {
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    marginTop: 16,
  },
  pinInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    textAlign: "center",
    letterSpacing: 4,
    marginTop: 16,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 18 },
  actionButton: {
    minWidth: 90,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionText: { fontSize: 14, fontWeight: "700" },
  destructiveText: { color: "#FFFFFF" },
});