import { buildMonthlyAssumptions, normalizeAssumptions } from "./assumptions";
import {
  createDefaultFinancialRuleRegistry,
} from "./rules/defaultRegistry";
import { FinancialRuleRegistry } from "./rules/registry";
import { MonthlyProjectionDomainState } from "./rules/state";
import type {
  LoanState,
  MonthlyPipelineStep,
  MonthlyProjection,
  ProjectionBalances,
  ProjectionContext,
  ProjectionMonthState,
} from "./types";

export const MONTHLY_CALCULATION_PIPELINE: readonly MonthlyPipelineStep[] = [
  "opening-balances",
  "income",
  "expenses",
  "events",
  "investment-contributions",
  "investment-growth",
  "loan-processing",
  "asset-appreciation",
  "closing-balances",
  "monthly-projection",
] as const;

export interface MonthlyPipelineInput {
  context: ProjectionContext;
  monthKey: string;
  monthIndex: number;
  state: ProjectionMonthState;
  opening: ProjectionBalances;
  loans: LoanState[];
  ruleRegistry?: FinancialRuleRegistry;
}

export interface MonthlyPipelineOutput {
  projection: MonthlyProjection;
  nextOpening: ProjectionBalances;
  nextLoans: LoanState[];
}

function toFiniteNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function normalizeBalances(input: ProjectionBalances): ProjectionBalances {
  const cash = toFiniteNumber(input.cash);
  const investments = toFiniteNumber(input.investments);
  const loanOutstanding = Math.max(0, toFiniteNumber(input.loanOutstanding));
  const liabilities = Math.max(0, toFiniteNumber(input.liabilities));
  const computedLiabilities = Math.max(liabilities, loanOutstanding);
  const assets = Math.max(0, toFiniteNumber(input.assets));
  const computedAssets = Math.max(assets, cash + investments);

  return {
    cash,
    investments,
    assets: computedAssets,
    liabilities: computedLiabilities,
    loanOutstanding,
    netWorth: computedAssets - computedLiabilities,
  };
}

function nonInvestmentAssetBase(input: { opening: ProjectionBalances; context: ProjectionContext }): number {
  const fromBalances = Math.max(0, input.opening.assets - input.opening.cash - input.opening.investments);
  if (fromBalances > 0) {
    return fromBalances;
  }

  return input.context.assets.reduce((sum, asset) => sum + Math.max(0, toFiniteNumber(asset.currentValue)), 0);
}

function eventAssetDelta(context: ProjectionContext, monthKey: string): number {
  return context.events
    .filter((event) => event.enabled && event.startMonth === monthKey)
    .reduce((sum, event) => {
      if (event.category === "Asset Purchase" || event.category === "Property Purchase") {
        return sum + Math.max(0, toFiniteNumber(event.amount));
      }

      if (event.category === "Asset Sale" || event.category === "Property Sale") {
        return sum - Math.max(0, toFiniteNumber(event.amount));
      }

      return sum;
    }, 0);
}

export function runMonthlyPipeline(input: MonthlyPipelineInput): MonthlyPipelineOutput {
  const opening = normalizeBalances(input.opening);
  const assumptions = normalizeAssumptions(input.context.assumptions);
  const monthlyAssumptions = buildMonthlyAssumptions(assumptions, input.monthIndex);

  const registry = input.ruleRegistry ?? createDefaultFinancialRuleRegistry();
  const domainState = new MonthlyProjectionDomainState(opening, input.loans);

  registry.execute({
    context: input.context,
    monthKey: input.monthKey,
    monthIndex: input.monthIndex,
    state: domainState,
  });

  const snapshot = domainState.snapshot({
    assetBaseNonInvestment: nonInvestmentAssetBase({ opening, context: input.context }),
    eventAssetDelta: eventAssetDelta(input.context, input.monthKey),
  });

  const projection: MonthlyProjection = {
    projectionVersion: input.context.projectionVersion,
    monthKey: input.monthKey,
    monthIndex: input.monthIndex,
    state: input.state,
    pipeline: MONTHLY_CALCULATION_PIPELINE,
    opening: snapshot.opening,
    activity: snapshot.activity,
    closing: normalizeBalances(snapshot.closing),
    assumptions: monthlyAssumptions,
    loans: snapshot.loans,
    metadata: snapshot.notes.length > 0 ? { appliedRules: snapshot.notes } : undefined,
  };

  return {
    projection,
    nextOpening: projection.closing,
    nextLoans: projection.loans,
  };
}
