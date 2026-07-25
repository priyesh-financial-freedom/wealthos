import { supabase } from "@/lib/supabase/client";
import type { MonthlySnapshot } from "@/types/monthlySnapshot";

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

async function requireAuthenticatedUser() {
  const client = assertSupabaseClient();

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
    throw new Error("Authentication required.");
  }

  return { client, user };
}

function currentMonthYear(now = new Date()) {
  return {
    snapshot_month: now.getMonth() + 1,
    snapshot_year: now.getFullYear(),
  };
}

export class SnapshotWriteService {
  async closeCurrentMonthSnapshot(): Promise<MonthlySnapshot> {
    const { client } = await requireAuthenticatedUser();
    const { snapshot_month, snapshot_year } = currentMonthYear();

    const { data, error } = await client.rpc("close_monthly_snapshot", {
      p_snapshot_month: snapshot_month,
      p_snapshot_year: snapshot_year,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data as MonthlySnapshot;
  }
}

export const snapshotWriteService = new SnapshotWriteService();
