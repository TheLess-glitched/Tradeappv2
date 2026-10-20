import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { fetchTodayRecords } from "../constants/today-records";
import { useAuth } from "../context/auth-context";
import type { RevenueRecord } from "./revenue-metrics";
import { calculateRevenueMetrics } from "./revenue-metrics";
import { groupSaleRows } from "./sale-groups";
import { useOfflineSales } from "./use-offline-sales";
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
  sale_group_id: string | null;
  price: number | null;
};

export function useTodaysJobs() {
  const { businessId, user } = useAuth();
  const [records, setRecords] = useState<TodayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const hasDataRef = useRef(false);
  const queuedSales = useOfflineSales(user?.id, businessId);
    const fetchTodayJobs = useCallback(async () => {
    if (!hasDataRef.current) {
      setLoading(true);
    }

    try {
      if (!businessId) {
        setRecords([]);
        return;
      }

      const allRecords = await fetchTodayRecords(businessId);
      setRecords(allRecords);
      hasDataRef.current = allRecords.length > 0;
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
  const voidedSaleGroupsToday = groupSaleRows(
    records.filter((record) => record.record_type === "sale"),
  ).filter((group) => group.lines.some((line) => isToday(line.voided_at)));
  const voidedJobsCount = voidedRecords.filter(
    (record) => record.record_type === "job",
  ).length;
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
  const displaySaleGroupIds = new Set(
    records
      .filter(
        (record) =>
          record.record_type === "sale" &&
          (isToday(record.created_at) || isToday(record.voided_at)) &&
          record.sale_group_id != null,
      )
      .map((record) => record.sale_group_id),
  );
  const salesForDisplay = records.filter(
    (record) =>
      record.record_type === "sale" &&
      (isToday(record.created_at) ||
        isToday(record.voided_at) ||
        (record.sale_group_id != null &&
          displaySaleGroupIds.has(record.sale_group_id))),
  );
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
  const salesCompletedGroups = groupSaleRows(salesCompletedToday);
  const offlineSalesToday = queuedSales.filter(
    (sale) => sale.status === "pending" && isToday(sale.occurredAt),
  );
  const offlineSalesRevenue = offlineSalesToday.reduce(
    (sum, sale) =>
      sum +
      sale.lines.reduce(
        (saleTotal, line) => saleTotal + line.quantity * line.unit_price,
        0,
      ),
    0,
  );
  const offlineSalesUnits = offlineSalesToday.reduce(
    (sum, sale) =>
      sum + sale.lines.reduce((saleTotal, line) => saleTotal + line.quantity, 0),
    0,
  );
  const revenueMetrics = calculateRevenueMetrics(
    [...completedJobsToday, ...pendingJobsToday, ...inProgressJobsToday],
    salesCompletedToday,
  );
  const salesRevenue = revenueMetrics.salesRevenue + offlineSalesRevenue;
  const totalRevenue = revenueMetrics.totalRevenue + offlineSalesRevenue;
  const unitsSold = salesCompletedToday.reduce(
    (sum, sale) => sum + sale.quantity,
    offlineSalesUnits,
  );

  return {
    jobs,
    sales,
    salesForDisplay,
    completedJobsToday,
    salesCompletedToday,
    voidedRecords,
    voidedSaleGroupsToday,
    voidedCount: voidedJobsCount + voidedSaleGroupsToday.length,
    voidedRevenue,
    loading,
    refetch: fetchTodayJobs,
    ...revenueMetrics,
    salesRevenue,
    totalRevenue,
    unknownCostSalesCount:
      revenueMetrics.unknownCostSalesCount + offlineSalesToday.length,
    jobsCount: jobs.length,
    salesCount: salesCompletedGroups.length + offlineSalesToday.length,
    unitsSold,
    offlineSales: offlineSalesToday,
    offlineSalesCount: offlineSalesToday.length,
    offlineSalesRevenue,
    hasUnknownCostSales:
      revenueMetrics.unknownCostSalesCount + offlineSalesToday.length > 0,
    pendingJobs: pendingJobsToday.length,
    completedJobs: completedJobsToday.length,
    inProgressJobs: inProgressJobsToday.length,
    unfinishedJobs,
    unfinishedCount: unfinishedJobs.length,
  };
}
