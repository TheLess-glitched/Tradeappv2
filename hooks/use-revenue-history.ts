import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { showToast } from "../components/app-feedback";
import { friendlyError, isNetworkError } from '../constants/network-error';
import { firstRecordQuery } from '../constants/queries';
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
import type { TodayRecord } from "./use-todays-jobs";

export type RevenueHistoryDay = {
  day: string;
  jobs_revenue: number;
  sales_revenue: number;
  revenue: number;
  profit: number;
  sales_count: number;
  jobs_count: number;
  unknown_cost_count: number;
};

function asNumber(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("The server returned an invalid revenue summary.");
  }
  return number;
}

function toDayRecords(value: string): { start: string; end: string } {
  const [year, month, day] = value.split("-").map(Number);
  const nextDay = new Date(year, month - 1, day + 1);
  const next = [
    nextDay.getFullYear(),
    String(nextDay.getMonth() + 1).padStart(2, "0"),
    String(nextDay.getDate()).padStart(2, "0"),
  ].join("-");
  return {
    start: `${value}T00:00:00+01:00`,
    end: `${next}T00:00:00+01:00`,
  };
}

// Offline, a month before the first record or after today can't hold sales.
async function isOutsideRecordedMonths(
  businessId: string,
  year: number,
  month: number,
): Promise<boolean> {
  try {
    const now = new Date();
    const selected = year * 12 + month;
    if (selected > now.getFullYear() * 12 + now.getMonth() + 1) return true;
    const { data, error } = await firstRecordQuery(businessId);
    if (error || !data || data.length === 0) return false;
    const first = new Date(data[0].created_at);
    return selected < first.getFullYear() * 12 + first.getMonth() + 1;
  } catch {
    return false;
  }
}

export function useRevenueHistory(year: number, month: number) {
  const { businessId, role } = useAuth();
  const [rows, setRows] = useState<RevenueHistoryDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dayRecordState, setDayRecordState] = useState<{
    businessId: string | null;
    values: Record<string, TodayRecord[]>;
  }>({ businessId: null, values: {} });
  const [loadingDayState, setLoadingDayState] = useState<{
    businessId: string | null;
    values: Record<string, boolean>;
  }>({ businessId: null, values: {} });
  const dayCacheRef = useRef(new Map<string, TodayRecord[]>());
  const dayRequestsRef = useRef(new Map<string, Promise<TodayRecord[]>>());
  const dayRecords =
    dayRecordState.businessId === businessId ? dayRecordState.values : {};
  const loadingDays =
    loadingDayState.businessId === businessId ? loadingDayState.values : {};

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    setRows([]);
    setError(false);
    try {
      if (!businessId || role !== "owner") return;
      const { data, error } = await supabase.rpc("revenue_by_day", {
        p_business_id: businessId,
        p_year: year,
        p_month: month,
      });
      if (error) throw error;
      if (!Array.isArray(data)) {
        throw new Error("The server returned an invalid revenue summary.");
      }
      const parsedRows = (data as unknown[]).map((value) => {
        if (typeof value !== "object" || value === null) {
          throw new Error("The server returned an invalid revenue summary.");
        }
        const row = value as Record<string, unknown>;
        if (typeof row.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.day)) {
          throw new Error("The server returned an invalid revenue summary.");
        }
        return {
          day: row.day,
          jobs_revenue: asNumber(row.jobs_revenue),
          sales_revenue: asNumber(row.sales_revenue),
          revenue: asNumber(row.revenue),
          profit: asNumber(row.profit),
          sales_count: asNumber(row.sales_count),
          jobs_count: asNumber(row.jobs_count),
          unknown_cost_count: asNumber(row.unknown_cost_count),
        };
      });
      parsedRows.sort((left, right) => right.day.localeCompare(left.day));
      setRows(parsedRows);
    } catch (error) {
      setRows([]);
      if (
        businessId &&
        isNetworkError(error) &&
        (await isOutsideRecordedMonths(businessId, year, month))
      ) {
        setError(false);
      } else if (isNetworkError(error)) {
        setError(true);
        showToast(
          "This month isn't saved on your phone",
          "Connect to the internet once to view it. Months you've opened online stay available offline.",
        );
      } else {
        setError(true);
        showToast("Couldn't load revenue history", friendlyError(error, "Please try again."));
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, month, role, year]);

  useFocusEffect(
    useCallback(() => {
      void fetchMonth();
    }, [fetchMonth]),
  );

  const fetchDayRecords = useCallback(
    (day: string): Promise<TodayRecord[]> => {
      if (!businessId || role !== "owner") return Promise.resolve([]);
      const cacheKey = `${businessId}:${day}`;
      const cached = dayCacheRef.current.get(cacheKey);
      if (cached) return Promise.resolve(cached);

      const pendingRequest = dayRequestsRef.current.get(cacheKey);
      if (pendingRequest) return pendingRequest;

      setLoadingDayState((current) => ({
        businessId,
        values:
          current.businessId === businessId
            ? { ...current.values, [day]: true }
            : { [day]: true },
      }));
      const request = (async () => {
        try {
          const { start, end } = toDayRecords(day);
          const pageSize = 500;
          const records: TodayRecord[] = [];
          let offset = 0;
          while (true) {
            const { data, error } = await supabase
              .from("jobs")
              .select("id, customer_name, service, record_type, line_total, quantity, unit_price, unit_cost, price, status, created_at, completed_at, created_by, created_by_name, sale_group_id, voided_at, void_reason")
              .eq("business_id", businessId)
              .is("voided_at", null)
              .gte("completed_at", start)
              .lt("completed_at", end)
              .or("record_type.eq.sale,and(record_type.eq.job,status.eq.done)")
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
              .range(offset, offset + pageSize - 1);

            if (error) throw error;
            records.push(...((data ?? []) as TodayRecord[]));
            if ((data?.length ?? 0) < pageSize) break;
            offset += pageSize;
          }
          dayCacheRef.current.set(cacheKey, records);
          setDayRecordState((current) => ({
            businessId,
            values:
              current.businessId === businessId
                ? { ...current.values, [day]: records }
                : { [day]: records },
          }));
          return records;
        } catch (error) {
          if (isNetworkError(error)) {
            showToast(
              "This day isn't saved on your phone",
              "Connect to the internet once to view it. Days you've opened online stay available offline."
            );
          } else {
            showToast(
              "Couldn't load this day's records",
              friendlyError(error, "Please try again.")
          );
        }
        return [];
        } finally {
          dayRequestsRef.current.delete(cacheKey);
          setLoadingDayState((current) =>
            current.businessId === businessId
              ? { businessId, values: { ...current.values, [day]: false } }
              : current,
          );
        }
      })();
      dayRequestsRef.current.set(cacheKey, request);
      return request;
    },
    [businessId, role],
  );

  return { rows, loading, error, dayRecords, loadingDays, fetchDayRecords };
}
