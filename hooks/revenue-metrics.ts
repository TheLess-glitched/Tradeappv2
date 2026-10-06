export type RevenueRecord = {
  record_type: "job" | "sale";
  line_total: number | null;
  quantity: number;
  unit_price: number | null;
  unit_cost: number | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
};

export function getJobProfit(
  record: Pick<RevenueRecord, "quantity" | "unit_price" | "unit_cost">,
): number | null {
  if (record.unit_price == null || record.unit_cost == null) return null;

  return record.quantity * (record.unit_price - record.unit_cost);
}

export function calculateRevenueMetrics(
  jobs: RevenueRecord[],
  sales: RevenueRecord[],
) {
  const completedJobs = jobs.filter((job) => job.status === "done");
  const pendingJobs = jobs.filter(
    (job) => job.status === "pending" || job.status === "in_progress",
  );
  const profitRecords = [...sales, ...completedJobs];
  const unknownCostSalesCount = sales.filter(
    (sale) => getJobProfit(sale) == null,
  ).length;
  const unknownCostCompletedJobsCount = completedJobs.filter(
    (job) => getJobProfit(job) == null,
  ).length;

  const jobsRevenue = completedJobs.reduce(
    (sum, job) => sum + (job.line_total ?? 0),
    0,
  );
  const salesRevenue = sales.reduce(
    (sum, sale) => sum + (sale.line_total ?? 0),
    0,
  );

  return {
    jobsRevenue,
    salesRevenue,
    totalRevenue: jobsRevenue + salesRevenue,
    pendingJobsRevenue: pendingJobs.reduce(
      (sum, job) => sum + (job.line_total ?? 0),
      0,
    ),
    profitToday: profitRecords.reduce(
      (sum, record) => sum + (getJobProfit(record) ?? 0),
      0,
    ),
    knownCostProfitCount: profitRecords.filter(
      (record) => getJobProfit(record) != null,
    ).length,
    unknownCostSalesCount,
    unknownCostCompletedJobsCount,
  };
}