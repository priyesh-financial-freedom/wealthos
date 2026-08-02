import { supabase } from "@/lib/supabase/client";

import type {
  CreateProjectionAssumptionSnapshotInput,
  CreateProjectionPlanVersionInput,
  CreateProjectionRebaseJournalInput,
  ProjectionAssumptionSnapshotRecord,
  ProjectionMonthlyPositionRecord,
  ProjectionPlanVersionRecord,
  ProjectionRebaseJournalRecord,
  ProjectionSalaryCurveRecord,
  UpsertProjectionMonthlyPositionInput,
  UpsertProjectionSalaryCurveInput,
} from "./types";

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
    throw new Error("Authentication required.");
  }

  return { client, user };
}

export class ProjectionVersioningRepository {
  async createPlanVersion(input: CreateProjectionPlanVersionInput): Promise<ProjectionPlanVersionRecord> {
    const { client, user } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("projection_plan_versions")
      .insert({
        user_id: user.id,
        household_id: input.household_id ?? null,
        plan_kind: input.plan_kind,
        version_no: input.version_no,
        status: input.status ?? "DRAFT",
        start_month: input.start_month,
        horizon_end_month: input.horizon_end_month,
        base_close_id: input.base_close_id ?? null,
        parent_fixed_version_id: input.parent_fixed_version_id ?? null,
        locked_at: input.locked_at ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as ProjectionPlanVersionRecord;
  }

  async getPlanVersionById(id: string): Promise<ProjectionPlanVersionRecord | null> {
    const { client, user } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("projection_plan_versions")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data as ProjectionPlanVersionRecord | null) ?? null;
  }

  async updatePlanStatus(id: string, status: ProjectionPlanVersionRecord["status"], lockedAt?: string | null): Promise<ProjectionPlanVersionRecord> {
    const { client, user } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("projection_plan_versions")
      .update({
        status,
        locked_at: lockedAt ?? null,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as ProjectionPlanVersionRecord;
  }

  async upsertAssumptionSnapshot(input: CreateProjectionAssumptionSnapshotInput): Promise<ProjectionAssumptionSnapshotRecord> {
    const { client } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("projection_assumption_snapshots")
      .upsert(
        {
          projection_plan_version_id: input.projection_plan_version_id,
          assumption_payload: input.assumption_payload,
          salary_policy_payload: input.salary_policy_payload,
          retirement_policy_payload: input.retirement_policy_payload,
          drawdown_policy_payload: input.drawdown_policy_payload,
          checksum: input.checksum ?? null,
        },
        { onConflict: "projection_plan_version_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as ProjectionAssumptionSnapshotRecord;
  }

  async upsertSalaryCurve(rows: UpsertProjectionSalaryCurveInput[]): Promise<ProjectionSalaryCurveRecord[]> {
    if (rows.length === 0) {
      return [];
    }

    const { client } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("projection_salary_curve")
      .upsert(rows, { onConflict: "projection_plan_version_id,month_key" })
      .select("*");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as ProjectionSalaryCurveRecord[];
  }

  async upsertMonthlyPositions(rows: UpsertProjectionMonthlyPositionInput[]): Promise<ProjectionMonthlyPositionRecord[]> {
    if (rows.length === 0) {
      return [];
    }

    const { client } = await requireAuthenticatedUser();
    const prepared = rows.map((row) => ({
      ...row,
      metadata: row.metadata ?? {},
    }));

    const { data, error } = await client
      .from("projection_monthly_positions")
      .upsert(prepared, { onConflict: "projection_plan_version_id,month_key,bucket_key" })
      .select("*");

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as ProjectionMonthlyPositionRecord[];
  }

  async appendRebaseJournal(input: CreateProjectionRebaseJournalInput): Promise<ProjectionRebaseJournalRecord> {
    const { client } = await requireAuthenticatedUser();
    const { data, error } = await client
      .from("projection_rebase_journal")
      .insert({
        rolling_version_id: input.rolling_version_id,
        parent_fixed_version_id: input.parent_fixed_version_id,
        rebased_from_close_id: input.rebased_from_close_id,
        rebased_month: input.rebased_month,
        prior_rolling_version_id: input.prior_rolling_version_id ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as ProjectionRebaseJournalRecord;
  }
}
