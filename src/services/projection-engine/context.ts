import { addMonths } from "./calendar";
import type {
  ActualMonthlyData,
  AssetPosition,
  ContributionRule,
  ExpenseCategory,
  GrowthRule,
  IncomeSource,
  LiabilityPosition,
  ProjectionContext,
  ProjectionEvent,
  ProjectionVersion,
} from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }

  return value;
}

function cloneArray<T extends object>(items: readonly T[]): T[] {
  return items.map((item) => ({ ...item }));
}

function normalizeVersion(version: ProjectionVersion): ProjectionVersion {
  return {
    id: version.id,
    kind: version.kind,
    name: version.name,
  };
}

export function createProjectionContext(input: ProjectionContext): ProjectionContext {
  const normalized: ProjectionContext = {
    financialPlan: { ...input.financialPlan },
    projectionVersion: normalizeVersion(input.projectionVersion),
    projectionPeriod: { ...input.projectionPeriod },
    currentProcessingMonth: input.currentProcessingMonth,
    assumptions: {
      ...input.assumptions,
      loans: input.assumptions.loans.map((loan) => ({ ...loan })),
    },
    openingBalances: { ...input.openingBalances },
    assets: cloneArray<AssetPosition>(input.assets),
    liabilities: cloneArray<LiabilityPosition>(input.liabilities),
    incomeSources: cloneArray<IncomeSource>(input.incomeSources),
    expenseCategories: cloneArray<ExpenseCategory>(input.expenseCategories),
    contributionRules: cloneArray<ContributionRule>(input.contributionRules),
    growthRules: cloneArray<GrowthRule>(input.growthRules),
    events: cloneArray<ProjectionEvent>(input.events),
    actualMonthlyData: cloneArray<ActualMonthlyData>(input.actualMonthlyData),
  };

  return deepFreeze(normalized);
}

export function monthKeyForContextIndex(context: ProjectionContext, monthIndex: number): string {
  return addMonths(context.projectionPeriod.startMonthKey, monthIndex);
}