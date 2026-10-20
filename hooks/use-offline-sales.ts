import { useEffect, useState } from "react";
import { showToast } from "../components/app-feedback";
import { friendlyError } from "../constants/network-error";
import {
  listQueuedSales,
  QueuedSale,
  subscribeQueue,
} from "../constants/sale-queue";

export function useOfflineSales(
  userId: string | undefined,
  businessId: string | null,
): QueuedSale[] {
  const [queue, setQueue] = useState<{
    scope: string | null;
    sales: QueuedSale[];
  }>({ scope: null, sales: [] });
  const scope = userId && businessId ? `${userId}:${businessId}` : null;

  useEffect(() => {
    let active = true;
    if (!userId || !businessId) {
      setQueue({ scope: null, sales: [] });
      return;
    }
    const refresh = async () => {
      try {
        const queuedSales = await listQueuedSales(userId, businessId);
        if (active) setQueue({ scope, sales: queuedSales });
      } catch (error) {
        if (active) {
          showToast(
            "Couldn't load offline sales",
            friendlyError(error, "Please try again."),
          );
        }
      }
    };
    void refresh();
    const unsubscribe = subscribeQueue(() => void refresh());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [businessId, scope, userId]);

  return queue.scope === scope ? queue.sales : [];
}

export function getOfflinePendingQuantities(
  sales: QueuedSale[],
): Record<string, number> {
  const quantities: Record<string, number> = {};
  for (const sale of sales) {
    if (sale.status !== "pending") continue;
    for (const line of sale.lines) {
      quantities[line.catalogue_item_id] =
        (quantities[line.catalogue_item_id] ?? 0) + line.quantity;
    }
  }
  return quantities;
}
