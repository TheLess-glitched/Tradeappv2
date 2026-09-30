import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { supabase } from "../constants/supabase";

export type TodayJob = {
  id: number;
  customer_name: string | null;
  service: string;
  price: number;
  status: string;
  created_at: string;
};

export function useTodaysJobs() {
  const [jobs, setJobs] = useState<TodayJob[]>([]);
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
        .select("*")
        .eq("user_id", user?.id)
        .gte("created_at", startOfDay.toISOString())
        .lte("created_at", endOfDay.toISOString())
        .order("created_at", { ascending: false });

      if (!error && data) {
        setJobs(data);
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

  const totalRevenue = jobs.reduce((sum, job) => sum + (job.price || 0), 0);
  const completedJobs = jobs.filter((j) => j.status === "done");
  const inProgressJobs = jobs.filter((j) => j.status === "in_progress");
  const unfinishedJobs = jobs.filter((j) => j.status !== "done");

  return {
    jobs,
    loading,
    refetch: fetchTodayJobs,
    totalRevenue,
    completedJobs: completedJobs.length,
    inProgressJobs: inProgressJobs.length,
    unfinishedJobs,
    unfinishedCount: unfinishedJobs.length,
  };
}
