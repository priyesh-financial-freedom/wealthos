export type ProjectionMonthKey = `${number}-${string}`;

export type ProjectionEventCategory = "goal" | "loan" | "investment";

export interface ProjectionTimelineEvent {
  id: string;
  category: ProjectionEventCategory;
  monthKey: ProjectionMonthKey;
  name?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProjectionMonth {
  monthNumber: number;
  year: number;
  month: number;
  monthKey: ProjectionMonthKey;
  financialYear: string;
  age: number | null;
  retirementFlag: boolean;
  workingFlag: boolean;
  inflationIndex: number | null;
  salaryIncrementMonth: boolean;
  bonusMonth: boolean;
  taxYear: string;
  goalEvents: readonly ProjectionTimelineEvent[];
  loanEvents: readonly ProjectionTimelineEvent[];
  investmentEvents: readonly ProjectionTimelineEvent[];
}

export interface TimelineGenerationOptions {
  ageAtProjectionStart?: number | null;
  retirementAge?: number | null;
  retirementStartDate?: string | null;
  financialYearStartMonth?: number;
  taxYearStartMonth?: number;
  salaryIncrementMonthNumber?: number | null;
  bonusMonthNumber?: number | null;
  defaultInflationIndex?: number | null;
  inflationIndexResolver?: (input: { monthKey: ProjectionMonthKey; monthNumber: number; year: number; month: number }) => number | null;
  goalEventResolver?: (month: { monthKey: ProjectionMonthKey; monthNumber: number; year: number; month: number }) => readonly ProjectionTimelineEvent[];
  loanEventResolver?: (month: { monthKey: ProjectionMonthKey; monthNumber: number; year: number; month: number }) => readonly ProjectionTimelineEvent[];
  investmentEventResolver?: (month: { monthKey: ProjectionMonthKey; monthNumber: number; year: number; month: number }) => readonly ProjectionTimelineEvent[];
}

export interface TimelineGenerationInput {
  projectionStartDate: string;
  projectionEndDate: string;
  options?: TimelineGenerationOptions;
}

export interface TimelineValidationIssue {
  field: string;
  message: string;
}
