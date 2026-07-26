import type { ProjectionContextBuildInput, ProjectionContextValidationIssue } from "./Types";

function isValidIsoDate(dateValue: string): boolean {
  if (!dateValue || Number.isNaN(Date.parse(dateValue))) {
    return false;
  }

  return /^\d{4}-\d{2}-\d{2}/.test(dateValue);
}

export class ProjectionContextValidator {
  validate(input: ProjectionContextBuildInput): ProjectionContextValidationIssue[] {
    const issues: ProjectionContextValidationIssue[] = [];

    if (!input.openingBalanceSnapshot) {
      issues.push({ field: "openingBalanceSnapshot", message: "Opening balance snapshot is required." });
    }

    if (!input.assumptions) {
      issues.push({ field: "assumptions", message: "Assumptions are required." });
    }

    if (!input.scenario?.id) {
      issues.push({ field: "scenario.id", message: "Scenario id is required." });
    }

    if (!input.scenario?.name) {
      issues.push({ field: "scenario.name", message: "Scenario name is required." });
    }

    if (!isValidIsoDate(input.projectionStartDate)) {
      issues.push({ field: "projectionStartDate", message: "Projection start date must be an ISO date string." });
    }

    if (!isValidIsoDate(input.projectionEndDate)) {
      issues.push({ field: "projectionEndDate", message: "Projection end date must be an ISO date string." });
    }

    const start = Date.parse(input.projectionStartDate);
    const end = Date.parse(input.projectionEndDate);
    if (!Number.isNaN(start) && !Number.isNaN(end) && start > end) {
      issues.push({ field: "projectionStartDate", message: "Projection start date must be less than or equal to projection end date." });
    }

    return issues;
  }
}
