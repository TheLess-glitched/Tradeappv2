import {
  catalogueListQuery,
  customersListQuery,
  firstRecordQuery,
  jobsListQuery,
  trackedCatalogueListQuery,
} from "./queries";
import { supabase } from "./supabase";
import { fetchTodayRecords } from "./today-records";

async function quietly(task: () => PromiseLike<unknown>): Promise<void> {
  try {
    await task();
  } catch {
    // best effort: a failed warm-up must never bother the person
  }
}

// Fetches what the offline screens need so the read cache has it before the
// person goes offline. Each request must match the screen's own request.
export async function warmSellingData(
  businessId: string,
  role?: string | null,
): Promise<void> {
  await quietly(() => trackedCatalogueListQuery(businessId));
  await quietly(() => catalogueListQuery(businessId));
  await quietly(() => customersListQuery(businessId));
  await quietly(() => jobsListQuery(businessId));
  await quietly(() => fetchTodayRecords(businessId));

  // Team: same RPC and no arguments, exactly as app/team.tsx calls it.
  if (role === "owner") {
    await quietly(() => supabase.rpc("list_business_members"));
  } else if (role === "worker") {
    await quietly(() => supabase.rpc("list_team"));
  }

  if (role !== "owner") return;

  // Lets History tell "before the first record" from "not saved on this phone".
  await quietly(() => firstRecordQuery(businessId));

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const months = [
    { year, month },
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
  ];
  for (const m of months) {
    // Same argument order as hooks/use-revenue-history.ts (the key includes the body).
    await quietly(() =>
      supabase.rpc("revenue_by_day", {
        p_business_id: businessId,
        p_year: m.year,
        p_month: m.month,
      }),
    );
  }
}