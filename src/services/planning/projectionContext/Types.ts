import type { AssumptionsBundle } from "@/types/assumptions";
import type { FinancialEvent, MonthlyLedger, ProjectionScenario } from "@/types/projection";

import type { EffectivePlanningAssumptions } from "../assumptions/AssumptionTypes";
import type { PlanningInputEntity, PlanningInputEntityName } from "../inputs/Types";
import type { OpeningBalanceSnapshot } from "../openingBalance/OpeningBalanceSnapshot";

export const PROJECTION_CONTEXT_MODULE_KEY = "projectionContext" as const;

export type ProjectionContextModuleKey = typeof PROJECTION_CONTEXT_MODULE_KEY;

export type ProjectionPlanningInputs = Partial<Record<PlanningInputEntityName, PlanningInputEntity>>;

export interface ProjectionGoalScheduleItem {
  goalId: string;
  month: string;
  amount: number;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export interface ProjectionRetirementScheduleItem {
  month: string;
  contribution: number;
  withdrawal: number;
  targetCorpus: number;
}

export interface ProjectionTaxScheduleItem {
  month: string;
  estimatedTax: number;
  effectiveTaxRate: number;
}

export interface ProjectionCashFlowScheduleItem {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface ProjectionAssumptionsState {
  bundle: AssumptionsBundle | null;
  effective: EffectivePlanningAssumptions | null;
}

export interface ProjectionContext {
  runId: string;
  planningInputs: ProjectionPlanningInputs;
  openingBalanceSnapshot: OpeningBalanceSnapshot;
  assumptions: ProjectionAssumptionsState;
  projectionStartDate: string;
  projectionEndDate: string;
  scenario: ProjectionScenario;
  monthlyLedger: MonthlyLedger;
  events: readonly FinancialEvent[];
  goalSchedule: readonly ProjectionGoalScheduleItem[];
  retirementSchedule: readonly ProjectionRetirementScheduleItem[];
  taxSchedule: readonly ProjectionTaxScheduleItem[];
  cashFlowSchedule: readonly ProjectionCashFlowScheduleItem[];
}

export interface ProjectionContextBuildInput {
  runId?: string;
  planningInputs?: ProjectionPlanningInputs;
  openingBalanceSnapshot: OpeningBalanceSnapshot;
  assumptions: ProjectionAssumptionsState;
  projectionStartDate: string;
  projectionEndDate: string;
  scenario: ProjectionScenario;
  monthlyLedger?: MonthlyLedger;
  events?: readonly FinancialEvent[];
  goalSchedule?: readonly ProjectionGoalScheduleItem[];
  retirementSchedule?: readonly ProjectionRetirementScheduleItem[];
  taxSchedule?: readonly ProjectionTaxScheduleItem[];
  cashFlowSchedule?: readonly ProjectionCashFlowScheduleItem[];
}

export interface ProjectionContextValidationIssue {
  field: string;
  message: string;
}

export interface ProjectionContextSerialized {
  runId: string;
  planningInputs: ProjectionPlanningInputs;
  openingBalanceSnapshot: OpeningBalanceSnapshot;
  assumptions: ProjectionAssumptionsState;
  projectionStartDate: string;
  projectionEndDate: string;
  scenario: ProjectionScenario;
  monthlyLedger: MonthlyLedger;
  events: FinancialEvent[];
  goalSchedule: ProjectionGoalScheduleItem[];
  retirementSchedule: ProjectionRetirementScheduleItem[];
  taxSchedule: ProjectionTaxScheduleItem[];
  cashFlowSchedule: ProjectionCashFlowScheduleItem[];
}
