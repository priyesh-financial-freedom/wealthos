import { DEFAULT_SCENARIO_KEY, assumptionsService } from "@/services/assumptions";
import { buildCashFlowSummary, cashFlowManagementService } from "@/services/cashFlowManagement";
import { compensationService } from "@/services/compensation";
import { getBalanceSheetData } from "@/services/balanceSheet";
import { buildAssetSummaryFromAssets } from "@/services/assetManagement";
import { buildExecutiveInsights, buildFinancialHealthScore } from "@/services/finance";
import { buildInvestmentSummary } from "@/services/investments";
import { isManagedLoanType } from "@/services/loanManagement";
import { inspectFinancialPositionRows, liabilityDomainService } from "@/domain/services/LiabilityDomainService";
import { logFinancialPositionValidation } from "@/domain/services/FinancialPositionValidationReporter";
import { goalService } from "@/services/planning/goals";
import { createPlanningScenarioProductionSimulationEngine } from "@/services/planning/scenarios";
import { monthlyReviewService, projectionEngine, projectionInputService } from "@/services/projection";
import { projectionEventsService } from "@/services/projection/events";
import { getRetirementSummary } from "@/services/retirement";
import { decisionEngine } from "@/services/decision";
import { healthScoreService } from "@/services/health";
import { buildDashboardRecommendations } from "@/services/insights/recommendationEngine";
import { snapshotReadModel } from "@/services/snapshots";
import {
  buildAllocationDriftRows,
  buildFinancialHealthBreakdown,
  buildGoalHeatmapRows,
  classifyRetirementReadinessStatus,
  type AllocationDriftRow,
  type FinancialHealthComponentRow,
  type GoalHeatmapRow,
  type RetirementReadinessStatus,
} from "./ExecutiveDashboardMetrics";
import type { SimulationResult } from "@/services/simulation";
import type { ProjectionScenario } from "@/types/projection";
import type { Liability } from "@/types/liability";

export interface ExecutiveGoalProgressItem {
  id: string;
  name: string;
  progressPercent: number;
  targetAmount: number;
  gap: number;
}

export interface ExecutiveDashboardData {
  asOfLabel: string;
  emptyState: boolean;
  executiveSummary: {
    netWorth: number;
    assets: number;
    liabilities: number;
    monthlySavings: number;
    plannedNetWorth: number | null;
    netWorthVariance: number | null;
    topContributors: Array<{
      label: string;
      value: number;
      type: "asset" | "liability";
    }>;
    lastMonthlyReview: string | null;
  };
  investments: {
    currentPortfolio: number;
    monthlyInvestment: number;
    projectedValue: number;
    expectedCagr: number;
    plannedPortfolio: number | null;
    portfolioVariance: number | null;
  };
  loans: {
    outstanding: number;
    emi: number;
    interestRate: number;
    activeLoans: number;
    plannedOutstanding: number | null;
    outstandingVariance: number | null;
  };
  goals: {
    total: number;
    onTrack: number;
    atRisk: number;
    completed: number;
    items: ExecutiveGoalProgressItem[];
    heatmap: GoalHeatmapRow[];
  };
  monthlySummary: {
    income: number;
    expenses: number;
    savings: number;
    investments: number;
    netWorthChange: number;
  };
  financialHealth: {
    score: number;
    label: string;
    detail: string;
    rating: "Excellent" | "Good" | "Needs Attention";
    components: FinancialHealthComponentRow[];
  };
  recommendedActions: Array<{
    id: string;
    title: string;
    priority: "High" | "Medium" | "Low";
    reason: string;
    nextStep: string;
  }>;
  netWorthTrend: {
    available: boolean;
    message: string | null;
    points: Array<{
      month: string;
      actual: number | null;
      planned: number | null;
    }>;
  };
  assetAllocationDrift: {
    available: boolean;
    message: string | null;
    rows: AllocationDriftRow[];
  };
  monthlyReviewSummary: {
    available: boolean;
    month: string | null;
    netWorthChange: number | null;
    savingsRate: number | null;
    debtReduction: number | null;
    goalProgress: number | null;
    retirementReadinessChange: number | null;
    ctaLabel: "Start Monthly Review" | "Update Monthly Review";
  };
  dailyInsight: string;
  retirement: {
    available: boolean;
    totalRetirementAssets: number | null;
    accountsCount: number | null;
    plannedTotalRetirementAssets: number | null;
    retirementVariance: number | null;
    readinessPercent: number | null;
    requiredCorpus: number | null;
    gapOrSurplus: number | null;
    retirementDate: string | null;
    projectionEndDate: string | null;
    corpusSurvivalStatus: string;
    status: RetirementReadinessStatus;
  };
  upcoming: {
    available: boolean;
    items: Array<{
      id: string;
      name: string;
      date: string;
      amount: number;
      module: string;
      type: string;
    }>;
  };
}

function monthToLabel(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function computeLargestShare(allocation: Array<{ value: number }>): number {
  const total = allocation.reduce((sum, item) => sum + toNumber(item.value), 0);
  if (total <= 0) {
    return 0;
  }

  const largest = allocation.reduce((max, item) => Math.max(max, toNumber(item.value)), 0);
  return largest / total;
}

function mapScoreToRating(score: number): "Excellent" | "Good" | "Needs Attention" {
  if (score >= 85) {
    return "Excellent";
  }

  if (score >= 70) {
    return "Good";
  }

  return "Needs Attention";
}

const simulationEngine = createPlanningScenarioProductionSimulationEngine();

async function loadSimulation(): Promise<SimulationResult | null> {
  const outcome = await simulationEngine.run({ snapshotId: "executive-dashboard" });

  if (!outcome.ok) {
    return null;
  }

  return outcome.result;
}

function buildGoalProgressItems(goals: Awaited<ReturnType<typeof goalService.listGoals>>): ExecutiveGoalProgressItem[] {
  return [...goals]
    .sort((left, right) => Number(right.progress?.progress_percent ?? 0) - Number(left.progress?.progress_percent ?? 0))
    .slice(0, 5)
    .map((goal) => ({
      id: goal.id,
      name: goal.name,
      progressPercent: Number(goal.progress?.progress_percent ?? 0),
      targetAmount: Number(goal.progress?.target_amount ?? goal.target_amount ?? 0),
      gap: Math.max(0, Number(goal.progress?.target_amount ?? goal.target_amount ?? 0) - Number(goal.progress?.projected_amount ?? 0)),
    }));
}

async function loadCurrentMonthProjectionSummary(startMonth: string, endYear: number): Promise<{
  income: number;
  expenses: number;
  savings: number;
  investments: number;
  netWorthChange: number;
  plannedNetWorth: number | null;
  plannedInvestments: number | null;
  plannedLiabilities: number | null;
  plannedRetirement: number | null;
} | null> {
  const scenario: ProjectionScenario = {
    id: DEFAULT_SCENARIO_KEY,
    name: "Executive dashboard projection",
    description: "Executive dashboard monthly summary.",
    startMonth,
    planningHorizonYear: endYear,
    assumptions: [],
    events: [],
    isDefault: true,
  };

  const context = await projectionInputService.buildContext({
    scenario,
    startSource: { kind: "latest-closed-month-end" },
  }).catch(() => null);

  if (!context) {
    return null;
  }

  const projection = await projectionEngine.run(context).catch(() => null);
  const firstRecord = projection?.monthlyLedger[0];
  const firstSnapshot = projection?.snapshots[0];
  const lastSnapshot = projection?.snapshots.at(-1) ?? firstSnapshot;

  if (!firstRecord) {
    return null;
  }

  const income = toNumber(firstRecord.salary) + toNumber(firstRecord.bonus) + toNumber(firstRecord.rentalIncome) + toNumber(firstRecord.businessIncome) + toNumber(firstRecord.otherIncome);
  const expenses = toNumber(firstRecord.livingExpenses) + toNumber(firstRecord.insurancePremium) + toNumber(firstRecord.taxes) + toNumber(firstRecord.emis);
  const savings = income - expenses;

  return {
    income,
    expenses,
    savings,
    investments: toNumber(firstRecord.investmentContributions),
    netWorthChange: toNumber(firstSnapshot?.closingBalance) - toNumber(firstSnapshot?.openingBalance),
    plannedNetWorth: lastSnapshot ? toNumber(lastSnapshot.closingBalance) : null,
    plannedInvestments: lastSnapshot ? toNumber(lastSnapshot.closingBalances?.investments) : null,
    plannedLiabilities: lastSnapshot ? toNumber(lastSnapshot.closingBalances?.liabilities) : null,
    plannedRetirement: lastSnapshot ? toNumber(lastSnapshot.closingBalances?.retirement) : null,
  };
}

function buildTopContributors(data: Awaited<ReturnType<typeof getBalanceSheetData>>): Array<{
  label: string;
  value: number;
  type: "asset" | "liability";
}> {
  const assets = (data.summary.assetSections ?? [])
    .map((item) => ({ label: item.label, value: toNumber(item.value), type: "asset" as const }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 2);

  const liabilities = (data.summary.liabilitySections ?? [])
    .map((item) => ({ label: item.label, value: toNumber(item.value), type: "liability" as const }))
    .filter((item) => item.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 1);

  return [...assets, ...liabilities];
}

function toPipelineLiabilityRow(liability: Liability) {
  const raw = liability as unknown as Record<string, unknown>;

  return {
    id: liability.id,
    account_name: liability.account_name,
    liability_type: liability.liability_type,
    status: liability.status,
    outstanding_amount: liability.outstanding_amount,
    current_balance: raw.current_balance ?? null,
    monthly_emi: raw.monthly_emi ?? liability.emi ?? null,
  };
}

function resolveOutstandingForPolicy(liability: Liability): number {
  const raw = liability as unknown as Record<string, unknown>;
  return toNumber(liability.outstanding_amount ?? raw.current_balance ?? 0);
}

function normalizeStatus(liability: Liability): string {
  return String(liability.status ?? "").trim().toLowerCase();
}

function classifyExclusionReasons(liability: Liability): Array<{ reason: string; policyRule: string }> {
  const raw = liability as unknown as Record<string, unknown>;
  const reasons: Array<{ reason: string; policyRule: string }> = [];

  const rawOutstanding = raw.outstanding_amount;
  const resolvedOutstanding = resolveOutstandingForPolicy(liability);
  const status = normalizeStatus(liability);
  const archived = status === "archived" || Boolean(raw.archived) || Boolean(raw.archived_at);
  const deleted = status === "deleted" || Boolean(raw.deleted) || Boolean(raw.is_deleted) || Boolean(raw.deleted_at);

  if (!(resolvedOutstanding > 0)) {
    if (rawOutstanding === null || rawOutstanding === undefined || rawOutstanding === "") {
      reasons.push({
        reason: "outstanding_amount is null",
        policyRule: "FinancialPositionPolicy v1.0 include rows with outstanding_amount > 0 (LiabilityDomainService.shouldIncludeRow)",
      });
    } else {
      const numericOutstanding = Number(rawOutstanding);
      if (Number.isFinite(numericOutstanding) && numericOutstanding < 0) {
        reasons.push({
          reason: "negative outstanding",
          policyRule: "FinancialPositionPolicy v1.0 include rows with outstanding_amount > 0 (LiabilityDomainService.shouldIncludeRow)",
        });
      } else if (Number.isFinite(numericOutstanding) && numericOutstanding <= 0) {
        reasons.push({
          reason: "outstanding_amount <= 0",
          policyRule: "FinancialPositionPolicy v1.0 include rows with outstanding_amount > 0 (LiabilityDomainService.shouldIncludeRow)",
        });
      } else {
        reasons.push({
          reason: "other",
          policyRule: "FinancialPositionPolicy v1.0 include rows with outstanding_amount > 0 (LiabilityDomainService.shouldIncludeRow)",
        });
      }
    }
  }

  if (archived) {
    reasons.push({
      reason: "archived",
      policyRule: "FinancialPositionPolicy v1.0 excludes archived rows (LiabilityDomainService.isArchived)",
    });
  }

  if (deleted) {
    reasons.push({
      reason: "deleted",
      policyRule: "FinancialPositionPolicy v1.0 excludes deleted rows (LiabilityDomainService.isDeleted)",
    });
  }

  return reasons;
}

async function loadLastMonthlyReviewLabel(): Promise<string | null> {
  const monthEndHistory = await snapshotReadModel.loadHistory({ source: "month-end-close" }).catch(() => []);
  if (monthEndHistory.length > 0) {
    return monthEndHistory[0].monthLabel;
  }

  const legacyHistory = await snapshotReadModel.loadHistory({ source: "legacy-monthly-snapshot" }).catch(() => []);
  return legacyHistory[0]?.monthLabel ?? null;
}

function formatMonthLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function normalizeMonthMonth(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(12, Math.round(value)));
}

function toRetirementDateLabel(month: number | undefined, year: number | undefined): string | null {
  if (!Number.isFinite(Number(month)) || !Number.isFinite(Number(year))) {
    return null;
  }

  return formatMonthLabel(Number(year), normalizeMonthMonth(Number(month)));
}

async function loadNetWorthTrendPoints(): Promise<Array<{ month: string; actual: number | null; planned: number | null }>> {
  const workspace = await monthlyReviewService.getMonthlyReviewWorkspace().catch(() => null);
  if (!workspace || workspace.periods.length === 0) {
    return [];
  }

  const periods = workspace.periods.slice(0, 12);
  const rows = await Promise.all(
    periods.map(async (period) => {
      const review = await monthlyReviewService.getMonthlyReviewWorkspace(period.closeId).catch(() => null);
      const netWorthKpi = review?.kpis.find((item) => item.key === "net_worth") ?? null;

      return {
        month: period.label,
        actual: netWorthKpi ? Number(netWorthKpi.actual ?? 0) : null,
        planned: netWorthKpi ? Number(netWorthKpi.projected ?? 0) : null,
      };
    }),
  );

  return rows.reverse();
}

function computeRetirementReadinessChangePercent(entities: Awaited<ReturnType<typeof monthlyReviewService.getMonthlyReviewWorkspace>>["entities"]): number | null {
  const retirementRows = entities.filter((item) => item.itemKey === "epf" || item.itemKey === "ppf" || item.itemKey === "nps");
  if (retirementRows.length === 0) {
    return null;
  }

  const opening = retirementRows.reduce((sum, row) => sum + Number(row.openingValue ?? 0), 0);
  const actual = retirementRows.reduce((sum, row) => sum + Number(row.actualValue ?? 0), 0);

  if (opening <= 0) {
    return null;
  }

  return ((actual - opening) / opening) * 100;
}

function computeDebtReduction(entities: Awaited<ReturnType<typeof monthlyReviewService.getMonthlyReviewWorkspace>>["entities"]): number | null {
  const liabilityRows = entities.filter((item) => item.itemType === "liability");
  if (liabilityRows.length === 0) {
    return null;
  }

  return liabilityRows.reduce((sum, row) => sum + (Number(row.openingValue ?? 0) - Number(row.actualValue ?? 0)), 0);
}

function computeCurrentAllocationClasses(summary: Awaited<ReturnType<typeof getBalanceSheetData>>["summary"]): Record<AllocationDriftRow["assetClass"], number> {
  const totals = summary.categoryTotals;

  return {
    Equity: Number(totals.investments ?? 0),
    Debt: Number(totals.fixedDeposits ?? 0),
    Cash: Number(totals.cashAndBank ?? 0),
    "Real Estate": Number(totals.realEstate ?? 0),
    "Retirement Accounts": Number(totals.retirement ?? 0),
    Other: Number(totals.otherAssets ?? 0) + Number(totals.vehicles ?? 0) + Number(totals.goldAndSilver ?? 0),
  };
}

export class ExecutiveDashboardService {
  async getDashboard(): Promise<ExecutiveDashboardData> {
    const [balanceSheetData, goals, assumptions, simulation, persistedCashFlowSummary, compensationSummary, retirementSummary, events, lastMonthlyReview, healthScore, decisionRecommendations, monthlyReviewWorkspace, netWorthTrendPoints] = await Promise.all([
      getBalanceSheetData(),
      goalService.listGoals({ includeProgress: true }).catch(() => []),
      assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY).catch(() => null),
      loadSimulation().catch(() => null),
      cashFlowManagementService.getCashFlowSummary().catch(() => null),
      compensationService.getSummary(DEFAULT_SCENARIO_KEY).catch(() => null),
      getRetirementSummary().catch(() => null),
      projectionEventsService.listEvents(DEFAULT_SCENARIO_KEY).catch(() => null),
      loadLastMonthlyReviewLabel().catch(() => null),
      healthScoreService.calculateHealthScore().catch(() => null),
      decisionEngine.generateRecommendations().catch(() => []),
      monthlyReviewService.getMonthlyReviewWorkspace().catch(() => null),
      loadNetWorthTrendPoints().catch(() => []),
    ]);

    const projectionMonthly = assumptions
      ? await loadCurrentMonthProjectionSummary(assumptions.planning.startMonth, assumptions.planning.endYear).catch(() => null)
      : null;

    const investmentSummary = buildInvestmentSummary(balanceSheetData.investments);
    const assetSummary = buildAssetSummaryFromAssets(balanceSheetData.assets);
    const goalItems = buildGoalProgressItems(goals);
    const goalsOnTrack = goals.filter((goal) => goal.status === "ON_TRACK" || goal.status === "COMPLETED").length;
    const atRiskGoals = goals.filter((goal) => goal.status === "AT_RISK").length;
    const completedGoals = goals.filter((goal) => goal.status === "COMPLETED").length;
    const monthlyIncomeFallback = toNumber(compensationSummary?.netMonthlySalary)
      + toNumber(compensationSummary?.monthlyBonusEquivalent)
      + toNumber(assumptions?.income.otherMonthlyIncome);
    const monthlyExpensesFallback = toNumber(projectionMonthly?.expenses);
    const monthlyInvestmentFallback = toNumber(assumptions?.investments.monthlySipAmount) + toNumber(assumptions?.investments.stockInvestmentAmount);
    const monthlyCashFlow = persistedCashFlowSummary ?? buildCashFlowSummary(
      [
        {
          id: "dashboard-income",
          name: "Monthly income",
          type: "Other",
          monthlyAmount: projectionMonthly?.income ?? monthlyIncomeFallback,
          annualIncrement: 0,
          startDate: null,
          status: "Active",
          notes: null,
        },
      ],
      [
        {
          id: "dashboard-expenses",
          name: "Monthly expenses",
          category: "Other",
          monthlyAmount: projectionMonthly?.expenses ?? monthlyExpensesFallback,
          annualInflation: 0,
          startDate: null,
          status: "Active",
          notes: null,
        },
      ],
      [],
    );
    const projectedInvestmentValue = simulation?.monthlySnapshots.at(-1)?.closingBalances.investments ?? investmentSummary.totalInvestmentValue;
    const plannedNetWorth = projectionMonthly?.plannedNetWorth ?? toOptionalNumber(simulation?.monthlySnapshots[0]?.closingBalances?.netWorth);
    const plannedInvestments = projectionMonthly?.plannedInvestments ?? toOptionalNumber(simulation?.monthlySnapshots[0]?.closingBalances?.investments);
    const plannedLiabilities = projectionMonthly?.plannedLiabilities ?? toOptionalNumber(simulation?.monthlySnapshots[0]?.closingBalances?.liabilities);
    const plannedRetirement = projectionMonthly?.plannedRetirement ?? toOptionalNumber(simulation?.monthlySnapshots[0]?.closingBalances?.retirement);
    const currentRetirementAssets = retirementSummary ? toNumber(retirementSummary.totalRetirementAssets) : null;
    const plannedNonRetirementInvestments = plannedInvestments !== null
      ? Math.max(0, plannedInvestments - (plannedRetirement ?? 0))
      : null;
    const currentNonRetirementInvestments = Number(balanceSheetData.summary.categoryTotals.investments ?? 0)
      + Number(balanceSheetData.summary.categoryTotals.fixedDeposits ?? 0)
      + Number(balanceSheetData.summary.categoryTotals.goldAndSilver ?? 0);
    const hasPlannedNetWorth = plannedNetWorth !== null;
    const hasPlannedInvestments = plannedNonRetirementInvestments !== null;
    const hasPlannedLiabilities = plannedLiabilities !== null;
    const hasPlannedRetirement = plannedRetirement !== null;
    const retirementReadinessPercent = hasPlannedRetirement && plannedRetirement > 0 && currentRetirementAssets !== null
      ? (currentRetirementAssets / plannedRetirement) * 100
      : null;
    const retirementStatus = classifyRetirementReadinessStatus(retirementReadinessPercent);
    const topContributors = buildTopContributors(balanceSheetData);
    const largestAssetShare = computeLargestShare(balanceSheetData.summary.assetAllocation ?? []);
    const largestInvestmentShare = computeLargestShare(investmentSummary.assetAllocation ?? []);
    const monthlyNetWorthChange = projectionMonthly?.netWorthChange ?? Number(simulation?.summary.netWorthChange ?? 0);
    const financialHealth = buildFinancialHealthScore({
      summary: balanceSheetData.summary,
      latestMonthlyGrowth: monthlyNetWorthChange,
      largestAssetShare,
      largestInvestmentShare,
    });
    const summaryForInsights = {
      ...balanceSheetData.summary,
      assetAllocation: balanceSheetData.summary.assetAllocation ?? [],
      liabilityAllocation: balanceSheetData.summary.liabilityAllocation ?? [],
    };
    const goalReadinessPercent = goals.length > 0
      ? ((goalsOnTrack + completedGoals) / goals.length) * 100
      : null;
    const healthBreakdown = buildFinancialHealthBreakdown({
      savingsRate: Number.isFinite(monthlyCashFlow.savingsRate) ? monthlyCashFlow.savingsRate : null,
      retirementReadinessPercent,
      debtRatio: Number(balanceSheetData.summary.debtRatio ?? 0),
      goalReadinessPercent,
      emergencyFundScore: healthScore?.components.find((component) => component.key === "emergencyFund")?.score ?? null,
      insuranceCoverageScore: null,
    });
    const goalHeatmap = buildGoalHeatmapRows(goals);
    const dashboardRecommendations = buildDashboardRecommendations({
      decisionRecommendations,
      balanceSheetSummary: balanceSheetData.summary,
      goals,
      monthlySavings: monthlyCashFlow.monthlySavings,
      hasMonthlyReview: Boolean(monthlyReviewWorkspace?.selectedPeriod),
    });
    const allocationDriftRows = buildAllocationDriftRows({
      currentByClass: computeCurrentAllocationClasses(balanceSheetData.summary),
      targetByClass: null,
      driftThresholdPercent: 5,
    });
    const debtReduction = monthlyReviewWorkspace?.entities ? computeDebtReduction(monthlyReviewWorkspace.entities) : null;
    const retirementReadinessChange = monthlyReviewWorkspace?.entities
      ? computeRetirementReadinessChangePercent(monthlyReviewWorkspace.entities)
      : null;

    const canonicalInspection = inspectFinancialPositionRows(balanceSheetData.liabilities);
    const canonicalSnapshot = canonicalInspection.snapshot;
    const canonicalValidation = liabilityDomainService.validateSnapshot(canonicalInspection.snapshot);

    if (process.env.NODE_ENV !== "production") {
      const rowsForDomain = balanceSheetData.liabilities;
      const includedRows = canonicalInspection.includedRows;
      const excludedRows = canonicalInspection.diagnostics.excludedRows.map((excluded) => {
        const liability = rowsForDomain.find((row) => row.id === excluded.id);
        const reasons = liability
          ? classifyExclusionReasons(liability)
          : [{ reason: "other", policyRule: "Unable to map excluded id to liability row in dashboard input." }];

        return {
          id: excluded.id,
          account_name: liability?.account_name ?? "Unknown",
          reasons,
        };
      });

      const carLoanRows = rowsForDomain.filter((row) => row.liability_type === "Car Loan");
      const includedCarLoanIds = new Set(
        includedRows
          .filter((row) => row.liabilityType === "Car Loan")
          .map((row) => row.id),
      );
      const excludedCarLoans = carLoanRows.filter((row) => !includedCarLoanIds.has(row.id));

      const carLoanTrace = {
        database_to_getLiabilities: carLoanRows.length > 0,
        getLiabilities_to_getBalanceSheetData: carLoanRows.length > 0,
        getBalanceSheetData_to_LiabilityDomainService: carLoanRows.length > 0,
        liabilityDomainService_to_executiveDashboard_included: excludedCarLoans.length === 0 && carLoanRows.length > 0,
        disappearsAt: carLoanRows.length === 0
          ? "Before LiabilityDomainService (database/getLiabilities/getBalanceSheetData path)"
          : excludedCarLoans.length > 0
            ? "LiabilityDomainService policy exclusion"
            : "Does not disappear in this pipeline",
        carLoanRowIds: carLoanRows.map((row) => row.id),
        excludedCarLoanRows: excludedCarLoans.map((row) => ({
          id: row.id,
          account_name: row.account_name,
          reasons: classifyExclusionReasons(row),
        })),
      };

      console.groupCollapsed("[Liability Pipeline] Stage 3 - Rows received by LiabilityDomainService (Executive Dashboard)");
      console.table(rowsForDomain.map(toPipelineLiabilityRow));
      console.info({ count: rowsForDomain.length });
      console.groupEnd();

      console.groupCollapsed("[Liability Pipeline] Stage 4 - Included rows (FinancialPositionPolicy v1.0)");
      console.table(
        includedRows.map((row) => ({
          id: row.id,
          account_name: row.label,
          liability_type: row.liabilityType,
          status: row.status,
          outstanding_amount: row.outstandingAmount,
          monthly_emi: row.monthlyEmi,
        })),
      );
      console.info({ count: includedRows.length });
      console.groupEnd();

      console.groupCollapsed("[Liability Pipeline] Stage 5 - Excluded rows (FinancialPositionPolicy v1.0)");
      console.table(
        excludedRows.map((row) => ({
          id: row.id,
          account_name: row.account_name,
          exclusion_reason: row.reasons.map((reason) => reason.reason).join(" | "),
          policy_rule_applied: row.reasons.map((reason) => reason.policyRule).join(" | "),
        })),
      );
      console.info({ count: excludedRows.length, details: excludedRows });
      console.groupEnd();

      console.groupCollapsed("[Liability Pipeline] Car Loan trace");
      console.info(carLoanTrace);
      console.groupEnd();
    }

    if (process.env.NODE_ENV !== "production") {
      logFinancialPositionValidation({
        screen: "Executive Dashboard",
        legacyRows: balanceSheetData.liabilities
          .filter((liability) => isManagedLoanType(liability.liability_type))
          .map((liability) => ({
            id: liability.id,
            label: liability.account_name,
            liabilityType: liability.liability_type,
            outstandingAmount: Number(liability.outstanding_amount ?? 0),
            monthlyEmi: Number(liability.emi ?? 0),
          })),
        canonical: canonicalInspection,
        validation: canonicalValidation,
      });
    }

    const dailyInsight = buildExecutiveInsights(
      summaryForInsights,
      balanceSheetData.assets,
      balanceSheetData.liabilities,
      balanceSheetData.investments,
    )[0]?.detail ?? "Coming Soon";

    const todayIso = new Date().toISOString().slice(0, 10);
    const upcomingItems = (events ?? [])
      .filter((event) => event.isEnabled && event.date >= todayIso)
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(0, 5)
      .map((event) => ({
        id: event.id,
        name: event.name,
        date: event.date,
        amount: event.amount,
        module: event.module,
        type: event.type,
      }));

    const output: ExecutiveDashboardData = {
      asOfLabel: monthToLabel(simulation?.summary.projectionEnd ?? assumptions?.planning.startMonth ?? ""),
      emptyState: Number(balanceSheetData.summary.totalBalanceSheetAssets ?? 0) <= 0 && Number(balanceSheetData.summary.totalLiabilities ?? 0) <= 0,
      executiveSummary: {
        netWorth: Number(balanceSheetData.summary.netWorth ?? 0),
        assets: assetSummary.totalAssets,
        liabilities: canonicalSnapshot.totalOutstanding,
        monthlySavings: monthlyCashFlow.monthlySavings,
        plannedNetWorth: hasPlannedNetWorth ? plannedNetWorth : null,
        netWorthVariance: hasPlannedNetWorth ? Number(balanceSheetData.summary.netWorth ?? 0) - plannedNetWorth : null,
        topContributors,
        lastMonthlyReview,
      },
      investments: {
        currentPortfolio: currentNonRetirementInvestments,
        monthlyInvestment: projectionMonthly?.investments ?? monthlyInvestmentFallback,
        projectedValue: Number(projectedInvestmentValue ?? 0),
        expectedCagr: Number(investmentSummary.cagr ?? assumptions?.investments.expectedReturnRate ?? 0),
        plannedPortfolio: hasPlannedInvestments ? plannedNonRetirementInvestments : null,
        portfolioVariance: hasPlannedInvestments ? currentNonRetirementInvestments - plannedNonRetirementInvestments : null,
      },
      loans: {
        outstanding: canonicalSnapshot.totalOutstanding,
        emi: canonicalSnapshot.totalMonthlyEmi,
        interestRate: Number(canonicalSnapshot.weightedAverageInterest ?? 0),
        activeLoans: canonicalSnapshot.activeLiabilityCount,
        plannedOutstanding: hasPlannedLiabilities ? plannedLiabilities : null,
        outstandingVariance: hasPlannedLiabilities ? canonicalSnapshot.totalOutstanding - plannedLiabilities : null,
      },
      goals: {
        total: goals.length,
        onTrack: goalsOnTrack,
        atRisk: atRiskGoals,
        completed: completedGoals,
        items: goalItems,
        heatmap: goalHeatmap,
      },
      monthlySummary: {
        income: monthlyCashFlow.monthlyIncome,
        expenses: monthlyCashFlow.monthlyExpenses,
        savings: monthlyCashFlow.monthlySavings,
        investments: projectionMonthly?.investments ?? monthlyInvestmentFallback,
        netWorthChange: monthlyNetWorthChange,
      },
      financialHealth: {
        score: financialHealth.score,
        label: financialHealth.label,
        detail: financialHealth.detail,
        rating: mapScoreToRating(financialHealth.score),
        components: healthBreakdown,
      },
      recommendedActions: dashboardRecommendations,
      netWorthTrend: {
        available: netWorthTrendPoints.length > 0,
        message: netWorthTrendPoints.length > 0 ? null : "Add monthly snapshots to view net worth trend.",
        points: netWorthTrendPoints,
      },
      assetAllocationDrift: {
        available: true,
        message: "Set target allocation in Assumptions.",
        rows: allocationDriftRows,
      },
      monthlyReviewSummary: {
        available: Boolean(monthlyReviewWorkspace?.selectedPeriod && monthlyReviewWorkspace.summary),
        month: monthlyReviewWorkspace?.selectedPeriod?.label ?? null,
        netWorthChange: monthlyReviewWorkspace?.summary?.monthOverMonthChange ?? null,
        savingsRate: monthlyCashFlow.monthlyIncome > 0 ? (monthlyCashFlow.monthlySavings / monthlyCashFlow.monthlyIncome) * 100 : null,
        debtReduction,
        goalProgress: goalReadinessPercent,
        retirementReadinessChange,
        ctaLabel: monthlyReviewWorkspace?.selectedPeriod ? "Update Monthly Review" : "Start Monthly Review",
      },
      dailyInsight,
      retirement: {
        available: retirementSummary !== null,
        totalRetirementAssets: currentRetirementAssets,
        accountsCount: retirementSummary ? toNumber(retirementSummary.count) : null,
        plannedTotalRetirementAssets: hasPlannedRetirement ? plannedRetirement : null,
        retirementVariance: hasPlannedRetirement && currentRetirementAssets !== null ? currentRetirementAssets - plannedRetirement : null,
        readinessPercent: retirementReadinessPercent,
        requiredCorpus: hasPlannedRetirement ? plannedRetirement : null,
        gapOrSurplus: hasPlannedRetirement && currentRetirementAssets !== null ? currentRetirementAssets - plannedRetirement : null,
        retirementDate: toRetirementDateLabel(assumptions?.retirement.salaryStopMonth, assumptions?.retirement.salaryStopYear),
        projectionEndDate: toRetirementDateLabel(assumptions?.planning.endMonth, assumptions?.planning.endYear),
        corpusSurvivalStatus: retirementReadinessPercent === null
          ? "Data required"
          : retirementReadinessPercent >= 100
            ? "Current retirement corpus meets or exceeds projected plan corpus."
            : retirementReadinessPercent >= 80
              ? "Current retirement corpus is close to projected plan corpus."
              : "Current retirement corpus is below projected plan corpus.",
        status: retirementStatus,
      },
      upcoming: {
        available: events !== null,
        items: upcomingItems,
      },
    };

    return output;
  }
}

export const executiveDashboardService = new ExecutiveDashboardService();
