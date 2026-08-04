import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  groupMonthlyPositionRows,
  groupMonthlyPositionSnapshots,
  VIEWER_BUCKET_KEYS,
  type ProjectionViewerBucketKey,
  type ProjectionViewerMonthRow,
  type ProjectionViewerMonthSnapshot,
} from "./ProjectionReadModel";

export interface ProjectionViewerPlanSummary {
  id: string;
  version_no: number;
  status: "DRAFT" | "LOCKED" | "ARCHIVED";
  start_month: string;
  horizon_end_month: string;
  locked_at: string | null;
  updated_at: string;
  parent_fixed_version_id: string | null;
  base_close_id: string | null;
}

export interface ProjectionViewerFixedPlanResult {
  plan: ProjectionViewerPlanSummary;
  monthRows: ProjectionViewerMonthRow[];
  monthSnapshots: ProjectionViewerMonthSnapshot[];
}

export interface ProjectionViewerRollingPlanResult {
  plan: ProjectionViewerPlanSummary;
  monthRows: ProjectionViewerMonthRow[];
  monthSnapshots: ProjectionViewerMonthSnapshot[];
  linkedFixedVersionNo: number | null;
  rebasedFromMonth: string | null;
}

interface ProjectionPlanRow {
  id: string;
  version_no: number;
  status: "DRAFT" | "LOCKED" | "ARCHIVED";
  start_month: string;
  horizon_end_month: string;
  locked_at: string | null;
  updated_at: string;
  parent_fixed_version_id: string | null;
  base_close_id: string | null;
}

interface ProjectionPositionRow {
  month_key: string;
  bucket_key: string;
  closing_value: number | string | null;
}

interface CloseRow {
  close_year: number;
  close_month: number;
}

function normalizeToMonthKey(value: string, fieldName: string): string {
  const trimmed = value.trim();
  const monthMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (monthMatch) {
    return `${monthMatch[1]}-${monthMatch[2]}`;
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!dateMatch) {
    throw new Error(`Invalid ${fieldName} value: ${value}`);
  }

  return `${dateMatch[1]}-${dateMatch[2]}`;
}

function monthFromClose(close: CloseRow): string {
  return `${close.close_year}-${String(close.close_month).padStart(2, "0")}`;
}

export class ProjectionReadService {
  async getLatestLockedFixedProjection(): Promise<ProjectionViewerFixedPlanResult | null> {
    const { client, user } = await this.requireAuth();
    const plan = await this.getLatestLockedPlan(client, user.id, "FIXED");
    if (!plan) {
      return null;
    }

    const positionRows = await this.getMonthlyPositionRows(client, plan.id);

    return {
      plan,
      monthRows: groupMonthlyPositionRows(positionRows),
      monthSnapshots: groupMonthlyPositionSnapshots(positionRows),
    };
  }

  async getLatestLockedRollingProjection(): Promise<ProjectionViewerRollingPlanResult | null> {
    const { client, user } = await this.requireAuth();
    const plan = await this.getLatestLockedPlan(client, user.id, "ROLLING");
    if (!plan) {
      return null;
    }

    const [positionRows, linkedFixedVersionNo, rebasedFromMonth] = await Promise.all([
      this.getMonthlyPositionRows(client, plan.id),
      plan.parent_fixed_version_id ? this.getPlanVersionNoById(client, user.id, plan.parent_fixed_version_id) : Promise.resolve(null),
      plan.base_close_id ? this.getCloseMonthById(client, user.id, plan.base_close_id) : Promise.resolve(null),
    ]);

    return {
      plan,
      monthRows: groupMonthlyPositionRows(positionRows),
      monthSnapshots: groupMonthlyPositionSnapshots(positionRows),
      linkedFixedVersionNo,
      rebasedFromMonth,
    };
  }

  private async requireAuth() {
    const client = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      throw new Error("Authentication required.");
    }

    return { client, user };
  }

  private async getLatestLockedPlan(client: any, userId: string, planKind: "FIXED" | "ROLLING") {
    const { data, error } = await client
      .from("projection_plan_versions")
      .select("id, version_no, status, start_month, horizon_end_month, locked_at, updated_at, parent_fixed_version_id, base_close_id")
      .eq("user_id", userId)
      .eq("plan_kind", planKind)
      .eq("status", "LOCKED")
      .order("version_no", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const row = (data?.[0] as ProjectionPlanRow | undefined) ?? null;
    if (!row) {
      return null;
    }

    return {
      ...row,
      start_month: normalizeToMonthKey(row.start_month, "start_month"),
      horizon_end_month: normalizeToMonthKey(row.horizon_end_month, "horizon_end_month"),
    };
  }

  private async getMonthlyPositionRows(client: any, planVersionId: string): Promise<ProjectionPositionRow[]> {
    const { data, error } = await client
      .from("projection_monthly_positions")
      .select("month_key, bucket_key, closing_value, metadata")
      .eq("projection_plan_version_id", planVersionId)
      .in("bucket_key", VIEWER_BUCKET_KEYS)
      .order("month_key", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as ProjectionPositionRow[]).map((row) => ({
      ...row,
      month_key: normalizeToMonthKey(row.month_key, "month_key"),
    }));
  }

  private async getPlanVersionNoById(client: any, userId: string, planId: string): Promise<number | null> {
    const { data, error } = await client
      .from("projection_plan_versions")
      .select("version_no")
      .eq("id", planId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return typeof data?.version_no === "number" ? data.version_no : null;
  }

  private async getCloseMonthById(client: any, userId: string, closeId: string): Promise<string | null> {
    const { data, error } = await client
      .from("month_end_closes")
      .select("close_year, close_month")
      .eq("id", closeId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return monthFromClose(data as CloseRow);
  }
}

export function createProjectionReadServerService() {
  return new ProjectionReadService();
}
