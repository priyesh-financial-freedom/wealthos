import type { MonthlyLedger, MonthlyLedgerEntry, MonthlySnapshot, ProjectedEntity, ProjectionBalanceState, ProjectionScenario } from "@/types/projection";

import { cloneProjectionState, createMonthlyLedgerRecord, finalizeProjectionRecord, type ProjectionContext, type ProjectionMonthState } from "./ProjectionContext";
import { buildProjectionRunResult, ProjectionPipeline } from "./ProjectionPipeline";
import { ExpenseStep } from "./steps/ExpenseStep";
import { GoalFundingStep } from "./steps/GoalFundingStep";
import { IncomeStep } from "./steps/IncomeStep";
import { InsuranceStep } from "./steps/InsuranceStep";
import { InvestmentStep } from "./steps/InvestmentStep";
import { LoanStep } from "./steps/LoanStep";
import { NetWorthStep } from "./steps/NetWorthStep";
import { TaxStep } from "./steps/TaxStep";

export interface ProjectionTimelinePoint {
  month: string;
  year: number;
}

export interface OpeningBalances {
  assets: number;
  liabilities: number;
  investments: number;
  retirement: number;
  cash: number;
  netWorth: number;
}

export interface ProjectionResult {
  scenario: ProjectionScenario;
  timeline: ProjectionTimelinePoint[];
  snapshots: MonthlySnapshot[];
  monthlyLedger: MonthlyLedger;
  netWorthCurve: Array<{ month: string; value: number }>;
  investmentCurve: Array<{ month: string; value: number }>;
  cashCurve: Array<{ month: string; value: number }>;
  loanCurve: Array<{ month: string; value: number }>;
  goalFundingSummary: ReturnType<typeof buildProjectionRunResult>["goalFundingSummary"];
  retirementReadiness: ReturnType<typeof buildProjectionRunResult>["retirementReadiness"];
}

function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths(year: number, month: number, offset = 1): { year: number; month: number } {
  const totalMonths = year * 12 + (month - 1) + offset;

  return {
    year: Math.floor(totalMonths / 12),
    month: (totalMonths % 12) + 1,
  };
}

function compareMonth(left: { year: number; month: number }, right: { year: number; month: number }) {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return left.month - right.month;
}

function roundCurrency(value: number): number {
  return Math.round((Number(value ?? 0) + Number.EPSILON) * 100) / 100;
}

function toProjectionBalanceState(record: MonthlyLedger[number], openingRetirementCorpus: number, phase: "opening" | "closing"): ProjectionBalanceState {
  if (phase === "opening") {
    return {
      assets: roundCurrency(record.openingAssets + record.openingCash),
      liabilities: roundCurrency(record.openingLiabilities),
      investments: roundCurrency(record.openingInvestments + openingRetirementCorpus),
      retirement: roundCurrency(openingRetirementCorpus),
      cash: roundCurrency(record.openingCash),
      netWorth: roundCurrency(record.openingCash + record.openingInvestments + record.openingAssets + openingRetirementCorpus - record.openingLiabilities),
    };
  }

  return {
    assets: roundCurrency(record.closingAssets + record.closingCash),
    liabilities: roundCurrency(record.closingLiabilities),
    investments: roundCurrency(record.closingInvestments + record.retirementCorpus),
    retirement: roundCurrency(record.retirementCorpus),
    cash: roundCurrency(record.closingCash),
    netWorth: roundCurrency(record.closingNetWorth),
  };
}

function buildProjectedEntities(record: MonthlyLedger[number], openingRetirementCorpus: number): ProjectedEntity[] {
  return [
    {
      id: `cash:${record.month}`,
      kind: "bank-account",
      name: "Cash & Bank",
      month: record.month,
      openingBalance: roundCurrency(record.openingCash),
      contributionActivity: roundCurrency(record.salary + record.bonus + record.rentalIncome + record.businessIncome + record.otherIncome),
      growthActivity: 0,
      otherActivity: roundCurrency(-(record.livingExpenses + record.insurancePremium + record.taxes + record.emis + record.goalFunding)),
      closingBalance: roundCurrency(record.closingCash),
      dimensions: { assets: true, liabilities: false, investments: false, retirement: false, cash: true },
    },
    {
      id: `investments:${record.month}`,
      kind: "mutual-fund",
      name: "Investments",
      month: record.month,
      openingBalance: roundCurrency(record.openingInvestments),
      contributionActivity: roundCurrency(Math.max(0, record.investmentContributions - Math.max(0, record.retirementCorpus - openingRetirementCorpus))),
      growthActivity: roundCurrency(record.investmentReturns),
      otherActivity: 0,
      closingBalance: roundCurrency(record.closingInvestments),
      dimensions: { assets: false, liabilities: false, investments: true, retirement: false, cash: false },
    },
    {
      id: `assets:${record.month}`,
      kind: "other-asset",
      name: "Assets",
      month: record.month,
      openingBalance: roundCurrency(record.openingAssets),
      contributionActivity: 0,
      growthActivity: 0,
      otherActivity: roundCurrency(record.closingAssets - record.openingAssets),
      closingBalance: roundCurrency(record.closingAssets),
      dimensions: { assets: true, liabilities: false, investments: false, retirement: false, cash: false },
    },
    {
      id: `liabilities:${record.month}`,
      kind: "other-liability",
      name: "Liabilities",
      month: record.month,
      openingBalance: roundCurrency(record.openingLiabilities),
      contributionActivity: 0,
      growthActivity: roundCurrency(record.loanInterest),
      otherActivity: roundCurrency(-record.loanPrincipal),
      closingBalance: roundCurrency(record.closingLiabilities),
      dimensions: { assets: false, liabilities: true, investments: false, retirement: false, cash: false },
    },
    {
      id: `retirement:${record.month}`,
      kind: "nps",
      name: "Retirement Corpus",
      month: record.month,
      openingBalance: roundCurrency(openingRetirementCorpus),
      contributionActivity: roundCurrency(Math.max(0, record.retirementCorpus - openingRetirementCorpus)),
      growthActivity: 0,
      otherActivity: 0,
      closingBalance: roundCurrency(record.retirementCorpus),
      dimensions: { assets: false, liabilities: false, investments: true, retirement: true, cash: false },
    },
  ];
}

function buildMonthlyLedgerEntries(record: MonthlyLedger[number]): MonthlyLedgerEntry[] {
  const entries: MonthlyLedgerEntry[] = [];
  const contributionAmount = roundCurrency(record.salary + record.bonus + record.rentalIncome + record.businessIncome + record.otherIncome);

  if (contributionAmount > 0) {
    entries.push({
      eventId: `income:${record.month}`,
      eventName: "Income",
      eventType: "monthly-contribution",
      module: "cash-flow",
      month: record.month,
      amount: contributionAmount,
      entryType: "contribution",
      source: "assumption",
      target: "cash",
    });
  }

  if (record.investmentReturns !== 0) {
    entries.push({
      eventId: `returns:${record.month}`,
      eventName: "Investment Returns",
      eventType: "stock-growth",
      module: "investments",
      month: record.month,
      amount: roundCurrency(record.investmentReturns),
      entryType: "growth",
      source: "assumption",
      target: "investments",
    });
  }

  return entries;
}

function buildSnapshotsFromLedger(scenario: ProjectionScenario, ledger: MonthlyLedger, openingState: ProjectionMonthState): MonthlySnapshot[] {
  const snapshots: MonthlySnapshot[] = [];
  let openingRetirementCorpus = roundCurrency(openingState.retirementCorpus);

  for (const record of ledger) {
    const openingBalances = toProjectionBalanceState(record, openingRetirementCorpus, "opening");
    const closingBalances = toProjectionBalanceState(record, openingRetirementCorpus, "closing");
    const snapshot: MonthlySnapshot = {
      id: `${scenario.id}:${record.month}`,
      scenarioId: scenario.id,
      month: record.month,
      openingBalance: openingBalances.netWorth,
      closingBalance: closingBalances.netWorth,
      contributions: roundCurrency(record.salary + record.bonus + record.rentalIncome + record.businessIncome + record.otherIncome + record.investmentContributions),
      growth: roundCurrency(record.investmentReturns),
      loanPrincipalReduction: roundCurrency(record.loanPrincipal),
      goalFunding: roundCurrency(record.goalFunding),
      inflationImpact: 0,
      eventsApplied: [],
      monthlyLedger: buildMonthlyLedgerEntries(record),
      projectedEntities: buildProjectedEntities(record, openingRetirementCorpus),
      openingBalances,
      closingBalances,
    };

    snapshots.push(snapshot);
    openingRetirementCorpus = roundCurrency(record.retirementCorpus);
  }

  return snapshots;
}

export class ProjectionEngine {
  private projectedSnapshots: MonthlySnapshot[] = [];

  private readonly pipeline = new ProjectionPipeline([
    new IncomeStep(),
    new ExpenseStep(),
    new InsuranceStep(),
    new LoanStep(),
    new InvestmentStep(),
    new TaxStep(),
    new GoalFundingStep(),
    new NetWorthStep(),
  ]);

  generateTimeline(scenario: ProjectionScenario): ProjectionTimelinePoint[] {
    return this.buildTimelineRange(scenario.startMonth, scenario.planningHorizonYear, 12);
  }

  private buildTimelineRange(startMonth: string, planningHorizonYear: number, planningHorizonMonth: number): ProjectionTimelinePoint[] {
    const start = parseMonthKey(startMonth);
    const end = { year: planningHorizonYear, month: planningHorizonMonth };

    if (compareMonth(start, end) > 0) {
      return [];
    }

    const timeline: ProjectionTimelinePoint[] = [];
    let cursor = start;

    while (compareMonth(cursor, end) <= 0) {
      timeline.push({
        month: formatMonthKey(cursor.year, cursor.month),
        year: cursor.year,
      });

      cursor = addMonths(cursor.year, cursor.month);
    }

    return timeline;
  }

  getProjectedSnapshots(): MonthlySnapshot[] {
    return [...this.projectedSnapshots];
  }

  clearProjectedSnapshots(): void {
    this.projectedSnapshots = [];
  }

  async run(context: ProjectionContext): Promise<ProjectionResult> {
    const timeline = this.buildTimelineRange(context.projectionStartDate, context.planningHorizon.endYear, context.planningHorizon.endMonth);
    const openingState = cloneProjectionState(context.currentState);
    const primaryMemberAge = context.familyMembers.find((member) => member.relationship === "self")?.currentAge ?? null;
    const openingAge = Number(primaryMemberAge ?? context.currentRecord.age ?? context.effectiveAssumptions.currentAge ?? 0);
    let rollingState = cloneProjectionState(openingState);
    let mutableLedger = context.monthlyLedger;

    for (const [index, month] of timeline.entries()) {
      const monthContext: ProjectionContext = {
        ...context,
        currentMonth: month.month,
        monthIndex: index,
        currentState: cloneProjectionState(rollingState),
        currentRecord: createMonthlyLedgerRecord(month.month, openingAge + index / 12, rollingState),
        monthlyLedger: mutableLedger,
      };

      const executedContext = await this.pipeline.execute(monthContext);
      const finalizedRecord = finalizeProjectionRecord(executedContext.currentRecord);
      mutableLedger = [...mutableLedger, finalizedRecord];
      rollingState = {
        cash: finalizedRecord.closingCash,
        investments: finalizedRecord.closingInvestments,
        assets: finalizedRecord.closingAssets,
        liabilities: finalizedRecord.closingLiabilities,
        retirementCorpus: finalizedRecord.retirementCorpus,
      };
    }

    const result = buildProjectionRunResult(mutableLedger, context.goals.length);
    const snapshots = buildSnapshotsFromLedger(context.scenario, result.monthlyLedger, openingState);

    this.projectedSnapshots = snapshots;

    return {
      scenario: context.scenario,
      timeline,
      snapshots,
      monthlyLedger: result.monthlyLedger,
      netWorthCurve: result.netWorthCurve,
      investmentCurve: result.investmentCurve,
      cashCurve: result.cashCurve,
      loanCurve: result.loanCurve,
      goalFundingSummary: result.goalFundingSummary,
      retirementReadiness: result.retirementReadiness,
    };
  }
}

export const projectionEngine = new ProjectionEngine();