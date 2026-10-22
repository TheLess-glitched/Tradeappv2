import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { supabase } from "../constants/supabase";
import { useAuth } from "../context/auth-context";

export function useOpenJobs() {
  const { businessId } = useAuth();
  const [counts, setCounts] = useState({ pending: 0, inProgress: 0 });

  const fetchOpenJobs = useCallback(async () => {
    if (!businessId) {
      setCounts({ pending: 0, inProgress: 0 });
      return;
    }
    try {
      const base = () =>
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("record_type", "job")
          .is("voided_at", null);
      const [pending, inProgress] = await Promise.all([
        base().eq("status", "pending"),
        base().eq("status", "in_progress"),
      ]);
      if (pending.error || inProgress.error) return;
      setCounts({
        pending: pending.count ?? 0,
        inProgress: inProgress.count ?? 0,
      });
    } catch {
      // keep the previous counts if the request fails
    }
  }, [businessId]);

  useFocusEffect(
    useCallback(() => {
      void fetchOpenJobs();
    }, [fetchOpenJobs]),
  );

  return { ...counts, refetch: fetchOpenJobs };
}
