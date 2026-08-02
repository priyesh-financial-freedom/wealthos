import { ProjectionVersioningRepository } from "./ProjectionVersioningRepository";
import type {
  CreateProjectionAssumptionSnapshotInput,
  CreateProjectionPlanVersionInput,
  CreateProjectionRebaseJournalInput,
  ProjectionPlanVersionRecord,
  UpsertProjectionMonthlyPositionInput,
  UpsertProjectionSalaryCurveInput,
} from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

export class ProjectionVersioningService {
  constructor(private readonly repository = new ProjectionVersioningRepository()) {}

  async createPlanVersion(input: CreateProjectionPlanVersionInput) {
    return this.repository.createPlanVersion(input);
  }

  async lockPlanVersion(id: string): Promise<ProjectionPlanVersionRecord> {
    const plan = await this.repository.getPlanVersionById(id);
    if (!plan) {
      throw new Error("Projection plan version not found.");
    }

    if (plan.status === "LOCKED") {
      return plan;
    }

    return this.repository.updatePlanStatus(id, "LOCKED", nowIso());
  }

  async archivePlanVersion(id: string): Promise<ProjectionPlanVersionRecord> {
    const plan = await this.repository.getPlanVersionById(id);
    if (!plan) {
      throw new Error("Projection plan version not found.");
    }

    return this.repository.updatePlanStatus(id, "ARCHIVED", plan.locked_at);
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
    return this.repository.upsertSalaryCurve(rows);
  }

  async upsertMonthlyPositions(rows: UpsertProjectionMonthlyPositionInput[]) {
    if (rows.length === 0) {
      return [];
    }

    await this.assertMutableForWrite(rows[0].projection_plan_version_id);
    return this.repository.upsertMonthlyPositions(rows);
  }

  async appendRebaseJournal(input: CreateProjectionRebaseJournalInput) {
    return this.repository.appendRebaseJournal(input);
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
