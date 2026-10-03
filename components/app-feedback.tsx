import React, { useEffect, useState } from "react";
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useTheme } from "../context/theme-context";

export type FeedbackButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};

type FeedbackOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type DialogState = {
  title: string;
  message?: string;
  buttons: FeedbackButton[];
  options?: FeedbackOptions;
};

type ToastState = {
  title: string;
  message?: string;
};

let presentToast: (toast: ToastState) => void = () => {};
let presentDialog: (dialog: DialogState) => void = () => {};

export function showToast(title: string, message?: string) {
  presentToast({ title, message });
}

export function showDialog(
  title: string,
  message?: string,
  buttons?: FeedbackButton[],
  options?: FeedbackOptions,
) {
  presentDialog({ title, message, buttons: buttons ?? [{ text: "OK" }], options });
}

export function showFeedback(
  title: string,
  message?: string,
  buttons?: FeedbackButton[],
  options?: FeedbackOptions,
) {
  if (buttons?.length || options) {
    showDialog(title, message, buttons, options);
  } else {
    showToast(title, message);
  }
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, 2600);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <TouchableOpacity
      accessibilityRole="alert"
      activeOpacity={0.9}
      onPress={onDismiss}
      style={[
        styles.toast,
        {
          backgroundColor: colors.modalBackground,
          borderColor: colors.modalBorder,
        },
      ]}
    >
      <View style={[styles.toastAccent, { backgroundColor: colors.primary }]} />
      <View style={styles.toastCopy}>
        <Text style={[styles.toastTitle, { color: colors.text }]}>{toast.title}</Text>
        {toast.message ? (
          <Text style={[styles.toastMessage, { color: colors.textSecondary }]}>
            {toast.message}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export function FeedbackDialog({
  dialog,
  onDismiss,
}: {
  dialog: DialogState | null;
  onDismiss: (button?: FeedbackButton, callOnDismiss?: boolean) => void;
}) {
  const { colors } = useTheme();
  const cancelable = dialog?.options?.cancelable === true;

  return (
    <Modal
      visible={Boolean(dialog)}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (cancelable) onDismiss(undefined, true);
      }}
    >
      <Pressable
        style={[styles.dialogOverlay, { backgroundColor: colors.modalOverlay }]}
        onPress={() => {
          if (cancelable) onDismiss(undefined, true);
        }}
      >
        <Pressable
          style={[
            styles.dialog,
            {
              backgroundColor: colors.modalBackground,
              borderColor: colors.modalBorder,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          {dialog ? (
            <>
              <Text style={[styles.dialogTitle, { color: colors.text }]}>
                {dialog.title}
              </Text>
              {dialog.message ? (
                <Text style={[styles.dialogMessage, { color: colors.textSecondary }]}>
                  {dialog.message}
                </Text>
              ) : null}
              <View style={styles.dialogActions}>
                {dialog.buttons.map((button, index) => {
                  const destructive = button.style === "destructive";
                  const cancel = button.style === "cancel";
                  return (
                    <TouchableOpacity
                      key={`${button.text}-${index}`}
                      accessibilityRole="button"
                      onPress={() => onDismiss(button)}
                      style={[
                        styles.dialogButton,
                        {
                          backgroundColor: cancel ? colors.surface : destructive ? colors.danger : colors.primary,
                          borderColor: cancel ? colors.border : destructive ? colors.danger : colors.primary,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dialogButtonText,
                          {
                            color: cancel
                              ? colors.textSecondary
                              : destructive
                                ? "#FFFFFF"
                                : colors.primaryText,
                          },
                        ]}
                      >
                        {button.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function AppFeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    presentToast = setToast;
    presentDialog = setDialog;
    return () => {
      presentToast = () => {};
      presentDialog = () => {};
    };
  }, []);

  const dismissDialog = (button?: FeedbackButton, callOnDismiss = false) => {
    const current = dialog;
    setDialog(null);
    if (button) button.onPress?.();
    if (callOnDismiss) current?.options?.onDismiss?.();
  };

  return (
    <>
      {children}
      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <FeedbackDialog dialog={dialog} onDismiss={dismissDialog} />
    </>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 54,
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 12,
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
  },
  toastAccent: { width: 4 },
  toastCopy: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  toastTitle: { fontSize: 14, fontWeight: "700" },
  toastMessage: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  dialogOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  dialog: {
    width: "100%",
    maxHeight: "80%",
    borderWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  dialogTitle: { fontSize: 18, fontWeight: "700" },
  dialogMessage: { fontSize: 15, lineHeight: 22, marginTop: 10 },
  dialogActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },
  dialogButton: {
    minHeight: 42,
    minWidth: 82,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dialogButtonText: { fontSize: 14, fontWeight: "700" },
});