import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./auth-context";

export type CartItemInput = {
  id: string;
  name: string;
  selling_price: number | null;
  quantity: number;
};

export type CartLine = {
  itemId: string;
  name: string;
  qty: number;
  unitPrice: number;
  availableStock: number;
};

type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  total: number;
  addOne: (item: CartItemInput) => void;
  setQty: (itemId: string, qty: number) => void;
  setAvailableStock: (itemId: string, availableStock: number) => void;
  setPrice: (itemId: string, price: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { businessId } = useAuth();
  return (
    <CartStateProvider key={businessId ?? "no-business"}>
      {children}
    </CartStateProvider>
  );
}

function CartStateProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);

  const updateItems = useCallback(
    (update: (current: CartLine[]) => CartLine[]) =>
      setItems((current) => update(current)),
    [],
  );

  const clear = useCallback(() => updateItems(() => []), [updateItems]);

  const addOne = useCallback((item: CartItemInput) => {
    const availableStock = Math.max(0, Math.floor(item.quantity));
    updateItems((current) => {
      const existing = current.find((line) => line.itemId === item.id);
      if (existing && availableStock < 1) return current;
      if (!existing && availableStock < 1) return current;

      if (existing) {
        return current.map((line) =>
          line.itemId === item.id
            ? {
                ...line,
                name: item.name,
                availableStock,
                qty: Math.min(line.qty + (line.qty < availableStock ? 1 : 0), availableStock),
              }
            : line,
        );
      }

      return [
        ...current,
        {
          itemId: item.id,
          name: item.name,
          qty: 1,
          unitPrice: item.selling_price ?? 0,
          availableStock,
        },
      ];
    });
  }, [updateItems]);

  const setQty = useCallback((itemId: string, qty: number) => {
    const safeQty = Number.isFinite(qty) ? Math.max(0, Math.floor(qty)) : 0;
    updateItems((current) =>
      current.flatMap((line) => {
        if (line.itemId !== itemId) return [line];
        const boundedQty = Math.min(safeQty, line.availableStock);
        return boundedQty > 0 ? [{ ...line, qty: boundedQty }] : [];
      }),
    );
  }, [updateItems]);

  const setAvailableStock = useCallback(
    (itemId: string, availableStock: number) => {
      if (!Number.isFinite(availableStock)) return;
      const safeStock = Math.max(0, Math.floor(availableStock));
      updateItems((current) =>
        current.flatMap((line) => {
          if (line.itemId !== itemId) return [line];
          const qty = Math.min(line.qty, safeStock);
          return qty > 0 ? [{ ...line, availableStock: safeStock, qty }] : [];
        }),
      );
    },
    [updateItems],
  );

  const setPrice = useCallback((itemId: string, price: number) => {
    if (!Number.isFinite(price)) return;
    updateItems((current) =>
      current.map((line) =>
        line.itemId === itemId ? { ...line, unitPrice: price } : line,
      ),
    );
  }, [updateItems]);

  const remove = useCallback(
    (itemId: string) => {
      updateItems((current) => current.filter((line) => line.itemId !== itemId));
    },
    [updateItems],
  );

  const value = useMemo(
    () => ({
      items,
      itemCount: items.reduce((count, line) => count + line.qty, 0),
      total: items.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
      addOne,
      setQty,
      setAvailableStock,
      setPrice,
      remove,
      clear,
    }),
    [items, addOne, setQty, setAvailableStock, setPrice, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
