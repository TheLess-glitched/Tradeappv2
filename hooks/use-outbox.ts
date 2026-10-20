import { useEffect, useState } from "react";
import { showToast } from "../components/app-feedback";
import { friendlyError } from "../constants/network-error";
import { listOutbox, OutboxItem, subscribeOutbox } from "../constants/outbox";

export function useOutbox(
  userId: string | undefined,
  businessId: string | null,
): OutboxItem[] {
  const [state, setState] = useState<{ scope: string | null; items: OutboxItem[] }>({
    scope: null,
    items: [],
  });
  const scope = userId && businessId ? `${userId}:${businessId}` : null;

  useEffect(() => {
    let active = true;
    if (!userId || !businessId) {
      setState({ scope: null, items: [] });
      return;
    }
    const refresh = async () => {
      try {
        const items = await listOutbox(userId, businessId);
        if (active) setState({ scope, items });
      } catch (error) {
        if (active) {
          showToast(
            "Couldn't load waiting items",
            friendlyError(error, "Please try again."),
          );
        }
      }
    };
    void refresh();
    const unsubscribe = subscribeOutbox(() => void refresh());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [businessId, scope, userId]);

  return state.scope === scope ? state.items : [];
}