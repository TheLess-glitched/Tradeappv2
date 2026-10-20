import Storage from "expo-sqlite/kv-store";
import { useEffect, useRef } from "react";
import {
  catalogueListQuery,
  customersListQuery,
  jobCataloguePickerQuery,
  jobCustomerPickerQuery,
  trackedCatalogueListQuery,
} from "../constants/queries";
import { useAuth } from "../context/auth-context";
import { useIsOnline } from "./use-online";

const LAST_RUN_KEY = "offline_warmup:last_run_v1";
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const QUERY_PAUSE_MS = 250;

type WarmupState = {
  online: boolean;
  isSignedIn: boolean;
  isBusinessReady: boolean;
  businessId: string | null;
};

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, QUERY_PAUSE_MS));

export function useOfflineWarmup(): void {
  const { isSignedIn, isBusinessReady, businessId } = useAuth();
  const online = useIsOnline();
  const stateRef = useRef<WarmupState>({
    online,
    isSignedIn,
    isBusinessReady,
    businessId,
  });
  const wasOnlineRef = useRef(online);
  const isRunningRef = useRef(false);

  useEffect(() => {
    stateRef.current = { online, isSignedIn, isBusinessReady, businessId };
  }, [businessId, isBusinessReady, isSignedIn, online]);

  useEffect(() => {
    const returnedOnline = !wasOnlineRef.current && online;
    wasOnlineRef.current = online;

    if (!online || !isSignedIn || !isBusinessReady || !businessId || isRunningRef.current) {
      return;
    }

    const runWarmup = async () => {
      isRunningRef.current = true;
      try {
        const storedLastRun = await Storage.getItem(LAST_RUN_KEY);
        const lastRunAt = storedLastRun ? Number(storedLastRun) : null;
        const elapsed =
          lastRunAt !== null && Number.isFinite(lastRunAt)
            ? Date.now() - lastRunAt
            : Infinity;
        const eligible = returnedOnline
          ? elapsed > THIRTY_MINUTES_MS
          : elapsed > TWO_HOURS_MS;
        if (!eligible) return;

        await Storage.setItem(LAST_RUN_KEY, String(Date.now()));

        const queries = [
          () => catalogueListQuery(businessId),
          () => trackedCatalogueListQuery(businessId),
          () => jobCataloguePickerQuery(businessId),
          () => customersListQuery(businessId),
          () => jobCustomerPickerQuery(businessId),
        ];

        for (let index = 0; index < queries.length; index++) {
          const current = stateRef.current;
          if (
            !current.online ||
            !current.isSignedIn ||
            !current.isBusinessReady ||
            current.businessId !== businessId
          ) {
            break;
          }
          try {
            await queries[index]();
          } catch {
            // Warm-up is best effort; it must not affect the UI.
          }
          if (index < queries.length - 1) await pause();
        }
      } catch {
        // Warm-up storage is best effort; it must not affect the UI.
      } finally {
        isRunningRef.current = false;
      }
    };

    void runWarmup();
  }, [businessId, isBusinessReady, isSignedIn, online]);
}
