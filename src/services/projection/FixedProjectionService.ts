import { SalaryProjectionService, type SalaryProjectionPoint } from "./SalaryProjectionService";
import { ProjectionVersioningService } from "./versioning/ProjectionVersioningService";
import type {
  ProjectionAssumptionSnapshotRecord,
  ProjectionMonthlyPositionRecord,
  ProjectionPlanVersionRecord,
  ProjectionSalaryCurveRecord,
  UpsertProjectionMonthlyPositionInput,
} from "./versioning/types";

const DEFAULT_FIXED_START_MONTH = "2026-07";
const DEFAULT_FIXED_HORIZON_END_MONTH = "2062-07";

const DEFAULT_EVENT_DRAWDOWN_ORDER: FixedProjectionBucketKey[] = ["cash", "mutual_funds", "ppf", "epf"];
const DEFAULT_POST_RETIREMENT_EXPENSE_REDUCTION_PERCENT = 20;

const DEFAULT_PPF_ANNUAL_CONTRIBUTION_MONTH = 4;

export type FixedProjectionBucketKey =
  | "cash"
  | "mutual_funds"
  | "stocks"
  | "epf"
  | "ppf"
  | "nps"
  | "financial_assets_total"
  | "non_financial_assets_total"
  | "liabilities"
  | "net_worth";

export interface FixedProjectionOpeningBalances {
  cash: number;
  mutualFunds: number;
  stocks: number;
  epf: number;
  ppf: number;
  nps: number;
  property: number;
  gold: number;
  otherNonFinancialAssets: number;
  liabilities: number;
}

export interface FixedProjectionSalaryAssumptions {
  currentGrossSalary: number;
  currentBasicSalary: number;
  annualIncrementPercent: number;
  incrementMonth?: number | null;
  retirementMonth?: string | null;
}

export interface FixedProjectionContributionAssumptions {
  mutualFundsMonthlySip: number;
  epfEmployeeContributionRate: number;
  epfEmployerContributionRate: number;
  npsContributionRate: number;
  ppfMonthlyContributionPriyesh: number;
  ppfAnnualContributionShobhana: number;
  ppfAnnualContributionMonth?: number;
  ppfContributionEndMonth?: string | null;
}

export interface FixedProjectionReturnAssumptions {
  cashAnnualReturnPercent: number;
  mutualFundsAnnualReturnPercent: number;
  stocksAnnualReturnPercent: number;
  epfAnnualReturnPercent: number;
  ppfAnnualReturnPercent: number;
  npsAnnualReturnPercent: number;
  nonFinancialAnnualReturnPercent: number;
}

export interface FixedProjectionExpenseAssumptions {
  preRetirementMonthlyExpense: number;
  postRetirementExpenseReductionPercent?: number;
  monthlyEmi: number;
  monthlyInsurancePremium: number;
}

export interface FixedProjectionNpsSplitPolicy {
  lumpsumPercent: number;
  annuityPercent: number;
  postRetirementExpenseReductionPercent?: number;
}

export interface FixedProjectionAssumptions {
  salary: FixedProjectionSalaryAssumptions;
  contributions: FixedProjectionContributionAssumptions;
  returns: FixedProjectionReturnAssumptions;
  expenses: FixedProjectionExpenseAssumptions;
  npsSplitPolicy?: FixedProjectionNpsSplitPolicy;
  liabilitiesMonthlyRepayment?: number;
  eventDrawdownOrder?: FixedProjectionBucketKey[];
}

export interface CreateFixedProjectionV1Input {
  householdId?: string | null;
  versionNo: number;
  startMonth?: string;
  horizonEndMonth?: string;
  openingBalances: FixedProjectionOpeningBalances;
  assumptions: FixedProjectionAssumptions;
}

export interface CreateFixedProjectionV1Result {
  planVersion: ProjectionPlanVersionRecord;
  assumptionSnapshot: ProjectionAssumptionSnapshotRecord;
  salaryCurve: ProjectionSalaryCurveRecord[];
  monthlyPositions: ProjectionMonthlyPositionRecord[];
}

interface MonthStamp {
  year: number;
  month: number;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toFiniteNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }

  return value;
}

function parseMonthKey(monthKey: string): MonthStamp {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month key: ${monthKey}`);
  }

  return { year, month };
}

function formatMonthKey(input: MonthStamp): string {
  return `${input.year}-${String(input.month).padStart(2, "0")}`;
}

function compareMonth(left: MonthStamp, right: MonthStamp): number {
  if (left.year !== right.year) {
    return left.year - right.year;
  }

  return left.month - right.month;
}

function addMonth(input: MonthStamp): MonthStamp {
  if (input.month === 12) {
    return { year: input.year + 1, month: 1 };
  }

  return { year: input.year, month: input.month + 1 };
}

function listMonthKeys(startMonth: string, endMonth: string): string[] {
  const start = parseMonthKey(startMonth);
  const end = parseMonthKey(endMonth);

  if (compareMonth(start, end) > 0) {
    throw new Error("horizonEndMonth must be greater than or equal to startMonth.");
  }

  const months: string[] = [];
  let cursor = start;
  while (compareMonth(cursor, end) <= 0) {
    months.push(formatMonthKey(cursor));
    cursor = addMonth(cursor);
  }

  return months;
}

function annualPercentToMonthlyRate(annualPercent: number): number {
  return annualPercent / 100 / 12;
}

function ensureNpsSplitIsValid(policy: FixedProjectionNpsSplitPolicy): void {
  const total = roundCurrency(policy.lumpsumPercent + policy.annuityPercent);
  if (total !== 100) {
    throw new Error("NPS split policy is invalid: lumpsumPercent + annuityPercent must equal 100.");
  }
}

export function resolvePostRetirementExpenseReductionPercent(value: number | null | undefined): number {
  const resolved = value ?? DEFAULT_POST_RETIREMENT_EXPENSE_REDUCTION_PERCENT;
  if (resolved < 0 || resolved > 100) {
    throw new Error("postRetirementExpenseReductionPercent must be between 0 and 100.");
  }

  return resolved;
}

function salaryCurveByMonth(curve: SalaryProjectionPoint[]): Map<string, SalaryProjectionPoint> {
  return new Map(curve.map((row) => [row.month_key, row]));
}

function isMonthBeforeOrEqual(left: string, right: string): boolean {
  return compareMonth(parseMonthKey(left), parseMonthKey(right)) <= 0;
}

function nonNegative(value: number): number {
  return value < 0 ? 0 : value;
}

export class FixedProjectionService {
  constructor(
    private readonly versioningService = new ProjectionVersioningService(),
    private readonly salaryProjectionService = new SalaryProjectionService(),
  ) {}

  async createFixedProjectionV1(input: CreateFixedProjectionV1Input): Promise<CreateFixedProjectionV1Result> {
    this.assertInputNumbers(input);

    const startMonth = input.startMonth ?? DEFAULT_FIXED_START_MONTH;
    const horizonEndMonth = input.horizonEndMonth ?? DEFAULT_FIXED_HORIZON_END_MONTH;
    const npsSplitPolicy: FixedProjectionNpsSplitPolicy = input.assumptions.npsSplitPolicy ?? {
      lumpsumPercent: 50,
      annuityPercent: 50,
    };
    ensureNpsSplitIsValid(npsSplitPolicy);

    const postRetirementExpenseReductionPercent = resolvePostRetirementExpenseReductionPercent(
      input.assumptions.expenses.postRetirementExpenseReductionPercent,
    );

    const eventDrawdownOrder = input.assumptions.eventDrawdownOrder ?? DEFAULT_EVENT_DRAWDOWN_ORDER;

    const planVersion = await this.versioningService.createPlanVersion({
      household_id: input.householdId ?? null,
      plan_kind: "FIXED",
      version_no: input.versionNo,
      status: "DRAFT",
      start_month: startMonth,
      horizon_end_month: horizonEndMonth,
    });

    const assumptionSnapshot = await this.versioningService.upsertAssumptionSnapshot({
      projection_plan_version_id: planVersion.id,
      assumption_payload: {
        startMonth,
        horizonEndMonth,
        openingBalances: input.openingBalances,
        salary: input.assumptions.salary,
        contributions: input.assumptions.contributions,
        returns: input.assumptions.returns,
        liabilitiesMonthlyRepayment: input.assumptions.liabilitiesMonthlyRepayment ?? 0,
        expenses: {
          ...input.assumptions.expenses,
          postRetirementExpenseReductionPercent,
        },
      },
      salary_policy_payload: {
        source: "COMMON_SALARY_CURVE",
        annualIncrementPercent: input.assumptions.salary.annualIncrementPercent,
        incrementMonth: input.assumptions.salary.incrementMonth ?? null,
      },
      retirement_policy_payload: {
        npsSplitPolicy,
        postRetirementExpenseReductionPercent,
        epfAnnualCreditMonth: "03",
        ppfAnnualCreditMonth: "03",
        epfTransferToCashAfterRetirementYears: 3,
        todos: [
          "EPF annual interest crediting on 31 March is not implemented in Phase 2 and remains an explicit TODO.",
          "PPF annual interest crediting on 31 March is not implemented in Phase 2 and remains an explicit TODO.",
          "NPS annuity income stream execution is deferred, policy structure is persisted.",
        ],
      },
      drawdown_policy_payload: {
        financialEventDrawdownOrder: eventDrawdownOrder,
        propertyLiquidationAllowed: false,
        notes: "Property and other non-financial assets are excluded from drawdown in Fixed Projection V1.",
      },
    });

    const salaryCurveRows = this.salaryProjectionService.buildMonthlyCurve({
      startMonth,
      endMonth: horizonEndMonth,
      currentGrossSalary: input.assumptions.salary.currentGrossSalary,
      currentBasicSalary: input.assumptions.salary.currentBasicSalary,
      annualIncrementPercent: input.assumptions.salary.annualIncrementPercent,
      incrementMonth: input.assumptions.salary.incrementMonth,
      retirementMonth: input.assumptions.salary.retirementMonth,
      source: "FIXED_LOCKED",
    });

    const persistedSalaryCurve = await this.versioningService.upsertSalaryCurve(
      salaryCurveRows.map((row) => ({
        projection_plan_version_id: planVersion.id,
        month_key: row.month_key,
        gross_salary: row.gross_salary,
        basic_salary: row.basic_salary,
        salary_growth_rate_used: row.salary_growth_rate_used,
        source: row.source,
      })),
    );

    const monthlyPositions = this.buildMonthlyPositionsV1({
      projectionPlanVersionId: planVersion.id,
      startMonth,
      horizonEndMonth,
      salaryCurve: salaryCurveRows,
      openingBalances: input.openingBalances,
      assumptions: input.assumptions,
      postRetirementExpenseReductionPercent,
      eventDrawdownOrder,
      npsSplitPolicy,
    });

    const persistedMonthlyPositions = await this.versioningService.upsertMonthlyPositions(monthlyPositions);
    const lockedPlanVersion = await this.versioningService.lockPlanVersion(planVersion.id);

    return {
      planVersion: lockedPlanVersion,
      assumptionSnapshot,
      salaryCurve: persistedSalaryCurve,
      monthlyPositions: persistedMonthlyPositions,
    };
  }

  private assertInputNumbers(input: CreateFixedProjectionV1Input): void {
    const opening = input.openingBalances;
    const salary = input.assumptions.salary;
    const contributions = input.assumptions.contributions;
    const returns = input.assumptions.returns;
    const expenses = input.assumptions.expenses;

    const checks: Array<[number, string]> = [
      [opening.cash, "openingBalances.cash"],
      [opening.mutualFunds, "openingBalances.mutualFunds"],
      [opening.stocks, "openingBalances.stocks"],
      [opening.epf, "openingBalances.epf"],
      [opening.ppf, "openingBalances.ppf"],
      [opening.nps, "openingBalances.nps"],
      [opening.property, "openingBalances.property"],
      [opening.gold, "openingBalances.gold"],
      [opening.otherNonFinancialAssets, "openingBalances.otherNonFinancialAssets"],
      [opening.liabilities, "openingBalances.liabilities"],
      [salary.currentGrossSalary, "salary.currentGrossSalary"],
      [salary.currentBasicSalary, "salary.currentBasicSalary"],
      [salary.annualIncrementPercent, "salary.annualIncrementPercent"],
      [contributions.mutualFundsMonthlySip, "contributions.mutualFundsMonthlySip"],
      [contributions.epfEmployeeContributionRate, "contributions.epfEmployeeContributionRate"],
      [contributions.epfEmployerContributionRate, "contributions.epfEmployerContributionRate"],
      [contributions.npsContributionRate, "contributions.npsContributionRate"],
      [contributions.ppfMonthlyContributionPriyesh, "contributions.ppfMonthlyContributionPriyesh"],
      [contributions.ppfAnnualContributionShobhana, "contributions.ppfAnnualContributionShobhana"],
      [returns.cashAnnualReturnPercent, "returns.cashAnnualReturnPercent"],
      [returns.mutualFundsAnnualReturnPercent, "returns.mutualFundsAnnualReturnPercent"],
      [returns.stocksAnnualReturnPercent, "returns.stocksAnnualReturnPercent"],
      [returns.epfAnnualReturnPercent, "returns.epfAnnualReturnPercent"],
      [returns.ppfAnnualReturnPercent, "returns.ppfAnnualReturnPercent"],
      [returns.npsAnnualReturnPercent, "returns.npsAnnualReturnPercent"],
      [returns.nonFinancialAnnualReturnPercent, "returns.nonFinancialAnnualReturnPercent"],
      [expenses.preRetirementMonthlyExpense, "expenses.preRetirementMonthlyExpense"],
      [expenses.monthlyEmi, "expenses.monthlyEmi"],
      [expenses.monthlyInsurancePremium, "expenses.monthlyInsurancePremium"],
    ];

    for (const [value, fieldName] of checks) {
      toFiniteNumber(value, fieldName);
    }
  }

  buildMonthlyPositionsV1(input: {
    projectionPlanVersionId: string;
    startMonth: string;
    horizonEndMonth: string;
    salaryCurve: SalaryProjectionPoint[];
    openingBalances: FixedProjectionOpeningBalances;
    assumptions: FixedProjectionAssumptions;
    postRetirementExpenseReductionPercent: number;
    eventDrawdownOrder: FixedProjectionBucketKey[];
    npsSplitPolicy: FixedProjectionNpsSplitPolicy;
  }): UpsertProjectionMonthlyPositionInput[] {
    const {
      projectionPlanVersionId,
      startMonth,
      horizonEndMonth,
      salaryCurve,
      openingBalances,
      assumptions,
      postRetirementExpenseReductionPercent,
      eventDrawdownOrder,
      npsSplitPolicy,
    } = input;

    const months = listMonthKeys(startMonth, horizonEndMonth);
    const salaryByMonth = salaryCurveByMonth(salaryCurve);

    let cashOpen = roundCurrency(openingBalances.cash);
    let mutualFundsOpen = roundCurrency(openingBalances.mutualFunds);
    let stocksOpen = roundCurrency(openingBalances.stocks);
    let epfOpen = roundCurrency(openingBalances.epf);
    let ppfOpen = roundCurrency(openingBalances.ppf);
    let npsOpen = roundCurrency(openingBalances.nps);
    let nonFinancialOpen = roundCurrency(openingBalances.property + openingBalances.gold + openingBalances.otherNonFinancialAssets);
    let liabilitiesOpen = roundCurrency(openingBalances.liabilities);

    const cashRate = annualPercentToMonthlyRate(assumptions.returns.cashAnnualReturnPercent);
    const mutualFundsRate = annualPercentToMonthlyRate(assumptions.returns.mutualFundsAnnualReturnPercent);
    const stocksRate = annualPercentToMonthlyRate(assumptions.returns.stocksAnnualReturnPercent);
    const npsRate = annualPercentToMonthlyRate(assumptions.returns.npsAnnualReturnPercent);
    const nonFinancialRate = annualPercentToMonthlyRate(assumptions.returns.nonFinancialAnnualReturnPercent);

    const monthlyRows: UpsertProjectionMonthlyPositionInput[] = [];

    for (const monthKey of months) {
      const salaryPoint = salaryByMonth.get(monthKey);
      if (!salaryPoint) {
        throw new Error(`Salary curve row missing for month ${monthKey}.`);
      }

      const retired = !salaryPoint.is_salary_active;
      const expenseMultiplier = retired ? 1 - postRetirementExpenseReductionPercent / 100 : 1;
      const monthlyExpense = roundCurrency(assumptions.expenses.preRetirementMonthlyExpense * expenseMultiplier);
      const monthlyEmi = roundCurrency(assumptions.expenses.monthlyEmi);
      const monthlyInsurancePremium = roundCurrency(assumptions.expenses.monthlyInsurancePremium);

      const epfContribution = roundCurrency(
        salaryPoint.basic_salary * ((assumptions.contributions.epfEmployeeContributionRate + assumptions.contributions.epfEmployerContributionRate) / 100),
      );
      const npsContribution = roundCurrency(salaryPoint.basic_salary * (assumptions.contributions.npsContributionRate / 100));
      const mutualFundsContribution = roundCurrency(assumptions.contributions.mutualFundsMonthlySip);

      const ppfMonthlyContribution = roundCurrency(assumptions.contributions.ppfMonthlyContributionPriyesh);
      const annualContributionMonth = assumptions.contributions.ppfAnnualContributionMonth ?? DEFAULT_PPF_ANNUAL_CONTRIBUTION_MONTH;
      const monthStamp = parseMonthKey(monthKey);
      const ppfAnnualContributionActive =
        monthStamp.month === annualContributionMonth &&
        (!assumptions.contributions.ppfContributionEndMonth || isMonthBeforeOrEqual(monthKey, assumptions.contributions.ppfContributionEndMonth));
      const ppfAnnualContribution = ppfAnnualContributionActive ? roundCurrency(assumptions.contributions.ppfAnnualContributionShobhana) : 0;
      const ppfContribution = roundCurrency(ppfMonthlyContribution + ppfAnnualContribution);

      // Event execution is deferred in this phase. We persist drawdown policy and explicit zero drawdown placeholders.
      const eventDrawdownCash = 0;
      const eventDrawdownMutualFunds = 0;
      const eventDrawdownPpf = 0;
      const eventDrawdownEpf = 0;

      const cashContribution = roundCurrency(salaryPoint.gross_salary - monthlyExpense - monthlyEmi - monthlyInsurancePremium);
      const cashGrowth = roundCurrency(cashOpen * cashRate);
      const cashWithdrawal = roundCurrency(eventDrawdownCash);
      const cashClose = roundCurrency(nonNegative(cashOpen + cashContribution + cashGrowth - cashWithdrawal));

      const mutualFundsGrowth = roundCurrency(mutualFundsOpen * mutualFundsRate);
      const mutualFundsWithdrawal = roundCurrency(eventDrawdownMutualFunds);
      const mutualFundsClose = roundCurrency(nonNegative(mutualFundsOpen + mutualFundsContribution + mutualFundsGrowth - mutualFundsWithdrawal));

      const stocksContribution = 0;
      const stocksGrowth = roundCurrency(stocksOpen * stocksRate);
      const stocksWithdrawal = 0;
      const stocksClose = roundCurrency(nonNegative(stocksOpen + stocksContribution + stocksGrowth - stocksWithdrawal));

      const epfGrowth = 0;
      const epfWithdrawal = roundCurrency(eventDrawdownEpf);
      const epfClose = roundCurrency(nonNegative(epfOpen + epfContribution + epfGrowth - epfWithdrawal));

      const ppfGrowth = 0;
      const ppfWithdrawal = roundCurrency(eventDrawdownPpf);
      const ppfClose = roundCurrency(nonNegative(ppfOpen + ppfContribution + ppfGrowth - ppfWithdrawal));

      const npsGrowth = roundCurrency(npsOpen * npsRate);
      const npsWithdrawal = 0;
      const npsClose = roundCurrency(nonNegative(npsOpen + npsContribution + npsGrowth - npsWithdrawal));

      const financialOpen = roundCurrency(cashOpen + mutualFundsOpen + stocksOpen + epfOpen + ppfOpen + npsOpen);
      const financialContribution = roundCurrency(cashContribution + mutualFundsContribution + stocksContribution + epfContribution + ppfContribution + npsContribution);
      const financialGrowth = roundCurrency(cashGrowth + mutualFundsGrowth + stocksGrowth + epfGrowth + ppfGrowth + npsGrowth);
      const financialWithdrawal = roundCurrency(cashWithdrawal + mutualFundsWithdrawal + stocksWithdrawal + epfWithdrawal + ppfWithdrawal + npsWithdrawal);
      const financialClose = roundCurrency(cashClose + mutualFundsClose + stocksClose + epfClose + ppfClose + npsClose);

      const nonFinancialContribution = 0;
      const nonFinancialGrowth = roundCurrency(nonFinancialOpen * nonFinancialRate);
      const nonFinancialWithdrawal = 0;
      const nonFinancialClose = roundCurrency(nonNegative(nonFinancialOpen + nonFinancialContribution + nonFinancialGrowth - nonFinancialWithdrawal));

      const liabilitiesContribution = 0;
      const liabilitiesGrowth = 0;
      const liabilitiesWithdrawal = roundCurrency(assumptions.liabilitiesMonthlyRepayment ?? 0);
      const liabilitiesClose = roundCurrency(nonNegative(liabilitiesOpen + liabilitiesContribution + liabilitiesGrowth - liabilitiesWithdrawal));

      const netWorthOpen = roundCurrency(financialOpen + nonFinancialOpen - liabilitiesOpen);
      const netWorthContribution = roundCurrency(financialContribution + nonFinancialContribution - liabilitiesContribution);
      const netWorthGrowth = roundCurrency(financialGrowth + nonFinancialGrowth - liabilitiesGrowth);
      const netWorthWithdrawal = roundCurrency(financialWithdrawal + nonFinancialWithdrawal - liabilitiesWithdrawal);
      const netWorthClose = roundCurrency(financialClose + nonFinancialClose - liabilitiesClose);

      monthlyRows.push(
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "cash",
          opening_value: cashOpen,
          contribution: cashContribution,
          growth: cashGrowth,
          withdrawal: cashWithdrawal,
          closing_value: cashClose,
          metadata: {
            salaryIncomeFromCommonCurve: salaryPoint.gross_salary,
            expenseApplied: monthlyExpense,
            expenseReductionPercentAfterRetirement: postRetirementExpenseReductionPercent,
            retired,
          },
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "mutual_funds",
          opening_value: mutualFundsOpen,
          contribution: mutualFundsContribution,
          growth: mutualFundsGrowth,
          withdrawal: mutualFundsWithdrawal,
          closing_value: mutualFundsClose,
          metadata: {
            eventDrawdownPlaceholder: true,
          },
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "stocks",
          opening_value: stocksOpen,
          contribution: stocksContribution,
          growth: stocksGrowth,
          withdrawal: stocksWithdrawal,
          closing_value: stocksClose,
          metadata: {},
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "epf",
          opening_value: epfOpen,
          contribution: epfContribution,
          growth: epfGrowth,
          withdrawal: epfWithdrawal,
          closing_value: epfClose,
          metadata: {
            basicSalaryFromCommonCurve: salaryPoint.basic_salary,
            employeeRatePercent: assumptions.contributions.epfEmployeeContributionRate,
            employerRatePercent: assumptions.contributions.epfEmployerContributionRate,
            annualInterestCreditTodo: "Apply annual EPF crediting on 31 March.",
            eventDrawdownPlaceholder: true,
          },
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "ppf",
          opening_value: ppfOpen,
          contribution: ppfContribution,
          growth: ppfGrowth,
          withdrawal: ppfWithdrawal,
          closing_value: ppfClose,
          metadata: {
            priyeshMonthlyContribution: ppfMonthlyContribution,
            shobhanaAnnualContribution: ppfAnnualContribution,
            annualInterestCreditTodo: "Apply annual PPF crediting on 31 March.",
            eventDrawdownPlaceholder: true,
          },
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "nps",
          opening_value: npsOpen,
          contribution: npsContribution,
          growth: npsGrowth,
          withdrawal: npsWithdrawal,
          closing_value: npsClose,
          metadata: {
            basicSalaryFromCommonCurve: salaryPoint.basic_salary,
            contributionRatePercent: assumptions.contributions.npsContributionRate,
            splitPolicy: npsSplitPolicy,
            annuityIncomeTodo: "Model annuity income stream from NPS annuity allocation.",
          },
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "financial_assets_total",
          opening_value: financialOpen,
          contribution: financialContribution,
          growth: financialGrowth,
          withdrawal: financialWithdrawal,
          closing_value: financialClose,
          metadata: {
            components: ["cash", "mutual_funds", "stocks", "epf", "ppf", "nps"],
          },
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "non_financial_assets_total",
          opening_value: nonFinancialOpen,
          contribution: nonFinancialContribution,
          growth: nonFinancialGrowth,
          withdrawal: nonFinancialWithdrawal,
          closing_value: nonFinancialClose,
          metadata: {
            includesProperty: true,
            includesGold: true,
            drawdownEligible: false,
            propertyLiquidationAllowed: false,
          },
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "liabilities",
          opening_value: liabilitiesOpen,
          contribution: liabilitiesContribution,
          growth: liabilitiesGrowth,
          withdrawal: liabilitiesWithdrawal,
          closing_value: liabilitiesClose,
          metadata: {
            monthlyRepayment: liabilitiesWithdrawal,
          },
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "net_worth",
          opening_value: netWorthOpen,
          contribution: netWorthContribution,
          growth: netWorthGrowth,
          withdrawal: netWorthWithdrawal,
          closing_value: netWorthClose,
          metadata: {
            formula: "financial_assets_total + non_financial_assets_total - liabilities",
            drawdownOrder: eventDrawdownOrder,
          },
        },
      );

      cashOpen = cashClose;
      mutualFundsOpen = mutualFundsClose;
      stocksOpen = stocksClose;
      epfOpen = epfClose;
      ppfOpen = ppfClose;
      npsOpen = npsClose;
      nonFinancialOpen = nonFinancialClose;
      liabilitiesOpen = liabilitiesClose;
    }

    return monthlyRows;
  }
}

export const fixedProjectionService = new FixedProjectionService();
