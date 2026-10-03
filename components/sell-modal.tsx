import { X } from "lucide-react-native";
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
import { CURRENCIES } from "../constants/currency";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
import { useTheme } from "../context/theme-context";
import { showDialog, showFeedback } from "./app-feedback";

export type SellModalItem = {
  id: string;
  name: string;
  selling_price?: number | null;
  cost_price?: number | null;
  [key: string]: any;
};

interface SellModalProps {
  visible: boolean;
  item: SellModalItem | null;
  onClose: () => void;
  onComplete?: () => void;
}

type SaleDraft = {
  itemId: string;
  quantity: string;
  price: string;
};

export default function SellModal({
  visible,
  item,
  onClose,
  onComplete,
}: SellModalProps) {
  const { session } = useAuth();
  const { colors, currency } = useTheme();

  const [saleDraft, setSaleDraft] = useState<SaleDraft | null>(null);
  const [loading, setLoading] = useState(false);

  const quantity =
    saleDraft && saleDraft.itemId === item?.id ? saleDraft.quantity : "1";
  const price =
    saleDraft && saleDraft.itemId === item?.id
      ? saleDraft.price
      : item?.selling_price != null
        ? item.selling_price.toString()
        : "";

  const updateSaleDraft = (
    updates: Partial<Pick<SaleDraft, "quantity" | "price">>,
  ) => {
    if (!item) return;
    setSaleDraft((current) => ({
      itemId: item.id,
      quantity: current?.itemId === item.id ? current.quantity : "1",
      price:
        current?.itemId === item.id
          ? current.price
          : item.selling_price != null
            ? item.selling_price.toString()
            : "",
      ...updates,
    }));
  };

  const handleClose = () => {
    setSaleDraft(null);
    setLoading(false);
    onClose();
  };

  const handleCompleteSale = async () => {
    if (!item) return;

    const parsedQty = parseInt(quantity.replace(/[^0-9]/g, ""), 10);
    if (!parsedQty || parsedQty <= 0) {
      showFeedback("Invalid quantity", "Please enter a valid quantity greater than 0.");
      return;
    }

    const parsedPrice = parseFloat(price.replace(/[^0-9.]/g, "")) || 0;
    if (!parsedPrice || parsedPrice <= 0) {
      showFeedback("Invalid price", "Please enter a valid price greater than 0.");
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
        showFeedback("Stock update failed", stockError.message);
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
          showFeedback("Stock Error", `Only ${newQuantity} available`);
        } else {
          showFeedback("Stock Error", "This item could not be found");
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
        quantity: parsedQty,
        unit_price: parsedPrice,
        unit_cost: item.cost_price ?? null,
        catalogue_item_id: item.id,
        price: parsedPrice,
        date: autoDate,
        time: autoTime,
      });

      if (jobError) {
        showDialog(
          "Sale not fully recorded",
          `Stock was already reduced by ${parsedQty}, but the sale record failed to save: ${jobError.message}. Please check the catalogue quantity and create the sale record manually if needed.`
        );
        onComplete?.();
        setLoading(false);
        return;
      }

      handleClose();
      onComplete?.();
      showFeedback("Sale Complete", "Sale recorded successfully.");
    } catch (err: any) {
      showFeedback("Error", err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
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
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            onChangeText={(value) => updateSaleDraft({ quantity: value })}
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
            onChangeText={(value) => updateSaleDraft({ price: value })}
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
