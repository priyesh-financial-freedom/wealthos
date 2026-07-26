import type { ProjectionState, ProjectionStateSnapshot } from "./ProjectionState";

export interface ProjectionStateValidationIssue {
  field: string;
  message: string;
}

const STATE_FIELDS: Array<keyof ProjectionState> = [
  "cash",
  "assets",
  "liabilities",
  "investments",
  "retirement",
  "emergencyFund",
  "loanOutstanding",
  "income",
  "expenses",
  "tax",
  "goalFunding",
  "netWorth",
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export class ProjectionStateValidator {
  validate(state: ProjectionState): ProjectionStateValidationIssue[] {
    const issues: ProjectionStateValidationIssue[] = [];

    for (const field of STATE_FIELDS) {
      const value = state[field];
      if (!isFiniteNumber(value)) {
        issues.push({
          field,
          message: "Expected a finite numeric value.",
        });
      }
    }

    return issues;
  }

  validateSnapshot(snapshot: ProjectionStateSnapshot): ProjectionStateValidationIssue[] {
    const issues = this.validate(snapshot);

    if (!snapshot.monthKey || typeof snapshot.monthKey !== "string") {
      issues.push({ field: "monthKey", message: "Snapshot monthKey is required." });
    }

    if (!snapshot.step || typeof snapshot.step !== "string") {
      issues.push({ field: "step", message: "Snapshot step is required." });
    }

    if (!Number.isInteger(snapshot.index) || snapshot.index < 0) {
      issues.push({ field: "index", message: "Snapshot index must be a non-negative integer." });
    }

    if (!snapshot.recordedAt || Number.isNaN(new Date(snapshot.recordedAt).getTime())) {
      issues.push({ field: "recordedAt", message: "Snapshot recordedAt must be a valid ISO datetime." });
    }

    return issues;
  }
}

export const projectionStateValidator = new ProjectionStateValidator();
