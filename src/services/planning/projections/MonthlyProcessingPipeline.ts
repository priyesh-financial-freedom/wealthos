import type { ProjectionContext } from "../projectionContext";
import { deepFreeze } from "../shared";

import type { ProjectionMonth } from "./ProjectionMonth";
import { ProjectionStateBuilder } from "./ProjectionStateBuilder";
import {
  ProjectionStateHistory,
} from "./ProjectionStateHistory";
import type { ProjectionState, ProjectionStatePatch, ProjectionStateSnapshot } from "./ProjectionState";
import { ProjectionStateValidator } from "./ProjectionStateValidator";
import type { SimulationTrace } from "./SimulationTrace";

export type MonthlyProcessingState = ProjectionState;

export interface MonthlyProcessorInput {
  projectionContext: ProjectionContext;
  currentMonth: ProjectionMonth;
  state: Readonly<ProjectionState>;
}

export interface MonthlyProcessorResult {
  state: ProjectionState;
  traces?: readonly SimulationTrace[];
}

export interface MonthlyProcessor {
  readonly name: string;
  process(input: MonthlyProcessorInput): MonthlyProcessorResult | Promise<MonthlyProcessorResult>;
}

export interface IncomeProcessor extends MonthlyProcessor {
  readonly name: "IncomeProcessor";
}

export interface ExpenseProcessor extends MonthlyProcessor {
  readonly name: "ExpenseProcessor";
}

export interface InvestmentContributionProcessor extends MonthlyProcessor {
  readonly name: "InvestmentContributionProcessor";
}

export interface InvestmentGrowthProcessor extends MonthlyProcessor {
  readonly name: "InvestmentGrowthProcessor";
}

export interface LoanProcessor extends MonthlyProcessor {
  readonly name: "LoanProcessor";
}

export interface GoalProcessor extends MonthlyProcessor {
  readonly name: "GoalProcessor";
}

export interface RetirementProcessor extends MonthlyProcessor {
  readonly name: "RetirementProcessor";
}

export interface TaxProcessor extends MonthlyProcessor {
  readonly name: "TaxProcessor";
}

export interface CashFlowProcessor extends MonthlyProcessor {
  readonly name: "CashFlowProcessor";
}

export interface NetWorthProcessor extends MonthlyProcessor {
  readonly name: "NetWorthProcessor";
}

export interface MonthlyProcessingProcessors {
  incomeProcessor: IncomeProcessor;
  expenseProcessor: ExpenseProcessor;
  investmentContributionProcessor: InvestmentContributionProcessor;
  investmentGrowthProcessor: InvestmentGrowthProcessor;
  loanProcessor: LoanProcessor;
  goalProcessor: GoalProcessor;
  retirementProcessor: RetirementProcessor;
  taxProcessor: TaxProcessor;
  cashFlowProcessor: CashFlowProcessor;
  netWorthProcessor: NetWorthProcessor;
}

export interface MonthlyProcessingPipelineDependencies {
  processors: MonthlyProcessingProcessors;
  stateBuilder?: ProjectionStateBuilder;
  stateValidator?: ProjectionStateValidator;
  now?: () => Date;
}

interface InternalPipelineStep {
  key: keyof MonthlyProcessingProcessors;
  processor: MonthlyProcessor;
}

const STEP_ORDER: ReadonlyArray<keyof MonthlyProcessingProcessors> = [
  "incomeProcessor",
  "expenseProcessor",
  "investmentContributionProcessor",
  "investmentGrowthProcessor",
  "loanProcessor",
  "goalProcessor",
  "retirementProcessor",
  "taxProcessor",
  "cashFlowProcessor",
  "netWorthProcessor",
] as const;

function defaultInitialStatePatch(currentMonth: ProjectionMonth): ProjectionStatePatch {
  return {
    retirement: currentMonth.retirementFlag ? 1 : 0,
  };
}

class IdentityProcessor implements MonthlyProcessor {
  constructor(readonly name: string) {}

  process(input: MonthlyProcessorInput): MonthlyProcessorResult {
    return {
      state: { ...input.state },
      traces: [],
    };
  }
}

export const identityIncomeProcessor: IncomeProcessor = new IdentityProcessor("IncomeProcessor") as IncomeProcessor;
export const identityExpenseProcessor: ExpenseProcessor = new IdentityProcessor("ExpenseProcessor") as ExpenseProcessor;
export const identityInvestmentContributionProcessor: InvestmentContributionProcessor = new IdentityProcessor("InvestmentContributionProcessor") as InvestmentContributionProcessor;
export const identityInvestmentGrowthProcessor: InvestmentGrowthProcessor = new IdentityProcessor("InvestmentGrowthProcessor") as InvestmentGrowthProcessor;
export const identityLoanProcessor: LoanProcessor = new IdentityProcessor("LoanProcessor") as LoanProcessor;
export const identityGoalProcessor: GoalProcessor = new IdentityProcessor("GoalProcessor") as GoalProcessor;
export const identityRetirementProcessor: RetirementProcessor = new IdentityProcessor("RetirementProcessor") as RetirementProcessor;
export const identityTaxProcessor: TaxProcessor = new IdentityProcessor("TaxProcessor") as TaxProcessor;
export const identityCashFlowProcessor: CashFlowProcessor = new IdentityProcessor("CashFlowProcessor") as CashFlowProcessor;
export const identityNetWorthProcessor: NetWorthProcessor = new IdentityProcessor("NetWorthProcessor") as NetWorthProcessor;

export function createDefaultMonthlyProcessingProcessors(): MonthlyProcessingProcessors {
  return {
    incomeProcessor: identityIncomeProcessor,
    expenseProcessor: identityExpenseProcessor,
    investmentContributionProcessor: identityInvestmentContributionProcessor,
    investmentGrowthProcessor: identityInvestmentGrowthProcessor,
    loanProcessor: identityLoanProcessor,
    goalProcessor: identityGoalProcessor,
    retirementProcessor: identityRetirementProcessor,
    taxProcessor: identityTaxProcessor,
    cashFlowProcessor: identityCashFlowProcessor,
    netWorthProcessor: identityNetWorthProcessor,
  };
}

export class MonthlyProcessingPipeline {
  private readonly steps: ReadonlyArray<InternalPipelineStep>;

  private readonly stateBuilder: ProjectionStateBuilder;

  private readonly stateValidator: ProjectionStateValidator;

  private readonly now: () => Date;

  constructor(dependencies: MonthlyProcessingPipelineDependencies) {
    this.steps = STEP_ORDER.map((key) => ({
      key,
      processor: dependencies.processors[key],
    }));
    this.stateBuilder = dependencies.stateBuilder ?? new ProjectionStateBuilder();
    this.stateValidator = dependencies.stateValidator ?? new ProjectionStateValidator();
    this.now = dependencies.now ?? (() => new Date());
  }

  private validateStateOrThrow(state: ProjectionState, stepName: string): void {
    const issues = this.stateValidator.validate(state);
    if (issues.length > 0) {
      throw new Error(`Processor ${stepName} returned invalid ProjectionState.`);
    }
  }

  async runMonth(input: {
    projectionContext: ProjectionContext;
    currentMonth: ProjectionMonth;
    initialState?: ProjectionState;
  }): Promise<ProjectionState> {
    const run = await this.runMonthWithHistory(input);
    return run.state;
  }

  async runMonthWithHistory(input: {
    projectionContext: ProjectionContext;
    currentMonth: ProjectionMonth;
    initialState?: ProjectionState;
  }): Promise<{ state: ProjectionState; history: ProjectionStateHistory; snapshots: readonly ProjectionStateSnapshot[] }> {
    const history = new ProjectionStateHistory({
      now: this.now,
      builder: this.stateBuilder,
      validator: this.stateValidator,
    });

    let currentState = input.initialState
      ? this.stateBuilder.clone(input.initialState)
      : this.stateBuilder.create(defaultInitialStatePatch(input.currentMonth));

    this.validateStateOrThrow(currentState, "InitialState");
    history.append({
      monthKey: input.currentMonth.monthKey,
      step: "InitialState",
      state: currentState,
      processor: "InitialState",
      rule: null,
    });

    for (const step of this.steps) {
      const result = await step.processor.process({
        projectionContext: input.projectionContext,
        currentMonth: input.currentMonth,
        state: this.stateBuilder.clone(currentState),
      });

      const nextState = this.stateBuilder.clone(result.state);

      this.validateStateOrThrow(nextState, step.processor.name);

      const primaryTrace = result.traces && result.traces.length > 0 ? result.traces[0] : null;
      history.append({
        monthKey: input.currentMonth.monthKey,
        step: step.processor.name,
        state: nextState,
        processor: step.processor.name,
        rule: primaryTrace?.ruleId ?? null,
        timestamp: primaryTrace?.timestamp,
      });

      currentState = nextState;
    }

    return {
      state: currentState,
      history,
      snapshots: history.list(),
    };
  }

  async runTimeline(input: {
    projectionContext: ProjectionContext;
    timeline: readonly ProjectionMonth[];
    initialState?: ProjectionState;
  }): Promise<readonly ProjectionStateSnapshot[]> {
    const snapshots: ProjectionStateSnapshot[] = [];
    let currentState = input.initialState ? this.stateBuilder.clone(input.initialState) : undefined;

    for (const currentMonth of input.timeline) {
      const result = await this.runMonthWithHistory({
        projectionContext: input.projectionContext,
        currentMonth,
        initialState: currentState,
      });
      snapshots.push(...result.snapshots);
      currentState = this.stateBuilder.clone(result.state);
    }

    return deepFreeze(snapshots.slice());
  }
}
