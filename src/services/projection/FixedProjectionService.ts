import { SalaryProjectionService, type SalaryProjectionPoint } from "./SalaryProjectionService";
import { ProjectionVersioningService } from "./versioning/ProjectionVersioningService";
import { SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS } from "@/services/planning/assumptions/AssumptionRegistry";
import { groupMonthlyPositionRows, groupMonthlyPositionSnapshots } from "./ProjectionReadModel";
import type {
  CreateProjectionAssumptionSnapshotInput,
  ProjectionAssumptionSnapshotRecord,
  ProjectionMonthlyPositionRecord,
  ProjectionPlanVersionRecord,
  ProjectionSalaryCurveRecord,
  UpsertProjectionMonthlyPositionInput,
  UpsertProjectionSalaryCurveInput,
} from "./versioning/types";
import type { ProjectionViewerMonthRow, ProjectionViewerMonthSnapshot } from "./ProjectionReadModel";

const DEFAULT_FIXED_START_MONTH = "2026-07";
const DEFAULT_FIXED_HORIZON_END_MONTH = "2062-07";

const DEFAULT_EVENT_DRAWDOWN_ORDER: FixedProjectionBucketKey[] = ["cash", "mutual_funds", "ppf", "epf"];
const DEFAULT_POST_RETIREMENT_EXPENSE_REDUCTION_PERCENT = 20;
const DEFAULT_ANNUAL_EXPENSE_INFLATION_PERCENT = SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.generalInflation;
const DEFAULT_EPF_TRANSFER_TO_CASH_AFTER_RETIREMENT_YEARS = 3;

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
  currentNetSalary?: number;
  currentBasicSalary: number;
  annualIncrementPercent: number;
  incrementMonth?: number | null;
  retirementMonth?: string | null;
}

export interface FixedProjectionContributionAssumptions {
  mutualFundsMonthlySip: number;
  stocksMonthlySip?: number;
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
  annualExpenseInflationPercent?: number;
  postRetirementExpenseReductionPercent?: number;
  monthlyEmi: number;
  monthlyInsurancePremium: number;
  monthlyOtherRecurringCommitments?: number;
}

export interface FixedProjectionNpsSplitPolicy {
  lumpsumPercent: number;
  annuityPercent: number;
  postRetirementExpenseReductionPercent?: number;
}

export interface FixedProjectionOneTimeOutflow {
  id?: string;
  name: string;
  month: string;
  amount: number;
  category?: string;
  beneficiary?: string;
  source?: string;
}

export interface FixedProjectionAssumptions {
  salary: FixedProjectionSalaryAssumptions;
  contributions: FixedProjectionContributionAssumptions;
  returns: FixedProjectionReturnAssumptions;
  expenses: FixedProjectionExpenseAssumptions;
  npsSplitPolicy?: FixedProjectionNpsSplitPolicy;
  netSalaryIncludesEmployeeDeductions?: boolean;
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
  oneTimeOutflows?: FixedProjectionOneTimeOutflow[];
}

export interface CreateFixedProjectionV1Result {
  planVersion: ProjectionPlanVersionRecord;
  assumptionSnapshot: ProjectionAssumptionSnapshotRecord;
  salaryCurve: ProjectionSalaryCurveRecord[];
  monthlyPositions: ProjectionMonthlyPositionRecord[];
}

export interface FixedProjectionPreviewResult {
  input: CreateFixedProjectionV1Input;
  startMonth: string;
  horizonEndMonth: string;
  canFreeze: boolean;
  assumptionSnapshotInput: Omit<CreateProjectionAssumptionSnapshotInput, "projection_plan_version_id">;
  salaryCurveRows: Array<Omit<UpsertProjectionSalaryCurveInput, "projection_plan_version_id">>;
  monthlyPositionRows: Array<Omit<UpsertProjectionMonthlyPositionInput, "projection_plan_version_id">>;
  monthRows: ProjectionViewerMonthRow[];
  monthSnapshots: ProjectionViewerMonthSnapshot[];
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

function addMonthsToMonthKey(monthKey: string, monthsToAdd: number): string {
  if (!Number.isInteger(monthsToAdd) || monthsToAdd < 0) {
    throw new Error("monthsToAdd must be a non-negative integer.");
  }

  let cursor = parseMonthKey(monthKey);
  for (let index = 0; index < monthsToAdd; index += 1) {
    cursor = addMonth(cursor);
  }

  return formatMonthKey(cursor);
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

export function resolveAnnualExpenseInflationPercent(value: number | null | undefined): number {
  const resolved = value ?? DEFAULT_ANNUAL_EXPENSE_INFLATION_PERCENT;
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new Error("annualExpenseInflationPercent must be a non-negative finite number.");
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
    const preview = this.createFixedProjectionPreview(input);

    return this.freezeFixedProjectionV1Preview(preview);
  }

  createFixedProjectionPreview(input: CreateFixedProjectionV1Input): FixedProjectionPreviewResult {
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
    const annualExpenseInflationPercent = resolveAnnualExpenseInflationPercent(
      input.assumptions.expenses.annualExpenseInflationPercent,
    );

    const eventDrawdownOrder = input.assumptions.eventDrawdownOrder ?? DEFAULT_EVENT_DRAWDOWN_ORDER;
    const oneTimeOutflows = input.oneTimeOutflows ?? [];

    const assumptionSnapshotInput: Omit<CreateProjectionAssumptionSnapshotInput, "projection_plan_version_id"> = {
      assumption_payload: {
        startMonth,
        horizonEndMonth,
        openingBalances: input.openingBalances,
        salary: input.assumptions.salary,
        contributions: input.assumptions.contributions,
        returns: input.assumptions.returns,
        netSalaryIncludesEmployeeDeductions: input.assumptions.netSalaryIncludesEmployeeDeductions ?? true,
        liabilitiesMonthlyRepayment: input.assumptions.liabilitiesMonthlyRepayment ?? 0,
        expenses: {
          ...input.assumptions.expenses,
          monthlyOtherRecurringCommitments: input.assumptions.expenses.monthlyOtherRecurringCommitments ?? 0,
          annualExpenseInflationPercent,
          postRetirementExpenseReductionPercent,
        },
        oneTimeOutflows,
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
        epfTransferToCashAfterRetirementYears: DEFAULT_EPF_TRANSFER_TO_CASH_AFTER_RETIREMENT_YEARS,
        todos: [
          "EPF growth is applied monthly in V1 as a deterministic approximation to annual declared rates.",
          "PPF growth is applied monthly in V1 as a deterministic approximation to annual declared rates.",
          "NPS annuity income stream execution is deferred, policy structure is persisted.",
        ],
      },
      drawdown_policy_payload: {
        financialEventDrawdownOrder: eventDrawdownOrder,
        propertyLiquidationAllowed: false,
        notes: "Property and other non-financial assets are excluded from drawdown in Fixed Projection V1.",
      },
    };

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

    const salaryCurveUpsertRows: Array<Omit<UpsertProjectionSalaryCurveInput, "projection_plan_version_id">> = salaryCurveRows.map((row) => ({
      month_key: row.month_key,
      gross_salary: row.gross_salary,
      basic_salary: row.basic_salary,
      salary_growth_rate_used: row.salary_growth_rate_used,
      source: row.source,
    }));

    const monthlyPositions = this.buildMonthlyPositionsV1({
      projectionPlanVersionId: "preview",
      startMonth,
      horizonEndMonth,
      salaryCurve: salaryCurveRows,
      openingBalances: input.openingBalances,
      assumptions: input.assumptions,
      oneTimeOutflows,
      postRetirementExpenseReductionPercent,
      annualExpenseInflationPercent,
      eventDrawdownOrder,
      npsSplitPolicy,
    });

    const monthlyPositionRows: Array<Omit<UpsertProjectionMonthlyPositionInput, "projection_plan_version_id">> = monthlyPositions.map(
      ({ projection_plan_version_id: _projectionPlanVersionId, ...row }) => row,
    );

    const viewerRows = monthlyPositionRows.map((row) => ({
      month_key: row.month_key,
      bucket_key: row.bucket_key,
      closing_value: row.closing_value,
      metadata: row.metadata,
    }));

    return {
      input,
      startMonth,
      horizonEndMonth,
      canFreeze: true,
      assumptionSnapshotInput,
      salaryCurveRows: salaryCurveUpsertRows,
      monthlyPositionRows,
      monthRows: groupMonthlyPositionRows(viewerRows),
      monthSnapshots: groupMonthlyPositionSnapshots(viewerRows),
    };
  }

  async freezeFixedProjectionV1Preview(preview: FixedProjectionPreviewResult): Promise<CreateFixedProjectionV1Result> {
    const planVersion = await this.versioningService.createPlanVersion({
      household_id: preview.input.householdId ?? null,
      plan_kind: "FIXED",
      version_no: preview.input.versionNo,
      status: "DRAFT",
      start_month: preview.startMonth,
      horizon_end_month: preview.horizonEndMonth,
    });

    const assumptionSnapshot = await this.versioningService.upsertAssumptionSnapshot({
      projection_plan_version_id: planVersion.id,
      ...preview.assumptionSnapshotInput,
    });

    const persistedSalaryCurve = await this.versioningService.upsertSalaryCurve(
      preview.salaryCurveRows.map((row) => ({
        projection_plan_version_id: planVersion.id,
        month_key: row.month_key,
        gross_salary: row.gross_salary,
        basic_salary: row.basic_salary,
        salary_growth_rate_used: row.salary_growth_rate_used,
        source: row.source,
      })),
    );

    const persistedMonthlyPositions = await this.versioningService.upsertMonthlyPositions(
      preview.monthlyPositionRows.map((row) => ({
        projection_plan_version_id: planVersion.id,
        month_key: row.month_key,
        bucket_key: row.bucket_key,
        opening_value: row.opening_value,
        contribution: row.contribution,
        growth: row.growth,
        withdrawal: row.withdrawal,
        closing_value: row.closing_value,
        metadata: row.metadata,
      })),
    );

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
      [salary.currentNetSalary ?? salary.currentGrossSalary, "salary.currentNetSalary"],
      [salary.currentBasicSalary, "salary.currentBasicSalary"],
      [salary.annualIncrementPercent, "salary.annualIncrementPercent"],
      [contributions.mutualFundsMonthlySip, "contributions.mutualFundsMonthlySip"],
      [contributions.stocksMonthlySip ?? 0, "contributions.stocksMonthlySip"],
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
      [expenses.monthlyOtherRecurringCommitments ?? 0, "expenses.monthlyOtherRecurringCommitments"],
    ];

    for (const [index, outflow] of (input.oneTimeOutflows ?? []).entries()) {
      toFiniteNumber(outflow.amount, `oneTimeOutflows[${index}].amount`);
      if (!outflow.name.trim()) {
        throw new Error(`oneTimeOutflows[${index}].name is required.`);
      }
      parseMonthKey(outflow.month);
    }

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
    oneTimeOutflows: FixedProjectionOneTimeOutflow[];
    postRetirementExpenseReductionPercent: number;
    eventDrawdownOrder: FixedProjectionBucketKey[];
    npsSplitPolicy: FixedProjectionNpsSplitPolicy;
    annualExpenseInflationPercent: number;
  }): UpsertProjectionMonthlyPositionInput[] {
    const {
      projectionPlanVersionId,
      startMonth,
      horizonEndMonth,
      salaryCurve,
      openingBalances,
      assumptions,
      oneTimeOutflows,
      postRetirementExpenseReductionPercent,
      eventDrawdownOrder,
      npsSplitPolicy,
      annualExpenseInflationPercent,
    } = input;

    const months = listMonthKeys(startMonth, horizonEndMonth);
    const salaryByMonth = salaryCurveByMonth(salaryCurve);
    const monthlyNetToGrossRatio = input.assumptions.salary.currentGrossSalary > 0
      ? Math.min(1, Math.max(0, input.assumptions.salary.currentNetSalary ?? input.assumptions.salary.currentGrossSalary) / input.assumptions.salary.currentGrossSalary)
      : 0;
    const netSalaryIncludesEmployeeDeductions = input.assumptions.netSalaryIncludesEmployeeDeductions ?? true;
    const epfTransferMonth = assumptions.salary.retirementMonth
      ? addMonthsToMonthKey(
        assumptions.salary.retirementMonth,
        DEFAULT_EPF_TRANSFER_TO_CASH_AFTER_RETIREMENT_YEARS * 12 + 1,
      )
      : null;
    const npsSplitMonth = assumptions.salary.retirementMonth
      ? addMonthsToMonthKey(assumptions.salary.retirementMonth, 1)
      : null;
    const eligibleDrawdownOrder = eventDrawdownOrder.filter((bucketKey): bucketKey is "cash" | "mutual_funds" | "ppf" | "epf" => (
      bucketKey === "cash"
      || bucketKey === "mutual_funds"
      || bucketKey === "ppf"
      || bucketKey === "epf"
    ));
    const oneTimeOutflowRows = oneTimeOutflows ?? [];
    const oneTimeOutflowsByMonth = new Map<string, FixedProjectionOneTimeOutflow[]>();
    for (const outflow of oneTimeOutflowRows) {
      const monthOutflows = oneTimeOutflowsByMonth.get(outflow.month) ?? [];
      monthOutflows.push(outflow);
      oneTimeOutflowsByMonth.set(outflow.month, monthOutflows);
    }

    let cashOpen = roundCurrency(openingBalances.cash);
    let mutualFundsOpen = roundCurrency(openingBalances.mutualFunds);
    let stocksOpen = roundCurrency(openingBalances.stocks);
    let epfOpen = roundCurrency(openingBalances.epf);
    let ppfOpen = roundCurrency(openingBalances.ppf);
    let npsOpen = roundCurrency(openingBalances.nps);
    let nonFinancialOpen = roundCurrency(openingBalances.property + openingBalances.gold + openingBalances.otherNonFinancialAssets);
    let liabilitiesOpen = roundCurrency(openingBalances.liabilities);
    let npsSplitExecuted = false;
    let trackedNpsAnnuityCorpus = 0;

    const mutualFundsRate = annualPercentToMonthlyRate(assumptions.returns.mutualFundsAnnualReturnPercent);
    const stocksRate = annualPercentToMonthlyRate(assumptions.returns.stocksAnnualReturnPercent);
    const epfRate = annualPercentToMonthlyRate(assumptions.returns.epfAnnualReturnPercent);
    const ppfRate = annualPercentToMonthlyRate(assumptions.returns.ppfAnnualReturnPercent);
    const npsRate = annualPercentToMonthlyRate(assumptions.returns.npsAnnualReturnPercent);
    const nonFinancialRate = annualPercentToMonthlyRate(assumptions.returns.nonFinancialAnnualReturnPercent);
    const expenseInflationRate = annualPercentToMonthlyRate(annualExpenseInflationPercent);

    const monthlyRows: UpsertProjectionMonthlyPositionInput[] = [];

    for (const [monthIndex, monthKey] of months.entries()) {
      const salaryPoint = salaryByMonth.get(monthKey);
      if (!salaryPoint) {
        throw new Error(`Salary curve row missing for month ${monthKey}.`);
      }

      const retired = !salaryPoint.is_salary_active;
      const expenseMultiplier = retired ? 1 - postRetirementExpenseReductionPercent / 100 : 1;
      const inflatedPreRetirementExpense = roundCurrency(
        assumptions.expenses.preRetirementMonthlyExpense * (1 + expenseInflationRate) ** monthIndex,
      );
      const monthlyExpense = roundCurrency(inflatedPreRetirementExpense * expenseMultiplier);
      const monthlyEmi = roundCurrency(assumptions.expenses.monthlyEmi);
      const monthlyInsurancePremium = roundCurrency(assumptions.expenses.monthlyInsurancePremium);
      const monthlyOtherRecurringCommitments = roundCurrency(assumptions.expenses.monthlyOtherRecurringCommitments ?? 0);

      const epfEmployeeContribution = roundCurrency(salaryPoint.basic_salary * (assumptions.contributions.epfEmployeeContributionRate / 100));
      const epfEmployerContribution = roundCurrency(salaryPoint.basic_salary * (assumptions.contributions.epfEmployerContributionRate / 100));
      const epfContribution = roundCurrency(epfEmployeeContribution + epfEmployerContribution);
      const salaryLinkedSipActive = salaryPoint.is_salary_active;
      const npsEmployeeContribution = salaryLinkedSipActive
        ? roundCurrency(salaryPoint.basic_salary * (assumptions.contributions.npsContributionRate / 100))
        : 0;
      const npsContribution = npsEmployeeContribution;
      const mutualFundsContribution = salaryLinkedSipActive ? roundCurrency(assumptions.contributions.mutualFundsMonthlySip) : 0;
      const stocksContribution = salaryLinkedSipActive ? roundCurrency(assumptions.contributions.stocksMonthlySip ?? 0) : 0;

      const ppfMonthlyContribution = roundCurrency(assumptions.contributions.ppfMonthlyContributionPriyesh);
      const annualContributionMonth = assumptions.contributions.ppfAnnualContributionMonth ?? DEFAULT_PPF_ANNUAL_CONTRIBUTION_MONTH;
      const monthStamp = parseMonthKey(monthKey);
      const ppfAnnualContributionActive =
        monthStamp.month === annualContributionMonth &&
        (!assumptions.contributions.ppfContributionEndMonth || isMonthBeforeOrEqual(monthKey, assumptions.contributions.ppfContributionEndMonth));
      const ppfAnnualContribution = ppfAnnualContributionActive ? roundCurrency(assumptions.contributions.ppfAnnualContributionShobhana) : 0;
      const ppfContribution = roundCurrency(ppfMonthlyContribution + ppfAnnualContribution);

      const employeeRetirementContributionsToDeductFromCash = netSalaryIncludesEmployeeDeductions
        ? 0
        : roundCurrency(epfEmployeeContribution + npsEmployeeContribution);

      const monthlyIncome = roundCurrency(salaryPoint.gross_salary * monthlyNetToGrossRatio);
      const totalMonthlyCashOutflow = roundCurrency(
        monthlyExpense
        + monthlyEmi
        + monthlyInsurancePremium
        + mutualFundsContribution
        + stocksContribution
        + ppfContribution
        + employeeRetirementContributionsToDeductFromCash
        + monthlyOtherRecurringCommitments,
      );
      const monthlySurplusOrDeficit = roundCurrency(monthlyIncome - totalMonthlyCashOutflow);

      // Event execution is deferred in this phase. We persist drawdown policy and explicit zero drawdown placeholders.
      const eventDrawdownCash = 0;
      const eventDrawdownMutualFunds = 0;
      const eventDrawdownPpf = 0;
      const eventDrawdownEpf = 0;

      // Transfer EPF to cash in the first month after completing 36 full post-retirement months.
      const epfTransferredToCash = epfTransferMonth === monthKey && epfOpen > 0;
      const epfTransferAmount = epfTransferredToCash ? epfOpen : 0;

      const npsSplitEligible = Boolean(
        npsSplitMonth
        && retired
        && !npsSplitExecuted
        && isMonthBeforeOrEqual(npsSplitMonth, monthKey),
      );

      let npsGrowth = 0;
      let npsWithdrawal = 0;
      let npsLumpSumAmount = 0;
      let npsAnnuityCorpus = trackedNpsAnnuityCorpus;
      let npsSplitApplied = false;

      if (npsSplitEligible) {
        const splitCorpus = roundCurrency(nonNegative(npsOpen + npsContribution));
        npsLumpSumAmount = roundCurrency(splitCorpus * (npsSplitPolicy.lumpsumPercent / 100));
        npsAnnuityCorpus = roundCurrency(splitCorpus - npsLumpSumAmount);
        npsWithdrawal = npsLumpSumAmount;
        npsSplitApplied = true;
        npsSplitExecuted = true;
        trackedNpsAnnuityCorpus = npsAnnuityCorpus;
      } else if (!npsSplitExecuted) {
        npsGrowth = roundCurrency(npsOpen * npsRate);
      }

      const npsClose = npsSplitExecuted
        ? roundCurrency(nonNegative(npsAnnuityCorpus))
        : roundCurrency(nonNegative(npsOpen + npsContribution + npsGrowth - npsWithdrawal));

      const npsSplitMetadata = {
        npsSplitApplied,
        npsSplitMonth,
        npsLumpSumPercent: npsSplitPolicy.lumpsumPercent,
        npsAnnuityPercent: npsSplitPolicy.annuityPercent,
        npsLumpSumAmount,
        npsAnnuityCorpus,
        npsLumpSumTransferredToCash: npsLumpSumAmount > 0,
        npsAnnuityIncomeDeferred: npsSplitExecuted,
      };

      const cashContribution = roundCurrency(monthlySurplusOrDeficit + epfTransferAmount + npsLumpSumAmount);
      const cashGrowth = 0;
      const cashWithdrawal = roundCurrency(eventDrawdownCash);
      const cashClose = roundCurrency(nonNegative(cashOpen + cashContribution - cashWithdrawal));

      const mutualFundsGrowth = roundCurrency(mutualFundsOpen * mutualFundsRate);
      const mutualFundsWithdrawal = roundCurrency(eventDrawdownMutualFunds);
      const mutualFundsClose = roundCurrency(nonNegative(mutualFundsOpen + mutualFundsContribution + mutualFundsGrowth - mutualFundsWithdrawal));

      const stocksGrowth = roundCurrency(stocksOpen * stocksRate);
      const stocksWithdrawal = 0;
      const stocksClose = roundCurrency(nonNegative(stocksOpen + stocksContribution + stocksGrowth - stocksWithdrawal));

      const epfGrowth = epfTransferredToCash ? 0 : roundCurrency(epfOpen * epfRate);
      const epfWithdrawal = roundCurrency(eventDrawdownEpf + epfTransferAmount);
      const epfClose = roundCurrency(nonNegative(epfOpen + epfContribution + epfGrowth - epfWithdrawal));

      const ppfGrowth = roundCurrency(ppfOpen * ppfRate);
      const ppfWithdrawal = roundCurrency(eventDrawdownPpf);
      const ppfClose = roundCurrency(nonNegative(ppfOpen + ppfContribution + ppfGrowth - ppfWithdrawal));

      const monthOutflows = oneTimeOutflowsByMonth.get(monthKey) ?? [];
      const oneTimeOutflowAmount = roundCurrency(monthOutflows.reduce((sum, outflow) => sum + outflow.amount, 0));
      const oneTimeOutflowNames = monthOutflows.map((outflow) => outflow.name);

      let cashCloseAfterEvents = cashClose;
      let mutualFundsCloseAfterEvents = mutualFundsClose;
      let ppfCloseAfterEvents = ppfClose;
      let epfCloseAfterEvents = epfClose;
      let cashEventWithdrawal = 0;
      let mutualFundsEventWithdrawal = 0;
      let ppfEventWithdrawal = 0;
      let epfEventWithdrawal = 0;
      let remainingOutflowToFund = oneTimeOutflowAmount;
      const drawdownSources: Array<{ bucketKey: "cash" | "mutual_funds" | "ppf" | "epf"; amount: number }> = [];

      for (const bucketKey of eligibleDrawdownOrder) {
        if (remainingOutflowToFund <= 0) {
          break;
        }

        if (bucketKey === "cash") {
          const fundedAmount = roundCurrency(Math.min(remainingOutflowToFund, cashCloseAfterEvents));
          cashCloseAfterEvents = roundCurrency(cashCloseAfterEvents - fundedAmount);
          cashEventWithdrawal = roundCurrency(cashEventWithdrawal + fundedAmount);
          remainingOutflowToFund = roundCurrency(remainingOutflowToFund - fundedAmount);
          if (fundedAmount > 0) {
            drawdownSources.push({ bucketKey, amount: fundedAmount });
          }
          continue;
        }

        if (bucketKey === "mutual_funds") {
          const fundedAmount = roundCurrency(Math.min(remainingOutflowToFund, mutualFundsCloseAfterEvents));
          mutualFundsCloseAfterEvents = roundCurrency(mutualFundsCloseAfterEvents - fundedAmount);
          mutualFundsEventWithdrawal = roundCurrency(mutualFundsEventWithdrawal + fundedAmount);
          remainingOutflowToFund = roundCurrency(remainingOutflowToFund - fundedAmount);
          if (fundedAmount > 0) {
            drawdownSources.push({ bucketKey, amount: fundedAmount });
          }
          continue;
        }

        if (bucketKey === "ppf") {
          const fundedAmount = roundCurrency(Math.min(remainingOutflowToFund, ppfCloseAfterEvents));
          ppfCloseAfterEvents = roundCurrency(ppfCloseAfterEvents - fundedAmount);
          ppfEventWithdrawal = roundCurrency(ppfEventWithdrawal + fundedAmount);
          remainingOutflowToFund = roundCurrency(remainingOutflowToFund - fundedAmount);
          if (fundedAmount > 0) {
            drawdownSources.push({ bucketKey, amount: fundedAmount });
          }
          continue;
        }

        const fundedAmount = roundCurrency(Math.min(remainingOutflowToFund, epfCloseAfterEvents));
        epfCloseAfterEvents = roundCurrency(epfCloseAfterEvents - fundedAmount);
        epfEventWithdrawal = roundCurrency(epfEventWithdrawal + fundedAmount);
        remainingOutflowToFund = roundCurrency(remainingOutflowToFund - fundedAmount);
        if (fundedAmount > 0) {
          drawdownSources.push({ bucketKey, amount: fundedAmount });
        }
      }

      const drawdownApplied = roundCurrency(oneTimeOutflowAmount - remainingOutflowToFund);
      const unfundedOutflowAmount = roundCurrency(remainingOutflowToFund);
      const totalCashWithdrawal = roundCurrency(cashWithdrawal + cashEventWithdrawal);
      const totalMutualFundsWithdrawal = roundCurrency(mutualFundsWithdrawal + mutualFundsEventWithdrawal);
      const totalPpfWithdrawal = roundCurrency(ppfWithdrawal + ppfEventWithdrawal);
      const totalEpfWithdrawal = roundCurrency(epfWithdrawal + epfEventWithdrawal);

      const financialOpen = roundCurrency(cashOpen + mutualFundsOpen + stocksOpen + epfOpen + ppfOpen + npsOpen);
      const financialContribution = roundCurrency(monthlySurplusOrDeficit + mutualFundsContribution + stocksContribution + epfContribution + ppfContribution + npsContribution);
      const financialGrowth = roundCurrency(cashGrowth + mutualFundsGrowth + stocksGrowth + epfGrowth + ppfGrowth + npsGrowth);
      const financialWithdrawal = roundCurrency(cashEventWithdrawal + mutualFundsEventWithdrawal + stocksWithdrawal + epfEventWithdrawal + ppfEventWithdrawal + npsWithdrawal);
      const financialClose = roundCurrency(cashCloseAfterEvents + mutualFundsCloseAfterEvents + stocksClose + epfCloseAfterEvents + ppfCloseAfterEvents + npsClose);

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

      const outflowMetadata = {
        oneTimeOutflowAmount,
        oneTimeOutflowNames,
        drawdownApplied,
        drawdownSources,
        unfundedOutflowAmount,
      };

      monthlyRows.push(
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "cash",
          opening_value: cashOpen,
          contribution: cashContribution,
          growth: cashGrowth,
          withdrawal: totalCashWithdrawal,
          closing_value: cashCloseAfterEvents,
          metadata: {
            salaryIncomeFromCommonCurve: monthlyIncome,
            salaryIncomeSource: "Compensation net take-home (projected from gross curve using currentNetSalary/currentGrossSalary ratio)",
            salaryGrossFromCommonCurve: salaryPoint.gross_salary,
            salaryNetToGrossRatioApplied: monthlyNetToGrossRatio,
            expenseApplied: totalMonthlyCashOutflow,
            monthlyTotalCashOutflow: totalMonthlyCashOutflow,
            livingExpenseApplied: monthlyExpense,
            monthlyEmiApplied: monthlyEmi,
            monthlyInsurancePremiumApplied: monthlyInsurancePremium,
            mutualFundsSipApplied: mutualFundsContribution,
            stocksSipApplied: stocksContribution,
            ppfContributionApplied: ppfContribution,
            npsEmployeeContributionApplied: npsEmployeeContribution,
            epfEmployeeContributionApplied: epfEmployeeContribution,
            monthlyOtherRecurringCommitmentsApplied: monthlyOtherRecurringCommitments,
            employeeRetirementContributionsDeductedFromCash: employeeRetirementContributionsToDeductFromCash,
            netSalaryIncludesEmployeeDeductions,
            monthlySurplusOrDeficit,
            cashGrowthApplied: cashGrowth,
            epfTransferredToCash,
            epfTransferAmount,
            epfTransferMonth,
            salaryLinkedSipActive,
            ...npsSplitMetadata,
            ...outflowMetadata,
            expenseInflationAppliedPercent: annualExpenseInflationPercent,
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
          withdrawal: totalMutualFundsWithdrawal,
          closing_value: mutualFundsCloseAfterEvents,
          metadata: {
            salaryLinkedSipActive,
            ...outflowMetadata,
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
          metadata: {
            salaryLinkedSipActive,
            ...outflowMetadata,
          },
        },
        {
          projection_plan_version_id: projectionPlanVersionId,
          month_key: monthKey,
          bucket_key: "epf",
          opening_value: epfOpen,
          contribution: epfContribution,
          growth: epfGrowth,
          withdrawal: totalEpfWithdrawal,
          closing_value: epfCloseAfterEvents,
          metadata: {
            basicSalaryFromCommonCurve: salaryPoint.basic_salary,
            employeeRatePercent: assumptions.contributions.epfEmployeeContributionRate,
            employerRatePercent: assumptions.contributions.epfEmployerContributionRate,
            employeeContributionAmount: epfEmployeeContribution,
            employerContributionAmount: epfEmployerContribution,
            annualizedReturnPercent: assumptions.returns.epfAnnualReturnPercent,
            epfTransferredToCash,
            epfTransferAmount,
            epfTransferMonth,
            epfTransferRule: epfTransferMonth
              ? `Transfer at the start of ${epfTransferMonth} after 36 full post-retirement months.`
              : null,
            salaryLinkedSipActive,
            ...outflowMetadata,
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
          withdrawal: totalPpfWithdrawal,
          closing_value: ppfCloseAfterEvents,
          metadata: {
            priyeshMonthlyContribution: ppfMonthlyContribution,
            shobhanaAnnualContribution: ppfAnnualContribution,
            annualizedReturnPercent: assumptions.returns.ppfAnnualReturnPercent,
            ...outflowMetadata,
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
            employeeContributionAmount: npsEmployeeContribution,
            splitPolicy: npsSplitPolicy,
            ...npsSplitMetadata,
            ...outflowMetadata,
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
            internalTransfersExcludedFromContributionAndWithdrawal: epfTransferAmount > 0,
            epfTransferAmount,
            ...outflowMetadata,
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
            ...outflowMetadata,
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
            ...outflowMetadata,
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
            ...outflowMetadata,
          },
        },
      );

      cashOpen = cashCloseAfterEvents;
      mutualFundsOpen = mutualFundsCloseAfterEvents;
      stocksOpen = stocksClose;
      epfOpen = epfCloseAfterEvents;
      ppfOpen = ppfCloseAfterEvents;
      npsOpen = npsClose;
      nonFinancialOpen = nonFinancialClose;
      liabilitiesOpen = liabilitiesClose;
    }

    return monthlyRows;
  }
}

export const fixedProjectionService = new FixedProjectionService();
