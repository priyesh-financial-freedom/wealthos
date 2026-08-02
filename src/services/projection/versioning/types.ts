export type ProjectionPlanKind = "FIXED" | "ROLLING" | "WHAT_IF";

export type ProjectionPlanStatus = "DRAFT" | "LOCKED" | "ARCHIVED";

export type SalaryCurveSource = "FIXED_LOCKED" | "ROLLING_REBASE";

export interface ProjectionPlanVersionRecord {
  id: string;
  user_id: string;
  household_id: string | null;
  plan_kind: ProjectionPlanKind;
  version_no: number;
  status: ProjectionPlanStatus;
  start_month: string;
  horizon_end_month: string;
  base_close_id: string | null;
  parent_fixed_version_id: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectionAssumptionSnapshotRecord {
  id: string;
  projection_plan_version_id: string;
  assumption_payload: Record<string, unknown>;
  salary_policy_payload: Record<string, unknown>;
  retirement_policy_payload: Record<string, unknown>;
  drawdown_policy_payload: Record<string, unknown>;
  checksum: string | null;
  created_at: string;
}

export interface ProjectionSalaryCurveRecord {
  id: string;
  projection_plan_version_id: string;
  month_key: string;
  gross_salary: number;
  basic_salary: number;
  salary_growth_rate_used: number;
  source: SalaryCurveSource;
  created_at: string;
}

export interface ProjectionMonthlyPositionRecord {
  id: string;
  projection_plan_version_id: string;
  month_key: string;
  bucket_key: string;
  opening_value: number;
  contribution: number;
  growth: number;
  withdrawal: number;
  closing_value: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProjectionRebaseJournalRecord {
  id: string;
  rolling_version_id: string;
  parent_fixed_version_id: string;
  rebased_from_close_id: string;
  rebased_month: string;
  prior_rolling_version_id: string | null;
  created_at: string;
}

export interface CreateProjectionPlanVersionInput {
  household_id?: string | null;
  plan_kind: ProjectionPlanKind;
  version_no: number;
  status?: ProjectionPlanStatus;
  start_month: string;
  horizon_end_month: string;
  base_close_id?: string | null;
  parent_fixed_version_id?: string | null;
  locked_at?: string | null;
}

export interface CreateProjectionAssumptionSnapshotInput {
  projection_plan_version_id: string;
  assumption_payload: Record<string, unknown>;
  salary_policy_payload: Record<string, unknown>;
  retirement_policy_payload: Record<string, unknown>;
  drawdown_policy_payload: Record<string, unknown>;
  checksum?: string | null;
}

export interface UpsertProjectionSalaryCurveInput {
  projection_plan_version_id: string;
  month_key: string;
  gross_salary: number;
  basic_salary: number;
  salary_growth_rate_used: number;
  source: SalaryCurveSource;
}

export interface UpsertProjectionMonthlyPositionInput {
  projection_plan_version_id: string;
  month_key: string;
  bucket_key: string;
  opening_value: number;
  contribution: number;
  growth: number;
  withdrawal: number;
  closing_value: number;
  metadata?: Record<string, unknown>;
}

export interface CreateProjectionRebaseJournalInput {
  rolling_version_id: string;
  parent_fixed_version_id: string;
  rebased_from_close_id: string;
  rebased_month: string;
  prior_rolling_version_id?: string | null;
}
