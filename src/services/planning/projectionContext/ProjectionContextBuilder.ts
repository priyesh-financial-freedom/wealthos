import { ProjectionContextValidator } from "./ProjectionContextValidator";
import { buildDeterministicPlanningRunId, deepFreeze } from "../shared";
import type {
  ProjectionCashFlowScheduleItem,
  ProjectionContext,
  ProjectionContextBuildInput,
  ProjectionGoalScheduleItem,
  ProjectionRetirementScheduleItem,
  ProjectionTaxScheduleItem,
  ProjectionContextValidationIssue,
} from "./Types";

interface ProjectionContextBuilderDependencies {
  now?: () => Date;
  createRunId?: (input: ProjectionContextBuildInput) => string;
  validator?: ProjectionContextValidator;
}

function cloneArray<T>(items: readonly T[] | undefined): T[] {
  return (items ?? []).map((item) => ({ ...item }));
}

function toVersionString(value: unknown): string {
  if (value === null || value === undefined) {
    return "unknown";
  }

  const text = String(value).trim();
  return text.length > 0 ? text : "unknown";
}

function readVersion(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (!("version" in value)) {
    return undefined;
  }

  return (value as { version?: unknown }).version;
}

function derivePlanningInputVersion(input: ProjectionContextBuildInput): string {
  return Object.entries(input.planningInputs ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => {
      const version = readVersion(value);

      return `${key}:${toVersionString(version)}`;
    })
    .join(",");
}

function defaultRunId(input: ProjectionContextBuildInput): string {
  return buildDeterministicPlanningRunId({
    planningInputVersion: derivePlanningInputVersion(input),
    openingSnapshotVersion: toVersionString(input.openingBalanceSnapshot.version),
    scenarioId: toVersionString(input.scenario.id),
    projectionStart: input.projectionStartDate,
    projectionEnd: input.projectionEndDate,
  });
}

function cloneMonthlyLedger(input: ProjectionContextBuildInput): ProjectionContext["monthlyLedger"] {
  return (input.monthlyLedger ?? []).map((record) => ({ ...record }));
}

export class ProjectionContextBuilder {
  private readonly createRunId: (input: ProjectionContextBuildInput) => string;

  private readonly validator: ProjectionContextValidator;

  constructor(dependencies: ProjectionContextBuilderDependencies = {}) {
    void dependencies.now;
    this.createRunId = dependencies.createRunId ?? defaultRunId;
    this.validator = dependencies.validator ?? new ProjectionContextValidator();
  }

  build(input: ProjectionContextBuildInput): { context: ProjectionContext | null; issues: ProjectionContextValidationIssue[] } {
    const issues = this.validator.validate(input);
    if (issues.length > 0) {
      return { context: null, issues };
    }

    const context: ProjectionContext = {
      runId: input.runId ?? this.createRunId(input),
      planningInputs: { ...(input.planningInputs ?? {}) },
      openingBalanceSnapshot: { ...input.openingBalanceSnapshot },
      assumptions: {
        bundle: input.assumptions.bundle ? JSON.parse(JSON.stringify(input.assumptions.bundle)) : null,
        effective: input.assumptions.effective ? JSON.parse(JSON.stringify(input.assumptions.effective)) : null,
      },
      projectionStartDate: input.projectionStartDate,
      projectionEndDate: input.projectionEndDate,
      scenario: {
        ...input.scenario,
        assumptions: [...(input.scenario.assumptions ?? [])],
        events: [...(input.scenario.events ?? [])],
      },
      monthlyLedger: cloneMonthlyLedger(input),
      events: [...(input.events ?? [])],
      goalSchedule: cloneArray<ProjectionGoalScheduleItem>(input.goalSchedule),
      retirementSchedule: cloneArray<ProjectionRetirementScheduleItem>(input.retirementSchedule),
      taxSchedule: cloneArray<ProjectionTaxScheduleItem>(input.taxSchedule),
      cashFlowSchedule: cloneArray<ProjectionCashFlowScheduleItem>(input.cashFlowSchedule),
    };

    return {
      context: deepFreeze(context),
      issues: [],
    };
  }
}
