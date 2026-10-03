import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { supabase } from "../constants/supabase";
import type { RevenueRecord } from "./revenue-metrics";
import { calculateRevenueMetrics } from "./revenue-metrics";
export { getJobProfit } from "./revenue-metrics";

export type TodayRecord = RevenueRecord & {
  id: number;
  customer_name: string | null;
  service: string;
  created_at: string;
};

export function useTodaysJobs() {
  const [records, setRecords] = useState<TodayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);

  const fetchTodayJobs = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Force strictly local timezone boundaries to prevent UTC bleed
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("jobs")
        .select("id, customer_name, service, record_type, line_total, quantity, unit_price, unit_cost, status, created_at")
        .eq("user_id", user?.id)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString())
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTodayJobs();
    }, [fetchTodayJobs]),
  );

  const jobs = records.filter((record) => record.record_type === "job");
  const sales = records.filter((record) => record.record_type === "sale");
  const revenueMetrics = calculateRevenueMetrics(jobs, sales);
  const pendingJobs = jobs.filter((job) => job.status === "pending").length;
  const inProgressJobs = jobs.filter((job) => job.status === "in_progress").length;
  const completedJobs = jobs.filter((job) => job.status === "done").length;
  const unfinishedJobs = jobs.filter((job) => job.status !== "done");
  const unitsSold = sales.reduce((sum, sale) => sum + sale.quantity, 0);

  return {
    jobs,
    sales,
    loading,
    refetch: fetchTodayJobs,
    ...revenueMetrics,
    jobsCount: jobs.length,
    salesCount: sales.length,
    unitsSold,
    hasUnknownCostSales: revenueMetrics.unknownCostSalesCount > 0,
    pendingJobs,
    completedJobs,
    inProgressJobs,
    unfinishedJobs,
    unfinishedCount: unfinishedJobs.length,
  };
}
