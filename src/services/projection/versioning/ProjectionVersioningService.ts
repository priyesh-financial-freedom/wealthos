import { ProjectionVersioningRepository } from "./ProjectionVersioningRepository";
import type {
  CreateProjectionAssumptionSnapshotInput,
  CreateProjectionPlanVersionInput,
  CreateProjectionRebaseJournalInput,
  ProjectionMonthlyPositionRecord,
  ProjectionPlanVersionRecord,
  ProjectionRebaseJournalRecord,
  ProjectionSalaryCurveRecord,
  UpsertProjectionMonthlyPositionInput,
  UpsertProjectionSalaryCurveInput,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function monthKeyToDate(monthKey: string): string {
  const trimmed = monthKey.trim();
  const match = MONTH_KEY_PATTERN.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid month key \"${monthKey}\". Expected YYYY-MM.`);
  }

  const month = Number(match[2]);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key \"${monthKey}\". Expected YYYY-MM.`);
  }

  return `${match[1]}-${match[2]}-01`;
}

function dateToMonthKey(dateOrMonthKey: string, fieldName: string): string {
  const trimmed = dateOrMonthKey.trim();
  const monthMatch = MONTH_KEY_PATTERN.exec(trimmed);
  if (monthMatch) {
    return `${monthMatch[1]}-${monthMatch[2]}`;
  }

  const dateMatch = DATE_PATTERN.exec(trimmed);
  if (!dateMatch) {
    throw new Error(`Invalid ${fieldName} value \"${dateOrMonthKey}\". Expected YYYY-MM or YYYY-MM-DD.`);
  }

  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Invalid ${fieldName} value \"${dateOrMonthKey}\". Expected YYYY-MM or YYYY-MM-DD.`);
  }

  return `${dateMatch[1]}-${dateMatch[2]}`;
}

function normalizePlanMonths(plan: ProjectionPlanVersionRecord): ProjectionPlanVersionRecord {
  return {
    ...plan,
    start_month: dateToMonthKey(plan.start_month, "start_month"),
    horizon_end_month: dateToMonthKey(plan.horizon_end_month, "horizon_end_month"),
  };
}

function normalizeSalaryCurveMonths(rows: ProjectionSalaryCurveRecord[]): ProjectionSalaryCurveRecord[] {
  return rows.map((row) => ({
    ...row,
    month_key: dateToMonthKey(row.month_key, "month_key"),
  }));
}

function normalizeMonthlyPositionMonths(rows: ProjectionMonthlyPositionRecord[]): ProjectionMonthlyPositionRecord[] {
  return rows.map((row) => ({
    ...row,
    month_key: dateToMonthKey(row.month_key, "month_key"),
  }));
}

function normalizeRebasedMonth(record: ProjectionRebaseJournalRecord): ProjectionRebaseJournalRecord {
  return {
    ...record,
    rebased_month: dateToMonthKey(record.rebased_month, "rebased_month"),
  };
}

export class ProjectionVersioningService {
  constructor(private readonly repository = new ProjectionVersioningRepository()) {}

  async createPlanVersion(input: CreateProjectionPlanVersionInput) {
    const created = await this.repository.createPlanVersion({
      ...input,
      start_month: monthKeyToDate(input.start_month),
      horizon_end_month: monthKeyToDate(input.horizon_end_month),
    });

    return normalizePlanMonths(created);
  }

  async lockPlanVersion(id: string): Promise<ProjectionPlanVersionRecord> {
    const plan = await this.repository.getPlanVersionById(id);
    if (!plan) {
      throw new Error("Projection plan version not found.");
    }

    const normalizedPlan = normalizePlanMonths(plan);

    if (normalizedPlan.status === "LOCKED") {
      return normalizedPlan;
    }

    const updated = await this.repository.updatePlanStatus(id, "LOCKED", nowIso());
    return normalizePlanMonths(updated);
  }

  async archivePlanVersion(id: string): Promise<ProjectionPlanVersionRecord> {
    const plan = await this.repository.getPlanVersionById(id);
    if (!plan) {
      throw new Error("Projection plan version not found.");
    }

    const updated = await this.repository.updatePlanStatus(id, "ARCHIVED", plan.locked_at);
    return normalizePlanMonths(updated);
  }

  async upsertAssumptionSnapshot(input: CreateProjectionAssumptionSnapshotInput) {
    await this.assertMutableForWrite(input.projection_plan_version_id);
    return this.repository.upsertAssumptionSnapshot(input);
  }

  async upsertSalaryCurve(rows: UpsertProjectionSalaryCurveInput[]) {
    if (rows.length === 0) {
      return [];
    }

    await this.assertMutableForWrite(rows[0].projection_plan_version_id);
    const persisted = await this.repository.upsertSalaryCurve(
      rows.map((row) => ({
        ...row,
        month_key: monthKeyToDate(row.month_key),
      })),
    );

    return normalizeSalaryCurveMonths(persisted);
  }

  async upsertMonthlyPositions(rows: UpsertProjectionMonthlyPositionInput[]) {
    if (rows.length === 0) {
      return [];
    }

    await this.assertMutableForWrite(rows[0].projection_plan_version_id);
    const persisted = await this.repository.upsertMonthlyPositions(
      rows.map((row) => ({
        ...row,
        month_key: monthKeyToDate(row.month_key),
      })),
    );

    return normalizeMonthlyPositionMonths(persisted);
  }

  async appendRebaseJournal(input: CreateProjectionRebaseJournalInput) {
    const appended = await this.repository.appendRebaseJournal({
      ...input,
      rebased_month: monthKeyToDate(input.rebased_month),
    });

    return normalizeRebasedMonth(appended);
  }

  private async assertMutableForWrite(planVersionId: string): Promise<void> {
    const plan = await this.repository.getPlanVersionById(planVersionId);
    if (!plan) {
      throw new Error("Projection plan version not found.");
    }

    // Treat locked fixed plans as immutable at service layer in phase 0.
    // TODO(phase-2): add database-level immutability triggers for LOCKED FIXED plans.
    if (plan.plan_kind === "FIXED" && plan.status === "LOCKED") {
      throw new Error("LOCKED FIXED projection plans are immutable.");
    }
  }
}

export const projectionVersioningService = new ProjectionVersioningService();
