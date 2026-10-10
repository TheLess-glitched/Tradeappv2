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
import { CURRENCIES, formatCurrency } from "../constants/currency";
import { supabase } from "../constants/supabase";
import { useTheme } from "../context/theme-context";
import { showFeedback } from "./app-feedback";

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
  mode?: "sale" | "cart";
  initialQuantity?: number;
  initialPrice?: number;
  maxQuantity?: number;
  onCartSave?: (quantity: number, price: number) => void;
}

type SaleDraft = {
  itemId: string;
  quantity: string;
  price: string;
  total: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseAmount(value: string): number {
  return Number(value.replace(/,/g, "").trim());
}

export default function SellModal({
  visible,
  item,
  onClose,
  onComplete,
  mode = "sale",
  initialQuantity,
  initialPrice,
  maxQuantity,
  onCartSave,
}: SellModalProps) {
  const { colors, currency } = useTheme();

  const [saleDraft, setSaleDraft] = useState<SaleDraft | null>(null);
  const [loading, setLoading] = useState(false);

  const quantity =
    saleDraft && saleDraft.itemId === item?.id
      ? saleDraft.quantity
      : mode === "cart" && initialQuantity != null
        ? initialQuantity.toString()
        : "1";
  const price =
    saleDraft && saleDraft.itemId === item?.id
      ? saleDraft.price
      : mode === "cart" && initialPrice != null
        ? initialPrice.toString()
        : item?.selling_price != null
        ? item.selling_price.toString()
        : "";

  const initialTotal =
    Number.isInteger(Number(quantity)) &&
    Number(quantity) > 0 &&
    Number.isFinite(parseAmount(price))
      ? String(roundMoney(Number(quantity) * parseAmount(price)))
      : "";
  const total =
    saleDraft && saleDraft.itemId === item?.id
      ? saleDraft.total
      : initialTotal;
  const parsedQuantity = Number(quantity);
  const parsedPrice = parseAmount(price);

  const currentDraft = (): SaleDraft => ({
    itemId: item?.id ?? "",
    quantity,
    price,
    total,
  });

  const updateQuantity = (value: string) => {
    const draft = currentDraft();
    const qty = Number(value);
    const unitPrice = parseAmount(draft.price);
    setSaleDraft({
      ...draft,
      quantity: value,
      total:
        Number.isInteger(qty) && qty > 0 && Number.isFinite(unitPrice)
          ? String(roundMoney(unitPrice * qty))
          : "",
    });
  };

  const updatePrice = (value: string) => {
    const draft = currentDraft();
    const unitPrice = parseAmount(value);
    const qty = Number(draft.quantity);
    setSaleDraft({
      ...draft,
      price: value,
      total:
        Number.isInteger(qty) && qty > 0 && Number.isFinite(unitPrice)
          ? String(roundMoney(unitPrice * qty))
          : "",
    });
  };

  const updateTotal = (value: string) => {
    const draft = currentDraft();
    const lineTotal = parseAmount(value);
    const qty = Number(draft.quantity);
    setSaleDraft({
      ...draft,
      total: value,
      price:
        Number.isFinite(lineTotal) && Number.isInteger(qty) && qty > 0
          ? String(lineTotal / qty)
          : "",
    });
  };

  const handleClose = () => {
    setSaleDraft(null);
    setLoading(false);
    onClose();
  };

  const handleCompleteSale = async () => {
    if (!item) return;

    const parsedQty = Number(quantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 1) {
      showFeedback("Invalid quantity", "Please enter a valid quantity greater than 0.");
      return;
    }
    if (mode === "cart" && maxQuantity != null && parsedQty > maxQuantity) {
      showFeedback("Stock Error", `Only ${maxQuantity} available`);
      return;
    }

    const parsedPrice = parseAmount(price);
    const parsedTotal = parseAmount(total);
    if (
      !Number.isFinite(parsedTotal) ||
      parsedTotal <= 0 ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice <= 0
    ) {
      showFeedback("Invalid total", "Please enter a total greater than 0.");
      return;
    }

    if (mode === "cart") {
      onCartSave?.(parsedQty, parsedPrice);
      handleClose();
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "record_sale",
        {
          p_catalogue_item_id: item.id,
          p_quantity: parsedQty,
          p_unit_price: parsedPrice,
          p_reason: "Sale",
        },
      );

      if (error) {
        showFeedback("Sale failed", error.message);
        setLoading(false);
        return;
      }

      const saleResult = Array.isArray(data) ? data[0] : data;
      const saleRecorded = saleResult?.updated === true;
      const newQuantity =
        saleResult?.new_quantity != null
          ? Number(saleResult.new_quantity)
          : null;

      if (!saleRecorded) {
        if (typeof newQuantity === "number" && !isNaN(newQuantity)) {
          showFeedback("Stock Error", `Only ${newQuantity} available`);
        } else {
          showFeedback("Stock Error", "This item could not be found");
        }
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
              {mode === "cart" ? "Update cart" : "Sell"} — {item?.name}
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
            onChangeText={updateQuantity}
            keyboardType="numeric"
          />

          <View style={styles.fieldsRow}>
            <View style={styles.fieldColumn}>
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
                onChangeText={updatePrice}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.fieldColumn}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Total ({CURRENCIES[currency].symbol})
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
                value={total}
                onChangeText={updateTotal}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          {item?.selling_price != null &&
          Number.isInteger(parsedQuantity) &&
          parsedQuantity > 0 &&
          Number.isFinite(parsedPrice) &&
          parsedPrice < item.selling_price ? (
            <Text style={[styles.discountHint, { color: colors.textMuted }]}>
              Discount:{" "}
              {formatCurrency(
                roundMoney((item.selling_price - parsedPrice) * parsedQuantity),
                currency,
              )}
            </Text>
          ) : null}

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
                {mode === "cart" ? "Update cart" : "Complete Sale"}
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
    maxHeight: "75%",
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
  fieldsRow: { flexDirection: "row", gap: 10 },
  fieldColumn: { flex: 1 },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  discountHint: { fontSize: 12, marginBottom: 8 },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
});
