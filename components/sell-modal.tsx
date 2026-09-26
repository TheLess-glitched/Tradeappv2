import { X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CURRENCIES } from "../constants/currency";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";

export type SellModalItem = {
  id: string;
  name: string;
  selling_price?: number | null;
  [key: string]: any;
};

interface SellModalProps {
  visible: boolean;
  item: SellModalItem | null;
  onClose: () => void;
  onComplete?: () => void;
}

export default function SellModal({
  visible,
  item,
  onClose,
  onComplete,
}: SellModalProps) {
  const { session } = useAuth();
  const { colors, currency } = useTheme();

  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && item) {
      setQuantity("1");
      setPrice(item.selling_price != null ? item.selling_price.toString() : "");
      setLoading(false);
    }
  }, [visible, item]);

  const handleCompleteSale = async () => {
    if (!item) return;

    const parsedQty = parseInt(quantity.replace(/[^0-9]/g, ""), 10);
    if (!parsedQty || parsedQty <= 0) {
      Alert.alert("Invalid quantity", "Please enter a valid quantity greater than 0.");
      return;
    }

    const parsedPrice = parseFloat(price.replace(/[^0-9.]/g, "")) || 0;
    if (!parsedPrice || parsedPrice <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price greater than 0.");
      return;
    }

    setLoading(true);
    try {
      const { data: stockData, error: stockError } = await supabase.rpc(
        "decrement_catalogue_stock",
        {
          p_catalogue_item_id: item.id,
          p_quantity: parsedQty,
          p_reason: "Sale",
        },
      );

      if (stockError) {
        Alert.alert("Stock update failed", stockError.message);
        setLoading(false);
        return;
      }

      const stockResult = Array.isArray(stockData) ? stockData[0] : stockData;
      const stockUpdated = stockResult?.updated === true;
      const newQuantity =
        stockResult?.new_quantity != null
          ? Number(stockResult.new_quantity)
          : null;

      if (!stockUpdated) {
        if (typeof newQuantity === "number" && !isNaN(newQuantity)) {
          Alert.alert("Stock Error", `Only ${newQuantity} available`);
        } else {
          Alert.alert("Stock Error", "This item could not be found");
        }
        setLoading(false);
        return;
      }

      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const year = now.getFullYear();
      const autoDate = `${day}/${month}/${year}`;

      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      const autoTime = `${hours}:${minutes} ${ampm}`;

      const { error: jobError } = await supabase.from("jobs").insert({
        user_id: session?.user?.id,
        record_type: "sale",
        customer_name: null,
        customer_phone: null,
        service: item.name,
        price: parsedPrice,
        date: autoDate,
        time: autoTime,
      });

      if (jobError) {
        Alert.alert(
          "Sale not fully recorded",
          `Stock was already reduced by ${parsedQty}, but the sale record failed to save: ${jobError.message}. Please check the catalogue quantity and create the sale record manually if needed.`
        );
        onComplete?.();
        setLoading(false);
        return;
      }

      onClose();
      onComplete?.();
      Alert.alert("Sale Complete", "Sale recorded successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.modalBackground,
              borderColor: colors.modalBorder,
            },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Sell — {item?.name}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Quantity</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
            placeholder="1"
            placeholderTextColor={colors.placeholder}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Price ({CURRENCIES[currency].symbol})
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.inputText,
              },
            ]}
            placeholder="0"
            placeholderTextColor={colors.placeholder}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: colors.primary,
                opacity: loading ? 0.7 : 1,
              },
            ]}
            onPress={handleCompleteSale}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>
                Complete Sale
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "60%",
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
});
