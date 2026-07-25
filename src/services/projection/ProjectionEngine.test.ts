import { describe, expect, it } from "vitest";

import type { ProjectionContext, ProjectionScenario } from "@/services/projection/ProjectionContext";
import { createMonthlyLedgerRecord } from "@/services/projection/ProjectionContext";

import { ProjectionEngine } from "./ProjectionEngine";

function buildContext(): ProjectionContext {
  const scenario: ProjectionScenario = {
    id: "default",
    name: "Default projection",
    description: "test",
    startMonth: "2026-07",
    planningHorizonYear: 2026,
    assumptions: [],
    events: [],
    isDefault: true,
  };

  const assumptions = {
    income: {
      monthlyIncome: 10000,
      annualIncrementRate: 0,
      salaryGrowthRate: 0,
      bonusAmount: 0,
      bonusMonth: 1,
      otherMonthlyIncome: 0,
      salaryStopMonth: 12,
      salaryStopYear: 2030,
    },
    investments: {
      monthlySipAmount: 0,
      stockInvestmentAmount: 0,
      annualIncrementRate: 0,
      expectedReturnRate: 0,
      fixedDepositRate: 0,
      goldAppreciationRate: 0,
      realEstateAppreciationRate: 0,
    },
    inflation: {
      generalInflationRate: 0,
      educationInflationRate: 0,
      healthcareInflationRate: 0,
      retirementInflationRate: 0,
    },
    loans: {
      averageInterestRate: 0,
      emiIncrementRate: 0,
      annualPrepaymentAmount: 0,
      annualPrepaymentMonth: 1,
      useExtraCashForPrepayment: false,
    },
    retirement: {
      epfEmployeeContributionRate: 10,
      epfEmployerContributionRate: 10,
      npsContributionRate: 5,
      ppfMonthlyContribution: 500,
      retirementTargetAge: 60,
      salaryStopMonth: 12,
      salaryStopYear: 2030,
    },
    tax: {
      regime: "new",
      effectiveTaxRate: 0,
      surchargeRate: 0,
      cessRate: 0,
      note: "",
    },
    planning: {
      startMonth: "2026-07",
      endYear: 2026,
      endMonth: 7,
    },
  } as const;

  const effectiveAssumptions = {
    currentAge: 35,
    retirementAge: 60,
    lifeExpectancy: 90,
    spouseLifeExpectancy: 90,
    salaryGrowthRate: 0,
    bonusGrowthRate: 0,
    businessIncomeGrowth: 0,
    rentalIncomeGrowth: 0,
    otherIncomeGrowth: 0,
    generalInflation: 0,
    medicalInflation: 0,
    educationInflation: 0,
    lifestyleInflation: 0,
    propertyInflation: 0,
    luxuryInflation: 0,
    equityReturn: 12,
    debtReturn: 0,
    goldReturn: 24,
    silverReturn: 0,
    realEstateReturn: 0,
    cashReturn: 6,
    epfReturn: 8,
    ppfReturn: 10,
    npsEquityReturn: 12,
    npsDebtReturn: 6,
    homeLoanInterest: 0,
    carLoanInterest: 0,
    personalLoanInterest: 0,
    loanPrepaymentStrategy: "NONE",
    incomeTaxRate: 0,
    capitalGainsTax: 0,
    dividendTax: 0,
    rentalTaxRate: 0,
    withdrawalRate: 0,
    retirementExpenseRatio: 0,
    legacyTarget: 0,
    emergencyCorpusMonths: 0,
    goalFundingPriority: "MEDIUM",
  } as const;

  return {
    scenario,
    assumptions,
    effectiveAssumptions,
    assets: [],
    liabilities: [],
    bankAccounts: [],
    investments: [],
    realEstate: [],
    retirementAccounts: [],
    fixedDeposits: [],
    goldHoldings: [
      {
        id: "gold-1",
        user_id: "user-1",
        holding_type: "Physical Gold",
        description: "Test gold holding",
        quantity: 1,
        unit: "g",
        purity: null,
        purchase_date: null,
        cost_basis: 500,
        current_value: 500,
        custodian: null,
        institution: null,
        owner: null,
        nominee: null,
        notes: null,
        documents_placeholder: null,
        created_at: "2026-07-01T00:00:00Z",
        updated_at: "2026-07-01T00:00:00Z",
      },
    ],
    silverHoldings: [],
    insurancePolicies: [],
    insuranceAccounts: [],
    incomeSources: [],
    expenses: [],
    goals: [],
    taxes: {
      regime: "new",
      effectiveTaxRate: 0,
      surchargeRate: 0,
      cessRate: 0,
      note: "",
    },
    familyMembers: [
      {
        id: "primary",
        name: "Primary",
        relationship: "self",
        birthDate: "1991-01-01",
        currentAge: 35,
        isDependent: false,
      },
    ],
    planningHorizon: {
      startMonth: "2026-07",
      endYear: 2026,
      endMonth: 7,
    },
    currentDate: new Date("2026-07-01T00:00:00Z"),
    projectionStartDate: "2026-07",
    currentMonth: "2026-07",
    monthIndex: 0,
    openingSource: {
      kind: "live-balance-sheet",
      asOfMonth: "2026-07",
    },
    financialEvents: [],
    monthlyLedger: [],
    currentRecord: createMonthlyLedgerRecord("2026-07", 35, {
      cash: 1000,
      investments: 1500,
      assets: 0,
      liabilities: 0,
      retirementCorpus: 2000,
    }),
    currentState: {
      cash: 1000,
      investments: 1500,
      assets: 0,
      liabilities: 0,
      retirementCorpus: 2000,
    },
  };
}

describe("ProjectionEngine", () => {
  it("projects the viewer snapshot using the mapped investment return assumptions", async () => {
    const engine = new ProjectionEngine();
    const result = await engine.run(buildContext());

    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].closingBalances.cash).toBeGreaterThan(1000);
    expect(result.snapshots[0].closingBalances.investments).toBeGreaterThan(1500);
    expect(result.snapshots[0].closingBalances.retirement).toBeGreaterThan(2000);
    expect(result.snapshots[0].growth).toBeGreaterThan(0);
  });

  it("carries projection entities forward across months without changing aggregate balances", async () => {
    const engine = new ProjectionEngine() as unknown as {
      run: (context: ProjectionContext) => Promise<Awaited<ReturnType<ProjectionEngine["run"]>>>;
      pipeline: {
        execute: (context: ProjectionContext) => Promise<ProjectionContext>;
      };
    };

    const context = buildContext();
    context.planningHorizon.endMonth = 8;
    context.currentState.projectionEntities = [
      {
        id: "entity:test",
        entityType: "Cash",
        name: "Test Entity",
        openingBalance: 1,
        scheduledContribution: 0,
        scheduledWithdrawal: 0,
        growth: 0,
        fees: 0,
        tax: 0,
        closingBalance: 1,
      },
    ];

    engine.pipeline = {
      execute: async (monthContext: ProjectionContext) => {
        const opening = monthContext.currentState.projectionEntities?.[0]?.openingBalance ?? 0;
        const closingCash = monthContext.currentState.cash;
        const closingInvestments = monthContext.currentState.investments;
        const closingAssets = monthContext.currentState.assets;
        const closingLiabilities = monthContext.currentState.liabilities;
        const retirementCorpus = monthContext.currentState.retirementCorpus;

        return {
          ...monthContext,
          currentRecord: {
            ...monthContext.currentRecord,
            investmentReturns: opening,
            closingCash,
            closingInvestments,
            closingAssets,
            closingLiabilities,
            retirementCorpus,
            closingNetWorth: closingCash + closingInvestments + closingAssets + retirementCorpus - closingLiabilities,
          },
          currentState: {
            ...monthContext.currentState,
            projectionEntities: [
              {
                id: "entity:test",
                entityType: "Cash",
                name: "Test Entity",
                openingBalance: opening + 1,
                scheduledContribution: 0,
                scheduledWithdrawal: 0,
                growth: 0,
                fees: 0,
                tax: 0,
                closingBalance: opening + 1,
              },
            ],
          },
        };
      },
    };

    const result = await engine.run(context);

    expect(result.snapshots).toHaveLength(2);
    expect(result.snapshots[0].growth).toBe(1);
    expect(result.snapshots[1].growth).toBe(2);
    expect(result.snapshots[0].closingBalances.cash).toBe(1000);
    expect(result.snapshots[1].closingBalances.cash).toBe(1000);
    expect(result.snapshots[0].closingBalances.investments).toBe(3500);
    expect(result.snapshots[1].closingBalances.investments).toBe(3500);
  });
});