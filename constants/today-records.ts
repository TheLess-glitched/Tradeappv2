import type { TodayRecord } from "../hooks/use-todays-jobs";
import { supabase } from "./supabase";

const COLUMNS =
  "id, customer_name, service, record_type, line_total, quantity, unit_price, unit_cost, price, status, created_at, completed_at, created_by, created_by_name, sale_group_id, voided_at, void_reason";

// Today's records plus every line of any grouped sale touched today.
// Shared by Daily Close and the offline warm-up, so both send identical
// requests (the read cache is keyed by the exact URL).
export async function fetchTodayRecords(businessId: string): Promise<TodayRecord[]> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const pageSize = 500;
  const allRecords: TodayRecord[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("jobs")
      .select(COLUMNS)
      .eq("business_id", businessId)
      .or(
        `and(created_at.gte.${startOfDay.toISOString()},created_at.lte.${endOfDay.toISOString()}),and(completed_at.gte.${startOfDay.toISOString()},completed_at.lte.${endOfDay.toISOString()}),and(voided_at.gte.${startOfDay.toISOString()},voided_at.lte.${endOfDay.toISOString()})`,
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    allRecords.push(...(data ?? []));
    if ((data?.length ?? 0) < pageSize) break;
    offset += pageSize;
  }

  const groupedSaleIds = Array.from(
    new Set(
      allRecords
        .filter((record) => record.record_type === "sale" && record.sale_group_id != null)
        .map((record) => record.sale_group_id),
    ),
  ).filter((id): id is string => id != null);
  const seenIds = new Set(allRecords.map((record) => record.id));
  for (let start = 0; start < groupedSaleIds.length; start += 100) {
    const idChunk = groupedSaleIds.slice(start, start + 100);
    let groupOffset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("jobs")
        .select(COLUMNS)
        .eq("business_id", businessId)
        .eq("record_type", "sale")
        .in("sale_group_id", idChunk)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(groupOffset, groupOffset + pageSize - 1);

      if (error) throw error;
      for (const record of data ?? []) {
        if (!seenIds.has(record.id)) {
          seenIds.add(record.id);
          allRecords.push(record);
        }
      }
      if ((data?.length ?? 0) < pageSize) break;
      groupOffset += pageSize;
    }
  }
  return allRecords;
}