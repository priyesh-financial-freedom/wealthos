import { describe, expect, it } from "vitest";

import type { GoldHolding } from "@/types/goldHolding";
import type { ProjectionContext, ProjectionScenario } from "@/services/projection/ProjectionContext";
import { createMonthlyLedgerRecord } from "@/services/projection/ProjectionContext";

import { annualRateToMonthlyRate, roundCurrency } from "./steps/step-helpers";
import { InvestmentStep } from "./steps/InvestmentStep";

function buildGoldHolding(currentValue: number): GoldHolding {
  return {
    id: "gold-1",
    user_id: "user-1",
    holding_type: "Physical Gold",
    description: "Test gold holding",
    quantity: 1,
    unit: "g",
    purity: null,
    purchase_date: null,
    cost_basis: currentValue,
    current_value: currentValue,
    custodian: null,
    institution: null,
    owner: null,
    nominee: null,
    notes: null,
    documents_placeholder: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  };
}

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

  return {
    scenario,
    assumptions: {
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
    },
    effectiveAssumptions: {
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
    },
    assets: [],
    liabilities: [],
    bankAccounts: [],
    investments: [],
    realEstate: [],
    retirementAccounts: [],
    fixedDeposits: [],
    goldHoldings: [buildGoldHolding(500)],
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
    currentRecord: {
      ...createMonthlyLedgerRecord("2026-07", 35, {
        cash: 1000,
        investments: 1500,
        assets: 0,
        liabilities: 0,
        retirementCorpus: 2000,
      }),
      salary: 10000,
    },
    currentState: {
      cash: 1000,
      investments: 1500,
      assets: 0,
      liabilities: 0,
      retirementCorpus: 2000,
    },
  };
}

describe("InvestmentStep", () => {
  it("maps planning return assumptions into cash, investments, and retirement growth", () => {
    const step = new InvestmentStep();
    const context = buildContext();

    const result = step.execute(context);

    const openingCash = 1000;
    const openingInvestments = 1500;
    const openingRetirementCorpus = 2000;
    const openingGoldHoldings = 500;
    const retirementContributions = roundCurrency((10000 * ((context.assumptions.retirement.epfEmployeeContributionRate + context.assumptions.retirement.epfEmployerContributionRate + context.assumptions.retirement.npsContributionRate) / 100)) + context.assumptions.retirement.ppfMonthlyContribution);
    const monthlyEquityRate = annualRateToMonthlyRate(context.effectiveAssumptions.equityReturn);
    const monthlyGoldRate = annualRateToMonthlyRate(context.effectiveAssumptions.goldReturn);
    const monthlyCashRate = annualRateToMonthlyRate(context.effectiveAssumptions.cashReturn);
    const monthlyRetirementRate = annualRateToMonthlyRate((context.effectiveAssumptions.epfReturn + context.effectiveAssumptions.ppfReturn + ((context.effectiveAssumptions.npsEquityReturn + context.effectiveAssumptions.npsDebtReturn) / 2)) / 3);

    const expectedInvestmentReturns = roundCurrency((openingInvestments - openingGoldHoldings) * monthlyEquityRate + openingGoldHoldings * monthlyGoldRate);
    const expectedRetirementReturns = roundCurrency(openingRetirementCorpus * monthlyRetirementRate);
    const expectedCashReturns = roundCurrency(openingCash * monthlyCashRate);

    expect(result.currentState.cash).toBe(roundCurrency(openingCash - retirementContributions + expectedCashReturns));
    expect(result.currentState.investments).toBe(roundCurrency(openingInvestments + retirementContributions + expectedInvestmentReturns - retirementContributions));
    expect(result.currentState.retirementCorpus).toBe(roundCurrency(openingRetirementCorpus + retirementContributions + expectedRetirementReturns));
    expect(result.currentRecord.investmentReturns).toBe(roundCurrency(expectedInvestmentReturns + expectedRetirementReturns));
  });
});