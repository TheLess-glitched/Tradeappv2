import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";
import type { RevenueRecord } from "./revenue-metrics";
import { calculateRevenueMetrics } from "./revenue-metrics";
export { getJobProfit } from "./revenue-metrics";

export type TodayRecord = RevenueRecord & {
  id: number;
  customer_name: string | null;
  service: string;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  voided_at: string | null;
  void_reason: string | null;
};

export function useTodaysJobs() {
  const { businessId } = useAuth();
  const [records, setRecords] = useState<TodayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  const fetchTodayJobs = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      if (!businessId) {
        setRecords([]);
        return;
      }

      // Force strictly local timezone boundaries to prevent UTC bleed
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("jobs")
        .select("id, customer_name, service, record_type, line_total, quantity, unit_price, unit_cost, status, created_at, completed_at, created_by, created_by_name, voided_at, void_reason")
        .eq("business_id", businessId)
        .or(
          `and(created_at.gte.${startOfDay.toISOString()},created_at.lte.${endOfDay.toISOString()}),and(completed_at.gte.${startOfDay.toISOString()},completed_at.lte.${endOfDay.toISOString()}),and(voided_at.gte.${startOfDay.toISOString()},voided_at.lte.${endOfDay.toISOString()})`,
        )
        .order("created_at", { ascending: false });

      if (!error && data) {
        setRecords(data);
        hasDataRef.current = data.length > 0;
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useFocusEffect(
    useCallback(() => {
      fetchTodayJobs();
    }, [fetchTodayJobs]),
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const isToday = (value: string | null) => {
    if (!value) return false;
    const timestamp = new Date(value).getTime();
    return timestamp >= todayStart.getTime() && timestamp <= todayEnd.getTime();
  };
  const voidedRecords = records.filter((record) => {
    return isToday(record.voided_at);
  });
  const voidedRevenue = voidedRecords.reduce(
    (sum, record) => sum + (record.line_total ?? 0),
    0,
  );
  const activeRecords = records.filter(
    (record) =>
      record.voided_at == null &&
      (isToday(record.created_at) || isToday(record.completed_at)),
  );
  const jobs = activeRecords.filter((record) => record.record_type === "job");
  const sales = activeRecords.filter((record) => record.record_type === "sale");
  const completedJobsToday = jobs.filter(
    (job) => job.status === "done" && isToday(job.completed_at),
  );
  const jobsCreatedToday = jobs.filter((job) => isToday(job.created_at));
  const pendingJobsToday = jobsCreatedToday.filter(
    (job) => job.status === "pending",
  );
  const inProgressJobsToday = jobsCreatedToday.filter(
    (job) => job.status === "in_progress",
  );
  const unfinishedJobs = jobsCreatedToday.filter((job) => job.status !== "done");
  const salesCompletedToday = sales.filter((sale) => isToday(sale.completed_at));
  const revenueMetrics = calculateRevenueMetrics(
    [...completedJobsToday, ...pendingJobsToday, ...inProgressJobsToday],
    salesCompletedToday,
  );
  const unitsSold = salesCompletedToday.reduce(
    (sum, sale) => sum + sale.quantity,
    0,
  );

  return {
    jobs,
    sales,
    completedJobsToday,
    salesCompletedToday,
    voidedRecords,
    voidedCount: voidedRecords.length,
    voidedRevenue,
    loading,
    refetch: fetchTodayJobs,
    ...revenueMetrics,
    jobsCount: jobs.length,
    salesCount: salesCompletedToday.length,
    unitsSold,
    hasUnknownCostSales: revenueMetrics.unknownCostSalesCount > 0,
    pendingJobs: pendingJobsToday.length,
    completedJobs: completedJobsToday.length,
    inProgressJobs: inProgressJobsToday.length,
    unfinishedJobs,
    unfinishedCount: unfinishedJobs.length,
  };
}
