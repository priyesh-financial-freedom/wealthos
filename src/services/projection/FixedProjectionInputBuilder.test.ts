import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Account } from "@/types/account";
import type { Asset } from "@/types/asset";
import type { AssumptionsBundle } from "@/types/assumptions";
import type { BankAccount } from "@/types/bankAccount";
import type { CashFlowSnapshot } from "@/services/cashFlowManagement";
import type { CompensationSummary } from "@/services/compensation";
import type { EffectivePlanningAssumptions, PlanningFamilyProfile } from "@/services/planning/assumptions";
import type { FixedDeposit } from "@/types/fixedDeposit";
import type { GoldHolding } from "@/types/goldHolding";
import type { Investment } from "@/types/investment";
import type { Liability } from "@/types/liability";
import type { RealEstateProperty } from "@/types/realEstateProperty";
import type { RetirementAccount } from "@/types/retirementAccount";
import type { SilverHolding } from "@/types/silverHolding";

import { FixedProjectionInputBuilder } from "./FixedProjectionInputBuilder";
import { FixedProjectionService } from "./FixedProjectionService";
import { SalaryProjectionService } from "./SalaryProjectionService";
import type { LoadedProjectionData } from "./PlanningEntityAggregator";
import type {
  ProjectionAssumptionSnapshotRecord,
  ProjectionMonthlyPositionRecord,
  ProjectionPlanVersionRecord,
  ProjectionSalaryCurveRecord,
  UpsertProjectionMonthlyPositionInput,
  UpsertProjectionSalaryCurveInput,
} from "./versioning/types";

class InMemoryProjectionVersioningService {
  private idCounter = 1;

  plans = new Map<string, ProjectionPlanVersionRecord>();

  async createPlanVersion(input: {
    household_id?: string | null;
    plan_kind: "FIXED" | "ROLLING" | "WHAT_IF";
    version_no: number;
    status?: "DRAFT" | "LOCKED" | "ARCHIVED";
    start_month: string;
    horizon_end_month: string;
  }): Promise<ProjectionPlanVersionRecord> {
    const id = `plan-${this.idCounter++}`;
    const now = new Date().toISOString();
    const record: ProjectionPlanVersionRecord = {
      id,
      user_id: "user-1",
      household_id: input.household_id ?? null,
      plan_kind: input.plan_kind,
      version_no: input.version_no,
      status: input.status ?? "DRAFT",
      start_month: input.start_month,
      horizon_end_month: input.horizon_end_month,
      base_close_id: null,
      parent_fixed_version_id: null,
      locked_at: null,
      created_at: now,
      updated_at: now,
    };

    this.plans.set(id, record);
    return record;
  }

  async upsertAssumptionSnapshot(input: {
    projection_plan_version_id: string;
    assumption_payload: Record<string, unknown>;
    salary_policy_payload: Record<string, unknown>;
    retirement_policy_payload: Record<string, unknown>;
    drawdown_policy_payload: Record<string, unknown>;
  }): Promise<ProjectionAssumptionSnapshotRecord> {
    return {
      id: `snapshot-${this.idCounter++}`,
      projection_plan_version_id: input.projection_plan_version_id,
      assumption_payload: input.assumption_payload,
      salary_policy_payload: input.salary_policy_payload,
      retirement_policy_payload: input.retirement_policy_payload,
      drawdown_policy_payload: input.drawdown_policy_payload,
      checksum: null,
      created_at: new Date().toISOString(),
    };
  }

  async upsertSalaryCurve(rows: UpsertProjectionSalaryCurveInput[]): Promise<ProjectionSalaryCurveRecord[]> {
    return rows.map((row) => ({
      id: `curve-${this.idCounter++}`,
      projection_plan_version_id: row.projection_plan_version_id,
      month_key: row.month_key,
      gross_salary: row.gross_salary,
      basic_salary: row.basic_salary,
      salary_growth_rate_used: row.salary_growth_rate_used,
      source: row.source,
      created_at: new Date().toISOString(),
    }));
  }

  async upsertMonthlyPositions(rows: UpsertProjectionMonthlyPositionInput[]): Promise<ProjectionMonthlyPositionRecord[]> {
    return rows.map((row) => ({
      id: `position-${this.idCounter++}`,
      projection_plan_version_id: row.projection_plan_version_id,
      month_key: row.month_key,
      bucket_key: row.bucket_key,
      opening_value: row.opening_value,
      contribution: row.contribution,
      growth: row.growth,
      withdrawal: row.withdrawal,
      closing_value: row.closing_value,
      metadata: row.metadata ?? {},
      created_at: new Date().toISOString(),
    }));
  }

  async lockPlanVersion(id: string): Promise<ProjectionPlanVersionRecord> {
    const plan = this.plans.get(id);
    if (!plan) {
      throw new Error("Projection plan version not found.");
    }

    return {
      ...plan,
      status: "LOCKED",
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
}

function buildAssumptionsBundle(): AssumptionsBundle {
  return {
    income: {
      monthlyIncome: 0,
      annualIncrementRate: 10,
      salaryGrowthRate: 10,
      bonusAmount: 0,
      bonusMonth: 3,
      otherMonthlyIncome: 0,
      salaryStopMonth: 12,
      salaryStopYear: 2050,
    },
    investments: {
      monthlySipAmount: 15000,
      stockInvestmentAmount: 7000,
      annualIncrementRate: 10,
      expectedReturnRate: 12,
      fixedDepositRate: 7,
      goldAppreciationRate: 5,
      realEstateAppreciationRate: 6,
    },
    inflation: {
      generalInflationRate: 6,
      educationInflationRate: 10,
      healthcareInflationRate: 8,
      retirementInflationRate: 6,
    },
    loans: {
      averageInterestRate: 8,
      emiIncrementRate: 0,
      annualPrepaymentAmount: 0,
      annualPrepaymentMonth: 3,
      useExtraCashForPrepayment: false,
    },
    retirement: {
      epfEmployeeContributionRate: 12,
      epfEmployerContributionRate: 12,
      npsContributionRate: 7.5,
      ppfMonthlyContribution: 5000,
      retirementTargetAge: 60,
      salaryStopMonth: 12,
      salaryStopYear: 2050,
    },
    tax: {
      regime: "new",
      effectiveTaxRate: 10,
      surchargeRate: 0,
      cessRate: 0,
      note: "test",
    },
    planning: {
      startMonth: "2026-07",
      endYear: 2060,
      endMonth: 6,
    },
  };
}

function buildEffectiveAssumptions(overrides?: Record<string, unknown>): EffectivePlanningAssumptions {
  return {
    currentAge: 36,
    retirementAge: 60,
    lifeExpectancy: 90,
    spouseLifeExpectancy: 92,
    salaryGrowthRate: 10,
    bonusGrowthRate: 6,
    businessIncomeGrowth: 0,
    rentalIncomeGrowth: 0,
    otherIncomeGrowth: 0,
    generalInflation: 6,
    medicalInflation: 8,
    educationInflation: 10,
    lifestyleInflation: 6,
    propertyInflation: 5,
    luxuryInflation: 6,
    equityReturn: 12,
    debtReturn: 7,
    goldReturn: 5,
    silverReturn: 4,
    realEstateReturn: 6,
    cashReturn: 4,
    monthlySipAmount: 15000,
    epfReturn: 8,
    ppfReturn: 7.1,
    npsEquityReturn: 11,
    npsDebtReturn: 7,
    homeLoanInterest: 8,
    annualPrepaymentAmount: 0,
    carLoanInterest: 9,
    personalLoanInterest: 12,
    loanPrepaymentStrategy: "NONE",
    incomeTaxRate: 10,
    capitalGainsTax: 10,
    dividendTax: 10,
    rentalTaxRate: 0,
    withdrawalRate: 4,
    retirementExpenseRatio: 80,
    legacyTarget: 0,
    emergencyCorpusMonths: 12,
    goalFundingPriority: "medium",
    ...(overrides as Partial<EffectivePlanningAssumptions>),
  } as EffectivePlanningAssumptions;
}

function buildCompensationSummary(overrides?: Partial<CompensationSummary>): CompensationSummary {
  return {
    profile: {
      employer: "Acme",
      grossSalaryPerMonth: 100000,
      effectiveMonth: "2026-07",
      annualIncrementPercent: 10,
      incrementMonth: 4,
      basicPercentOfGross: 40,
      employeePfPercent: 12,
      vpfPercent: 0,
      employerEpfPercent: 12,
      professionalTax: 0,
      incomeTaxPercent: 0,
      currentNps: 3000,
      annualBonus: 0,
      bonusMonth: 3,
    },
    basicSalary: 40000,
    employeePf: 4800,
    vpf: 0,
    employerEpf: 4800,
    professionalTax: 0,
    incomeTax: 0,
    nps: 3000,
    netMonthlySalary: 92200,
    monthlyBonusEquivalent: 0,
    annualGross: 1200000,
    annualFixedCompensation: 1200000,
    ...overrides,
  };
}

function buildFamilyProfile(overrides?: Partial<PlanningFamilyProfile>): PlanningFamilyProfile {
  return {
    primaryDateOfBirth: "1990-05-01",
    spouseDateOfBirth: "1992-08-01",
    primaryCurrentAge: 36,
    spouseCurrentAge: 34,
    updatedAt: null,
    ...overrides,
  };
}

function buildCashFlowSnapshot(overrides?: Partial<CashFlowSnapshot>): CashFlowSnapshot {
  return {
    incomeEntries: [],
    manualExpenseEntries: [
      {
        id: "expense-1",
        name: "Household",
        category: "Household",
        monthlyAmount: 40000,
        annualInflation: 6,
        startDate: "2026-07-01",
        status: "Active",
        notes: null,
      },
      {
        id: "expense-2",
        name: "Insurance",
        category: "Insurance",
        monthlyAmount: 5000,
        annualInflation: 0,
        startDate: "2026-07-01",
        status: "Active",
        notes: null,
      },
    ],
    automaticCommitments: [],
    incomeBreakdown: {
      salary: 0,
      bonusMonthlyEquivalent: 0,
      rentalIncome: 0,
      interestIncome: 0,
      dividendOtherIncome: 0,
      totalMonthlyIncome: 0,
    },
    commitmentGroups: [],
    livingExpense: {
      id: "expense-1",
      monthlyAmount: 45000,
      notes: null,
    },
    summary: {
      monthlyIncome: 0,
      monthlyAutomaticCommitments: 0,
      monthlyManualExpenses: 45000,
      monthlyExpenses: 45000,
      monthlySavings: -45000,
      savingsRate: 0,
    },
    ...overrides,
  };
}

function buildLoadedData(overrides?: Partial<LoadedProjectionData>): LoadedProjectionData {
  const bankAccounts: BankAccount[] = [
    {
      id: "bank-1",
      user_id: "user-1",
      account_name: "Savings",
      account_type: "savings",
      bank_name: "Bank",
      current_balance: 150000,
      opening_balance: 100000,
      interest_rate: null,
      account_number: "1234",
      ifsc_code: null,
      branch_name: null,
      owner: "Priyesh",
      notes: null,
      status: "active",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      masked_account_number: "1234",
    },
  ];
  const assets: Asset[] = [];
  const investments: Investment[] = [
    {
      id: "mf-1",
      user_id: "user-1",
      owner: "Priyesh",
      institution: "AMC",
      investment_name: "MF",
      investment_type: "Mutual Funds",
      category: "Mutual Funds",
      acquisition_date: "2025-01-01",
      cost_value: 200000,
      current_value: 300000,
      status: "active",
      notes: null,
      documents_placeholder: null,
      monthly_change: 0,
      current_month_value: 300000,
      previous_month_value: 290000,
      cost_basis: 200000,
      purchase_date: "2025-01-01",
      units: 0,
      nav_price: 0,
      today_gain_loss: 0,
      sector: null,
      amc: "AMC",
      region: "Domestic",
      folio_number: null,
      amfi_scheme_code: null,
      sip_amount: 15000,
      sip_date: 5,
      investment_mode: "Direct",
      option_type: "Growth",
      broker_platform: null,
      risk_level: "Moderate",
      benchmark: null,
      expense_ratio: null,
      exit_load: null,
      xirr: null,
      cagr: null,
      unrealized_gain_loss: 0,
      realized_gain_loss: 0,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
    {
      id: "stock-1",
      user_id: "user-1",
      owner: "Priyesh",
      institution: "Broker",
      investment_name: "Stock",
      investment_type: "Stocks",
      category: "Stocks",
      acquisition_date: "2025-01-01",
      cost_value: 100000,
      current_value: 200000,
      status: "active",
      notes: null,
      documents_placeholder: null,
      monthly_change: 0,
      current_month_value: 200000,
      previous_month_value: 180000,
      cost_basis: 100000,
      purchase_date: "2025-01-01",
      units: 0,
      nav_price: 0,
      today_gain_loss: 0,
      sector: null,
      amc: null,
      region: "Domestic",
      folio_number: null,
      amfi_scheme_code: null,
      sip_amount: 7000,
      sip_date: 10,
      investment_mode: null,
      option_type: null,
      broker_platform: null,
      risk_level: "High",
      benchmark: null,
      expense_ratio: null,
      exit_load: null,
      xirr: null,
      cagr: null,
      unrealized_gain_loss: 0,
      realized_gain_loss: 0,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ];
  const realEstate: RealEstateProperty[] = [
    {
      id: "re-1",
      user_id: "user-1",
      property_name: "Home",
      property_type: "apartment",
      ownership_type: "self",
      owner: "Priyesh",
      purchase_price: 1500000,
      current_market_value: 2000000,
      purchase_date: null,
      address: null,
      occupancy_status: "self_occupied",
      monthly_rent: 0,
      notes: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ];
  const retirementAccounts: RetirementAccount[] = [
    {
      id: "epf-1",
      user_id: "user-1",
      account_type: "EPF",
      owner: "Priyesh",
      institution: "EPFO",
      current_balance: 400000,
      account_number: null,
      opening_date: null,
      interest_rate: null,
      nominee: null,
      notes: null,
      contribution_frequency: "Monthly",
      contribution_amount: 9600,
      contribution_day: null,
      contribution_month: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      employer: "Acme",
      uan: null,
      employee_contribution: 4800,
      employer_contribution: 4800,
    },
    {
      id: "ppf-1",
      user_id: "user-1",
      account_type: "PPF",
      owner: "Priyesh",
      institution: "Bank",
      current_balance: 120000,
      account_number: null,
      opening_date: null,
      interest_rate: null,
      nominee: null,
      notes: null,
      contribution_frequency: "Monthly",
      contribution_amount: 5000,
      contribution_day: null,
      contribution_month: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      maturity_date: "2040-04-01",
    },
    {
      id: "ppf-2",
      user_id: "user-1",
      account_type: "PPF",
      owner: "Shobhana",
      institution: "Bank",
      current_balance: 80000,
      account_number: null,
      opening_date: null,
      interest_rate: null,
      nominee: null,
      notes: null,
      contribution_frequency: "Annual",
      contribution_amount: 60000,
      contribution_day: null,
      contribution_month: "April",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      maturity_date: "2041-04-01",
    },
    {
      id: "nps-1",
      user_id: "user-1",
      account_type: "NPS",
      owner: "Priyesh",
      institution: "NPS",
      current_balance: 150000,
      account_number: null,
      opening_date: null,
      interest_rate: null,
      nominee: null,
      notes: null,
      contribution_frequency: "Monthly",
      contribution_amount: 3000,
      contribution_day: null,
      contribution_month: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      pran: null,
      pop: null,
      equity_percent: 75,
      corporate_debt_percent: 15,
      government_securities_percent: 10,
      alternative_assets_percent: 0,
    },
  ];
  const fixedDeposits: FixedDeposit[] = [];
  const goldHoldings: GoldHolding[] = [
    {
      id: "gold-1",
      user_id: "user-1",
      asset_name: "Gold",
      quantity: 1,
      unit: "gram",
      cost_basis: 50000,
      current_value: 100000,
      owner: "Priyesh",
      notes: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ];
  const silverHoldings: SilverHolding[] = [
    {
      id: "silver-1",
      user_id: "user-1",
      asset_name: "Silver",
      quantity: 1,
      unit: "gram",
      cost_basis: 10000,
      current_value: 50000,
      owner: "Priyesh",
      notes: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ];
  const liabilities: Liability[] = [
    {
      id: "loan-1",
      user_id: "user-1",
      liability_type: "Home Loan",
      lender: "Bank",
      account_name: "Home Loan",
      outstanding_amount: 900000,
      original_amount: 1000000,
      interest_rate: 8,
      emi: 20000,
      start_date: null,
      end_date: null,
      due_day: null,
      due_date: null,
      tenure_months: null,
      credit_limit: null,
      sanction_limit: null,
      owner: "Priyesh",
      primary_borrower: null,
      co_borrower: null,
      prepayment_allowed: null,
      prepayment_done_till_date: null,
      future_prepayment_plan: null,
      estimated_interest_saved: null,
      revised_closure_date: null,
      review_date: null,
      status: "active",
      notes: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    },
  ];
  const insuranceAccounts: Account[] = [];

  return {
    assets,
    liabilities,
    bankAccounts,
    investments,
    realEstate,
    retirementAccounts,
    fixedDeposits,
    goldHoldings,
    silverHoldings,
    insuranceAccounts,
    ...overrides,
  };
}

function buildDependencies(overrides?: {
  loadedData?: LoadedProjectionData;
  effectiveAssumptions?: EffectivePlanningAssumptions;
  compensatedBundle?: AssumptionsBundle;
  familyProfile?: PlanningFamilyProfile;
  compensationSummary?: CompensationSummary | null;
  cashFlowSnapshot?: CashFlowSnapshot;
}) {
  return {
    loadProjectionData: vi.fn(async () => overrides?.loadedData ?? buildLoadedData()),
    getEffectiveAssumptions: vi.fn(async () => overrides?.effectiveAssumptions ?? buildEffectiveAssumptions({ stocksReturn: 13 })),
    getCompensatedAssumptionsBundle: vi.fn(async () => overrides?.compensatedBundle ?? buildAssumptionsBundle()),
    getFamilyProfile: vi.fn(async () => overrides?.familyProfile ?? buildFamilyProfile()),
    getCompensationSummary: vi.fn(async () => overrides?.compensationSummary ?? buildCompensationSummary()),
    getCashFlowSnapshot: vi.fn(async () => overrides?.cashFlowSnapshot ?? buildCashFlowSnapshot()),
  };
}

describe("FixedProjectionInputBuilder", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds input from mocked read services", async () => {
    const builder = new FixedProjectionInputBuilder(buildDependencies());

    const result = await builder.buildFixedProjectionInput();

    expect(result.validation.canPreview).toBe(true);
    expect(result.validation.canFreeze).toBe(true);
    expect(result.input).not.toBeNull();
    expect(result.input?.startMonth).toBe("2026-07");
    expect(result.input?.horizonEndMonth).toBe("2060-06");
    expect(result.input?.assumptions.salary.retirementMonth).toBe("2050-05");
    expect(result.input?.openingBalances.cash).toBe(150000);
    expect(result.input?.openingBalances.mutualFunds).toBe(300000);
    expect(result.input?.openingBalances.stocks).toBe(200000);
    expect(result.input?.openingBalances.epf).toBe(400000);
    expect(result.input?.openingBalances.ppf).toBe(200000);
    expect(result.input?.openingBalances.nps).toBe(150000);
    expect(result.input?.openingBalances.property).toBe(2000000);
    expect(result.input?.openingBalances.gold).toBe(100000);
    expect(result.input?.openingBalances.otherNonFinancialAssets).toBe(50000);
    expect(result.input?.openingBalances.liabilities).toBe(900000);
    expect(result.input?.assumptions.expenses.preRetirementMonthlyExpense).toBe(40000);
    expect(result.input?.assumptions.expenses.monthlyInsurancePremium).toBe(5000);
    expect(result.input?.assumptions.returns.stocksAnnualReturnPercent).toBe(13);
    expect(result.input?.assumptions.returns.npsAnnualReturnPercent).toBe(10);
    expect(result.input?.assumptions.returns.nonFinancialAnnualReturnPercent).toBeCloseTo(5.91, 2);
    expect(result.validation.warnings).toContain("Monthly stock contributions are unsupported in Fixed Projection V1 and are set to 0.");
    expect(result.validation.defaultsUsed).toContain("versionNo is hardcoded to 1 for the initial Fixed Projection workflow.");
  });

  it("reports blockers for missing retirement month", async () => {
    const builder = new FixedProjectionInputBuilder(buildDependencies({
      familyProfile: buildFamilyProfile({
        primaryDateOfBirth: null,
        primaryCurrentAge: Number.NaN,
      }),
    }));

    const result = await builder.buildFixedProjectionInput();

    expect(result.input).toBeNull();
    expect(result.validation.canPreview).toBe(false);
    expect(result.validation.canFreeze).toBe(false);
    expect(result.validation.blockers).toContain("Retirement month is missing.");
  });

  it("reports blocker for missing stocks return assumption", async () => {
    const builder = new FixedProjectionInputBuilder(buildDependencies({
      effectiveAssumptions: buildEffectiveAssumptions(),
    }));

    const result = await builder.buildFixedProjectionInput();

    expect(result.input).not.toBeNull();
    expect(result.input?.assumptions.returns.stocksAnnualReturnPercent).toBe(11);
    expect(result.validation.blockers).not.toContain("Stocks Return % is missing.");
    expect(result.validation.defaultsUsed).toContain("stocksAnnualReturnPercent defaulted to 11% because no user-configured stocks return exists.");
    expect(result.sourceReport).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "stocksAnnualReturnPercent", status: "default" }),
    ]));
  });

  it("falls back to default NPS return when allocation data cannot be used", async () => {
    const loadedData = buildLoadedData({
      retirementAccounts: buildLoadedData().retirementAccounts.map((account) => (
        account.account_type === "NPS"
          ? {
            ...account,
            alternative_assets_percent: 5,
          }
          : account
      )),
    });

    const builder = new FixedProjectionInputBuilder(buildDependencies({ loadedData }));
    const result = await builder.buildFixedProjectionInput();

    expect(result.input).not.toBeNull();
    expect(result.input?.assumptions.returns.npsAnnualReturnPercent).toBe(9);
    expect(result.validation.blockers).not.toContain("NPS Return % is missing.");
    expect(result.sourceReport).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "npsAnnualReturnPercent", status: "default" }),
    ]));
  });

  it("falls back to default non-financial return when weighted blend inputs are invalid", async () => {
    const builder = new FixedProjectionInputBuilder(buildDependencies({
      effectiveAssumptions: buildEffectiveAssumptions({
        stocksReturn: 13,
        goldReturn: Number.NaN,
      }),
    }));

    const result = await builder.buildFixedProjectionInput();

    expect(result.input).not.toBeNull();
    expect(result.input?.assumptions.returns.nonFinancialAnnualReturnPercent).toBe(5);
    expect(result.validation.blockers).not.toContain("Property / non-financial return % is missing.");
    expect(result.sourceReport).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "nonFinancialAnnualReturnPercent", status: "default" }),
    ]));
  });

  it("keeps insurance premium as freeze blocker when no source is configured while allowing preview", async () => {
    const builder = new FixedProjectionInputBuilder(buildDependencies({
      cashFlowSnapshot: buildCashFlowSnapshot({
        manualExpenseEntries: [
          {
            id: "expense-1",
            name: "Household",
            category: "Household",
            monthlyAmount: 40000,
            annualInflation: 6,
            startDate: "2026-07-01",
            status: "Active",
            notes: null,
          },
        ],
        automaticCommitments: [],
      }),
    }));

    const result = await builder.buildFixedProjectionInput();

    expect(result.input).not.toBeNull();
    expect(result.validation.canPreview).toBe(true);
    expect(result.validation.canFreeze).toBe(false);
    expect(result.validation.blockers).toContain("Insurance premium is required before freezing Fixed Projection unless explicitly confirmed zero.");
    expect(result.validation.warnings).toContain("Insurance premium source is not configured.");
    expect(result.input?.assumptions.expenses.monthlyInsurancePremium).toBe(0);
    expect(result.sourceReport).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "monthlyInsurancePremium", status: "missing" }),
    ]));
  });

  it("reports blocker for missing monthly expenses", async () => {
    const builder = new FixedProjectionInputBuilder(buildDependencies({
      cashFlowSnapshot: buildCashFlowSnapshot({
        manualExpenseEntries: [
          {
            id: "expense-insurance",
            name: "Insurance",
            category: "Insurance",
            monthlyAmount: 5000,
            annualInflation: 0,
            startDate: "2026-07-01",
            status: "Active",
            notes: null,
          },
        ],
      }),
    }));

    const result = await builder.buildFixedProjectionInput();

    expect(result.input).toBeNull();
    expect(result.validation.blockers).toContain("Monthly expenses are missing.");
  });

  it("reports warning for unsupported stock contribution", async () => {
    const builder = new FixedProjectionInputBuilder(buildDependencies());

    const result = await builder.buildFixedProjectionInput();

    expect(result.validation.warnings).toContain("Monthly stock contributions are unsupported in Fixed Projection V1 and are set to 0.");
    expect(result.sourceReport).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldName: "monthlyStockContribution" }),
    ]));
  });

  it("produces an input shape accepted by FixedProjectionService", async () => {
    const builder = new FixedProjectionInputBuilder(buildDependencies());
    const result = await builder.buildFixedProjectionInput();
    const versioning = new InMemoryProjectionVersioningService();
    const service = new FixedProjectionService(versioning as never, new SalaryProjectionService());

    const projection = await service.createFixedProjectionV1(result.input!);

    expect(projection.planVersion.status).toBe("LOCKED");
    expect(projection.monthlyPositions.length).toBeGreaterThan(0);
  });

  it("does not construct projection persistence services", async () => {
    vi.resetModules();
    const versioningCtor = vi.fn(() => ({
      createPlanVersion: vi.fn(),
      upsertAssumptionSnapshot: vi.fn(),
      upsertSalaryCurve: vi.fn(),
      upsertMonthlyPositions: vi.fn(),
      lockPlanVersion: vi.fn(),
    }));

    vi.doMock("./versioning/ProjectionVersioningService", () => ({
      ProjectionVersioningService: versioningCtor,
    }));

    const { FixedProjectionInputBuilder: DynamicBuilder } = await import("./FixedProjectionInputBuilder");
    const builder = new DynamicBuilder(buildDependencies());

    await builder.buildFixedProjectionInput();

    expect(versioningCtor).not.toHaveBeenCalled();
  });

  it("includes source report rows for all key fields", async () => {
    const builder = new FixedProjectionInputBuilder(buildDependencies());

    const result = await builder.buildFixedProjectionInput();
    const fieldNames = result.sourceReport.map((entry) => entry.fieldName);

    expect(fieldNames).toEqual(expect.arrayContaining([
      "startMonth",
      "horizonEndMonth",
      "retirementMonth",
      "cash",
      "mutualFunds",
      "stocks",
      "epf",
      "ppf",
      "nps",
      "property",
      "gold",
      "otherNonFinancialAssets",
      "liabilities",
      "currentGrossSalary",
      "currentBasicSalary",
      "annualIncrementPercent",
      "preRetirementMonthlyExpense",
      "monthlyEmi",
      "monthlyInsurancePremium",
      "mutualFundsMonthlySip",
      "cashAnnualReturnPercent",
      "mutualFundsAnnualReturnPercent",
      "stocksAnnualReturnPercent",
      "epfAnnualReturnPercent",
      "ppfAnnualReturnPercent",
      "npsAnnualReturnPercent",
      "nonFinancialAnnualReturnPercent",
      "annualExpenseInflationPercent",
      "postRetirementExpenseReductionPercent",
      "npsSplitPolicy.lumpsumPercent",
      "npsSplitPolicy.annuityPercent",
      "epfTransferToCashAfterRetirementYears",
      "propertyLiquidationAllowed",
    ]));
  });
});