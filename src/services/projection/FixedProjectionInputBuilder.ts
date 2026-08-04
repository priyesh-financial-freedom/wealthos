import type { Account } from "@/types/account";
import type { Asset } from "@/types/asset";
import type { AssumptionsBundle } from "@/types/assumptions";
import type { BankAccount } from "@/types/bankAccount";
import type { CashFlowSnapshot } from "@/services/cashFlowManagement";
import type { CompensationSummary } from "@/services/compensation";
import {
  SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS,
  type EffectivePlanningAssumptions,
  type PlanningFamilyProfile,
} from "@/services/planning/assumptions";
import type { FixedDeposit } from "@/types/fixedDeposit";
import type { GoldHolding } from "@/types/goldHolding";
import type { Investment } from "@/types/investment";
import type { Liability } from "@/types/liability";
import type { RealEstateProperty } from "@/types/realEstateProperty";
import type { RetirementAccount } from "@/types/retirementAccount";
import type { SilverHolding } from "@/types/silverHolding";

import {
  DEFAULT_PROJECTION_SCENARIO_KEY,
} from "./events";
import type { CreateFixedProjectionV1Input, FixedProjectionBucketKey } from "./FixedProjectionService";
import { planningEntityAggregator, type LoadedProjectionData } from "./PlanningEntityAggregator";

const DEFAULT_EVENT_DRAWDOWN_ORDER: FixedProjectionBucketKey[] = ["cash", "mutual_funds", "ppf", "epf"];
const DEFAULT_NPS_SPLIT_POLICY = {
  lumpsumPercent: 50,
  annuityPercent: 50,
} as const;
const DEFAULT_STOCKS_ANNUAL_RETURN_PERCENT = 11;
const DEFAULT_NPS_ANNUAL_RETURN_PERCENT = 9;
const DEFAULT_NON_FINANCIAL_ANNUAL_RETURN_PERCENT = 5;
const DEFAULT_PPF_ANNUAL_CONTRIBUTION_MONTH = 4;
const DEFAULT_EPF_TRANSFER_AFTER_RETIREMENT_YEARS = 3;
const DEFAULT_PROPERTY_LIQUIDATION_ALLOWED = false;

type SourceStatus = "real" | "derived" | "default" | "hardcoded" | "missing";

export interface FixedProjectionInputSourceReportItem {
  fieldName: string;
  source: string;
  status: SourceStatus;
}

export interface FixedProjectionInputValidation {
  canPreview: boolean;
  canFreeze: boolean;
  blockers: string[];
  warnings: string[];
  defaultsUsed: string[];
}

export interface FixedProjectionInputBuildResult {
  input: CreateFixedProjectionV1Input | null;
  validation: FixedProjectionInputValidation;
  sourceReport: FixedProjectionInputSourceReportItem[];
}

interface FixedProjectionInputBuilderDependencies {
  loadProjectionData: () => Promise<LoadedProjectionData>;
  getEffectiveAssumptions: () => Promise<EffectivePlanningAssumptions>;
  getCompensatedAssumptionsBundle: () => Promise<AssumptionsBundle>;
  getFamilyProfile: () => Promise<PlanningFamilyProfile>;
  getCompensationSummary: () => Promise<CompensationSummary | null>;
  getCashFlowSnapshot: () => Promise<CashFlowSnapshot>;
}

type BuiltField<T> = {
  value: T | null;
  report: FixedProjectionInputSourceReportItem;
  previewBlocker?: string;
  freezeBlocker?: string;
  warning?: string;
  defaultUsed?: string;
};

function buildDefaultDependencies(): FixedProjectionInputBuilderDependencies {
  return {
    loadProjectionData: async () => {
      const [accountsModule, assetsModule, bankAccountsModule, fixedDepositsModule, goldHoldingsModule, investmentsModule, liabilitiesModule, realEstateModule, retirementModule, silverModule] = await Promise.all([
        import("@/services/accounts"),
        import("@/services/assets"),
        import("@/services/bankAccounts"),
        import("@/services/fixedDeposits"),
        import("@/services/goldHoldings"),
        import("@/services/investments"),
        import("@/services/liabilities"),
        import("@/services/realEstateProperties"),
        import("@/services/retirement"),
        import("@/services/silverHoldings"),
      ]);
      const [assets, liabilities, bankAccounts, investments, realEstate, retirementAccounts, fixedDeposits, goldHoldings, silverHoldings, insuranceAccounts] = await Promise.all([
        assetsModule.getAssets(),
        liabilitiesModule.getLiabilities(),
        bankAccountsModule.getBankAccounts().catch(() => [] as BankAccount[]),
        investmentsModule.getInvestments(),
        realEstateModule.getRealEstateProperties().catch(() => [] as RealEstateProperty[]),
        retirementModule.getRetirementAccounts().catch(() => [] as RetirementAccount[]),
        fixedDepositsModule.getFixedDeposits().catch(() => [] as FixedDeposit[]),
        goldHoldingsModule.getGoldHoldings().catch(() => [] as GoldHolding[]),
        silverModule.getSilverHoldings().catch(() => [] as SilverHolding[]),
        accountsModule.getAccounts().catch(() => [] as Account[]),
      ]);

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
      };
    },
    getEffectiveAssumptions: async () => {
      const { planningAssumptionService } = await import("@/services/planning/assumptions");
      return planningAssumptionService.getEffectiveAssumptions();
    },
    getCompensatedAssumptionsBundle: async () => {
      const { compensationService } = await import("@/services/compensation");
      return compensationService.getCompensatedAssumptionsBundle(DEFAULT_PROJECTION_SCENARIO_KEY);
    },
    getFamilyProfile: async () => {
      const { planningAssumptionService } = await import("@/services/planning/assumptions");
      return planningAssumptionService.getFamilyProfile();
    },
    getCompensationSummary: async () => {
      const { compensationService } = await import("@/services/compensation");
      return compensationService.getSummary(DEFAULT_PROJECTION_SCENARIO_KEY);
    },
    getCashFlowSnapshot: async () => {
      const { cashFlowManagementService } = await import("@/services/cashFlowManagement");
      return cashFlowManagementService.getCashFlowSnapshot(DEFAULT_PROJECTION_SCENARIO_KEY);
    },
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toMonthlyKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}

function addMonths(monthKey: string, offset: number): string | null {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) {
    return null;
  }

  const totalMonths = parsed.year * 12 + (parsed.month - 1) + offset;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function matchesOwner(owner: string | null | undefined, name: string): boolean {
  return String(owner ?? "").trim().toLowerCase() === name.toLowerCase();
}

function contributionFrequencyToMonthlyAmount(amount: number, frequency: RetirementAccount["contribution_frequency"]): number {
  switch (frequency) {
    case "Monthly":
      return amount;
    case "Quarterly":
      return amount / 3;
    case "Annual":
      return amount / 12;
    case "One-time":
    default:
      return 0;
  }
}

function contributionMonthNameToNumber(value: RetirementAccount["contribution_month"]): number | null {
  if (!value) {
    return null;
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const index = monthNames.findIndex((month) => month.toLowerCase() === value.toLowerCase());
  return index >= 0 ? index + 1 : null;
}

function uniqueMessages(values: string[]): string[] {
  return Array.from(new Set(values));
}

function readOptionalNumericField(record: unknown, keys: string[]): number | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  const objectRecord = record as { [key: string]: unknown };

  for (const key of keys) {
    const value = Number(objectRecord[key]);
    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export class FixedProjectionInputBuilder {
  constructor(private readonly dependencies: FixedProjectionInputBuilderDependencies = buildDefaultDependencies()) {}

  async buildFixedProjectionInput(): Promise<FixedProjectionInputBuildResult> {
    const previewBlockers: string[] = [];
    const freezeBlockers: string[] = [];
    const warnings: string[] = [];
    const defaultsUsed: string[] = [];
    const sourceReport: FixedProjectionInputSourceReportItem[] = [];

    const [loadedDataResult, effectiveAssumptionsResult, compensatedBundleResult, familyProfileResult, compensationSummaryResult, cashFlowSnapshotResult] = await Promise.allSettled([
      this.dependencies.loadProjectionData(),
      this.dependencies.getEffectiveAssumptions(),
      this.dependencies.getCompensatedAssumptionsBundle(),
      this.dependencies.getFamilyProfile(),
      this.dependencies.getCompensationSummary(),
      this.dependencies.getCashFlowSnapshot(),
    ]);

    const loadedData = loadedDataResult.status === "fulfilled" ? loadedDataResult.value : null;
    const effectiveAssumptions = effectiveAssumptionsResult.status === "fulfilled" ? effectiveAssumptionsResult.value : null;
    const compensatedBundle = compensatedBundleResult.status === "fulfilled" ? compensatedBundleResult.value : null;
    const familyProfile = familyProfileResult.status === "fulfilled" ? familyProfileResult.value : null;
    const compensationSummary = compensationSummaryResult.status === "fulfilled" ? compensationSummaryResult.value : null;
    const cashFlowSnapshot = cashFlowSnapshotResult.status === "fulfilled" ? cashFlowSnapshotResult.value : null;

    const projectionState = loadedData ? planningEntityAggregator.aggregateFromLiveData(loadedData) : null;
    const projectionEntities = projectionState?.projectionEntities ?? [];

    const sumEntityTypes = (...entityTypes: string[]) => projectionEntities
      .filter((entity) => entityTypes.includes(entity.entityType))
      .reduce((sum, entity) => sum + Number(entity.openingBalance ?? 0), 0);

    const buildOpeningBalanceField = (fieldName: string, source: string, value: number | null): BuiltField<number> => {
      if (value === null) {
        return {
          value: null,
          previewBlocker: `${fieldName} is missing.`,
          freezeBlocker: `${fieldName} is required before freezing Fixed Projection.`,
          report: { fieldName, source, status: "missing" },
        };
      }

      return {
        value,
        report: { fieldName, source, status: "real" },
      };
    };

    const openingCash = buildOpeningBalanceField(
      "cash",
      "PlanningEntityAggregator <- bank_accounts + assets (cash/checking/savings)",
      loadedData ? sumEntityTypes("Cash") : null,
    );
    const openingMutualFunds = buildOpeningBalanceField(
      "mutualFunds",
      "PlanningEntityAggregator <- investment_holdings / investments (Mutual Funds)",
      loadedData ? sumEntityTypes("MutualFund") : null,
    );
    const openingStocks = buildOpeningBalanceField(
      "stocks",
      "PlanningEntityAggregator <- investment_holdings / investments (Stocks, ETFs, Bonds)",
      loadedData ? sumEntityTypes("Stock") : null,
    );
    const openingEpf = buildOpeningBalanceField(
      "epf",
      "PlanningEntityAggregator <- epf_accounts + investment_holdings / investments (EPF)",
      loadedData ? sumEntityTypes("EPF") : null,
    );
    const openingPpf = buildOpeningBalanceField(
      "ppf",
      "PlanningEntityAggregator <- ppf_accounts + investment_holdings / investments (PPF)",
      loadedData ? sumEntityTypes("PPF") : null,
    );
    const openingNps = buildOpeningBalanceField(
      "nps",
      "PlanningEntityAggregator <- nps_accounts + investment_holdings / investments (NPS)",
      loadedData ? sumEntityTypes("NPS") : null,
    );
    const openingProperty = buildOpeningBalanceField(
      "property",
      "PlanningEntityAggregator <- real_estate_properties + assets(real_estate)",
      loadedData ? sumEntityTypes("RealEstate") : null,
    );
    const openingGold = buildOpeningBalanceField(
      "gold",
      "PlanningEntityAggregator <- gold_holdings + investment_holdings / investments (Gold, Sovereign Gold Bonds)",
      loadedData ? sumEntityTypes("Gold") : null,
    );

    const silverFoldedBalance = loadedData ? sumEntityTypes("Silver") : null;
    const otherAssetBalance = loadedData ? sumEntityTypes("OtherAsset") : null;
    const otherNonFinancialAssetsValue = silverFoldedBalance === null || otherAssetBalance === null
      ? null
      : silverFoldedBalance + otherAssetBalance;
    const openingOtherNonFinancialAssets: BuiltField<number> = otherNonFinancialAssetsValue === null
      ? {
        value: null,
        previewBlocker: "otherNonFinancialAssets is missing.",
        freezeBlocker: "otherNonFinancialAssets is required before freezing Fixed Projection.",
        report: {
          fieldName: "otherNonFinancialAssets",
          source: "PlanningEntityAggregator <- assets(other/business/vehicle) + silver holdings folded into V1 aggregate",
          status: "missing",
        },
      }
      : {
        value: otherNonFinancialAssetsValue,
        warning: (silverFoldedBalance ?? 0) > 0
          ? "Silver holdings are folded into other non-financial assets because Fixed Projection V1 has no dedicated silver bucket."
          : undefined,
        report: {
          fieldName: "otherNonFinancialAssets",
          source: "PlanningEntityAggregator <- assets(other/business/vehicle) + silver holdings folded into V1 aggregate",
          status: (silverFoldedBalance ?? 0) > 0 ? "derived" : "real",
        },
      };
    const openingLiabilities = buildOpeningBalanceField(
      "liabilities",
      "PlanningEntityAggregator <- liabilities.outstanding_amount",
      loadedData ? sumEntityTypes("HomeLoan", "CarLoan", "PersonalLoan", "EducationLoan", "LoanAgainstProperty", "CreditCard", "BankOverdraft", "OtherLiability", "GoldLoan") : null,
    );

    const startMonth: BuiltField<string> = (() => {
      const value = compensatedBundle?.planning?.startMonth ?? null;
      if (typeof value === "string" && parseMonthKey(value)) {
        return {
          value,
          report: { fieldName: "startMonth", source: "CompensationService -> compensated assumptions bundle planning.startMonth", status: "real" },
        };
      }

      return {
        value: null,
        previewBlocker: "Projection start month is missing.",
        freezeBlocker: "Projection start month is required before freezing Fixed Projection.",
        report: { fieldName: "startMonth", source: "CompensationService -> compensated assumptions bundle planning.startMonth", status: "missing" },
      };
    })();

    const horizonEndMonth: BuiltField<string> = (() => {
      const endYear = Number(compensatedBundle?.planning?.endYear);
      const endMonth = Number(compensatedBundle?.planning?.endMonth);
      if (Number.isInteger(endYear) && Number.isInteger(endMonth) && endMonth >= 1 && endMonth <= 12) {
        return {
          value: `${endYear}-${String(endMonth).padStart(2, "0")}`,
          report: { fieldName: "horizonEndMonth", source: "CompensationService -> compensated assumptions bundle planning.endYear/endMonth", status: "derived" },
        };
      }

      return {
        value: null,
        previewBlocker: "Projection end month is missing.",
        freezeBlocker: "Projection end month is required before freezing Fixed Projection.",
        report: { fieldName: "horizonEndMonth", source: "CompensationService -> compensated assumptions bundle planning.endYear/endMonth", status: "missing" },
      };
    })();

    const retirementMonth: BuiltField<string> = (() => {
      if (!effectiveAssumptions) {
        return {
          value: null,
          previewBlocker: "Retirement month is missing.",
          freezeBlocker: "Retirement month is required before freezing Fixed Projection.",
          report: { fieldName: "retirementMonth", source: "PlanningAssumptionService retirementAge + family profile", status: "missing" },
        };
      }

      const retirementAge = Number(effectiveAssumptions.retirementAge);
      if (!Number.isFinite(retirementAge) || retirementAge <= 0) {
        return {
          value: null,
          previewBlocker: "Retirement month is missing because retirement age is unavailable.",
          freezeBlocker: "Retirement Date present is required before freezing Fixed Projection.",
          report: { fieldName: "retirementMonth", source: "PlanningAssumptionService retirementAge + family profile", status: "missing" },
        };
      }

      if (familyProfile?.primaryDateOfBirth) {
        const birthDate = new Date(`${familyProfile.primaryDateOfBirth}T00:00:00Z`);
        if (!Number.isNaN(birthDate.getTime())) {
          return {
            value: `${birthDate.getUTCFullYear() + Math.trunc(retirementAge)}-${String(birthDate.getUTCMonth() + 1).padStart(2, "0")}`,
            report: { fieldName: "retirementMonth", source: "planning_family_profiles.primary_date_of_birth + planning_assumptions.retirement_age", status: "derived" },
          };
        }
      }

      if (familyProfile && startMonth.value) {
        const currentAge = Number(familyProfile.primaryCurrentAge);
        if (Number.isFinite(currentAge)) {
          const monthOffset = Math.max(0, Math.round((retirementAge - currentAge) * 12));
          const derivedMonth = addMonths(startMonth.value, monthOffset);
          if (derivedMonth) {
            return {
              value: derivedMonth,
              warning: "Retirement month is derived from current age because primary date of birth is unavailable.",
              report: { fieldName: "retirementMonth", source: "familyProfile.primaryCurrentAge + planning_assumptions.retirement_age + startMonth", status: "derived" },
            };
          }
        }
      }

      return {
        value: null,
        previewBlocker: "Retirement month is missing.",
        freezeBlocker: "Retirement Date present is required before freezing Fixed Projection.",
        report: { fieldName: "retirementMonth", source: "PlanningAssumptionService retirementAge + family profile", status: "missing" },
      };
    })();

    const currentGrossSalary: BuiltField<number> = compensationSummary
      ? {
        value: Number(compensationSummary.profile.grossSalaryPerMonth),
        report: { fieldName: "currentGrossSalary", source: "CompensationService -> financial_events compensation profile grossSalaryPerMonth", status: "real" },
      }
      : {
        value: null,
        previewBlocker: "Current gross salary is missing.",
        freezeBlocker: "Salary current values are required before freezing Fixed Projection.",
        report: { fieldName: "currentGrossSalary", source: "CompensationService -> financial_events compensation profile", status: "missing" },
      };
    const currentBasicSalary: BuiltField<number> = compensationSummary
      ? {
        value: Number(compensationSummary.basicSalary),
        report: { fieldName: "currentBasicSalary", source: "CompensationService -> derived from grossSalaryPerMonth and basicPercentOfGross", status: "derived" },
      }
      : {
        value: null,
        previewBlocker: "Current basic salary is missing.",
        freezeBlocker: "Salary current values are required before freezing Fixed Projection.",
        report: { fieldName: "currentBasicSalary", source: "CompensationService -> derived basic salary", status: "missing" },
      };
    const annualIncrementPercent: BuiltField<number> = compensationSummary
      ? {
        value: Number(compensationSummary.profile.annualIncrementPercent),
        report: { fieldName: "annualIncrementPercent", source: "CompensationService -> financial_events compensation profile annualIncrementPercent", status: "real" },
      }
      : {
        value: null,
        previewBlocker: "Salary growth % is missing.",
        freezeBlocker: "Salary Growth present is required before freezing Fixed Projection.",
        report: { fieldName: "annualIncrementPercent", source: "CompensationService -> financial_events compensation profile annualIncrementPercent", status: "missing" },
      };

    const nonInsuranceManualExpenses = cashFlowSnapshot?.manualExpenseEntries.filter((entry) => entry.status === "Active" && entry.category !== "Insurance") ?? [];
    const insuranceManualExpenses = cashFlowSnapshot?.manualExpenseEntries.filter((entry) => entry.status === "Active" && entry.category === "Insurance") ?? [];
    const premiumCommitments = cashFlowSnapshot?.automaticCommitments.filter((entry) => entry.type === "Premium") ?? [];
    const preRetirementMonthlyExpense: BuiltField<number> = (() => {
      if (!cashFlowSnapshot) {
        return {
          value: null,
          previewBlocker: "Monthly expenses are missing.",
          freezeBlocker: "Monthly expenses are required before freezing Fixed Projection.",
          report: { fieldName: "preRetirementMonthlyExpense", source: "CashFlowManagementService manual expenses", status: "missing" },
        };
      }

      const value = nonInsuranceManualExpenses.reduce((sum, entry) => sum + Number(entry.monthlyAmount ?? 0), 0);
      if (nonInsuranceManualExpenses.length === 0) {
        return {
          value: null,
          previewBlocker: "Monthly expenses are missing.",
          freezeBlocker: "Monthly expenses are required before freezing Fixed Projection.",
          report: { fieldName: "preRetirementMonthlyExpense", source: "CashFlowManagementService manual expenses excluding Insurance", status: "missing" },
        };
      }

      return {
        value,
        report: { fieldName: "preRetirementMonthlyExpense", source: "CashFlowManagementService manual expenses excluding Insurance", status: "real" },
      };
    })();

    const monthlyEmi: BuiltField<number> = (() => {
      if (!loadedData) {
        return {
          value: null,
          previewBlocker: "EMI is missing.",
          freezeBlocker: "EMI is required before freezing Fixed Projection.",
          report: { fieldName: "monthlyEmi", source: "liabilities.emi", status: "missing" },
        };
      }

      const value = loadedData.liabilities.reduce((sum, liability) => sum + Number(liability.emi ?? 0), 0);
      return {
        value,
        report: { fieldName: "monthlyEmi", source: "liabilities.emi", status: "real" },
      };
    })();

    const monthlyInsurancePremium: BuiltField<number> = (() => {
      if (!cashFlowSnapshot || !loadedData) {
        return {
          value: 0,
          freezeBlocker: "Insurance premium is required before freezing Fixed Projection unless explicitly confirmed zero.",
          report: { fieldName: "monthlyInsurancePremium", source: "CashFlowManagementService insurance expenses / premium commitments", status: "missing" },
          warning: "Insurance premium source is not configured.",
          defaultUsed: "monthlyInsurancePremium is set to 0 for preview calculations only until an insurance source is configured or zero is explicitly confirmed.",
        };
      }

      const manualInsurance = insuranceManualExpenses.reduce((sum, entry) => sum + Number(entry.monthlyAmount ?? 0), 0);
      const automaticPremiums = premiumCommitments.reduce((sum, entry) => sum + Number(entry.monthlyAmount ?? 0), 0);
      const totalInsurance = manualInsurance + automaticPremiums;

      if (totalInsurance > 0) {
        return {
          value: totalInsurance,
          report: { fieldName: "monthlyInsurancePremium", source: "CashFlowManagementService Insurance manual expenses + Premium automatic commitments", status: "derived" },
        };
      }

      return {
        value: 0,
        freezeBlocker: "Insurance premium is required before freezing Fixed Projection unless explicitly confirmed zero.",
        report: { fieldName: "monthlyInsurancePremium", source: "CashFlowManagementService Insurance manual expenses + Premium automatic commitments", status: "missing" },
        warning: "Insurance premium source is not configured.",
        defaultUsed: "monthlyInsurancePremium is set to 0 for preview calculations only until an insurance source is configured or zero is explicitly confirmed.",
      };
    })();

    const mutualFundsMonthlySip: BuiltField<number> = (() => {
      if (!loadedData) {
        return {
          value: 0,
          report: { fieldName: "mutualFundsMonthlySip", source: "investment_holdings / investments.sip_amount", status: "missing" },
          warning: "Mutual fund SIP contribution could not be loaded; defaulting to 0 for preview assembly.",
          defaultUsed: "mutualFundsMonthlySip defaulted to 0 because investments could not be loaded.",
        };
      }

      const value = loadedData.investments
        .filter((investment) => investment.status === "active" && investment.category === "Mutual Funds")
        .reduce((sum, investment) => sum + Number(investment.sip_amount ?? 0), 0);

      return {
        value,
        report: { fieldName: "mutualFundsMonthlySip", source: "investment_holdings / investments.sip_amount for active Mutual Funds", status: "real" },
      };
    })();

    const monthlyStockContribution = (() => {
      if (!loadedData) {
        return 0;
      }

      return loadedData.investments
        .filter((investment) => investment.status === "active" && investment.category === "Stocks")
        .reduce((sum, investment) => sum + Number(investment.sip_amount ?? 0), 0);
    })();
    sourceReport.push({
      fieldName: "monthlyStockContribution",
      source: "No supported FixedProjectionService input field; active stock SIPs are not modeled in V1",
      status: monthlyStockContribution > 0 ? "hardcoded" : "default",
    });
    warnings.push("Monthly stock contributions are unsupported in Fixed Projection V1 and are set to 0.");
    if (monthlyStockContribution > 0) {
      defaultsUsed.push(`monthlyStockContribution omitted from CreateFixedProjectionV1Input; ${monthlyStockContribution.toFixed(2)} is currently unsupported.`);
    }

    const epfAccounts = loadedData?.retirementAccounts.filter((account) => account.account_type === "EPF") ?? [];
    const ppfAccounts = loadedData?.retirementAccounts.filter((account) => account.account_type === "PPF") ?? [];
    const npsAccounts = loadedData?.retirementAccounts.filter((account) => account.account_type === "NPS") ?? [];

    const epfEmployeeContributionRate: BuiltField<number> = (() => {
      if (!compensationSummary || !currentBasicSalary.value || currentBasicSalary.value <= 0) {
        return {
          value: null,
          previewBlocker: "EPF contribution rate cannot be derived without salary current values.",
          freezeBlocker: "Salary current values are required before freezing Fixed Projection.",
          report: { fieldName: "epfEmployeeContributionRate", source: "epf_accounts employee contribution or compensation profile", status: "missing" },
        };
      }

      const monthlyEmployeeContribution = epfAccounts.reduce((sum, account) => {
        const employeeContribution = Number((account as Extract<RetirementAccount, { account_type: "EPF" }>).employee_contribution ?? 0);
        return sum + contributionFrequencyToMonthlyAmount(employeeContribution, account.contribution_frequency);
      }, 0);

      if (monthlyEmployeeContribution > 0) {
        return {
          value: monthlyEmployeeContribution / currentBasicSalary.value * 100,
          report: { fieldName: "epfEmployeeContributionRate", source: "epf_accounts.employee_contribution / currentBasicSalary", status: "derived" },
        };
      }

      return {
        value: Number(compensationSummary.profile.employeePfPercent + compensationSummary.profile.vpfPercent),
        report: { fieldName: "epfEmployeeContributionRate", source: "CompensationService profile employeePfPercent + vpfPercent", status: "derived" },
      };
    })();

    const epfEmployerContributionRate: BuiltField<number> = (() => {
      if (!compensationSummary || !currentBasicSalary.value || currentBasicSalary.value <= 0) {
        return {
          value: null,
          previewBlocker: "EPF employer contribution rate cannot be derived without salary current values.",
          freezeBlocker: "Salary current values are required before freezing Fixed Projection.",
          report: { fieldName: "epfEmployerContributionRate", source: "epf_accounts employer contribution or compensation profile", status: "missing" },
        };
      }

      const monthlyEmployerContribution = epfAccounts.reduce((sum, account) => {
        const employerContribution = Number((account as Extract<RetirementAccount, { account_type: "EPF" }>).employer_contribution ?? 0);
        return sum + contributionFrequencyToMonthlyAmount(employerContribution, account.contribution_frequency);
      }, 0);

      if (monthlyEmployerContribution > 0) {
        return {
          value: monthlyEmployerContribution / currentBasicSalary.value * 100,
          report: { fieldName: "epfEmployerContributionRate", source: "epf_accounts.employer_contribution / currentBasicSalary", status: "derived" },
        };
      }

      return {
        value: Number(compensationSummary.profile.employerEpfPercent),
        report: { fieldName: "epfEmployerContributionRate", source: "CompensationService profile employerEpfPercent", status: "real" },
      };
    })();

    const npsContributionRate: BuiltField<number> = (() => {
      if (!currentBasicSalary.value || currentBasicSalary.value <= 0) {
        return {
          value: null,
          previewBlocker: "NPS contribution rate cannot be derived without current basic salary.",
          freezeBlocker: "Salary current values are required before freezing Fixed Projection.",
          report: { fieldName: "npsContributionRate", source: "nps_accounts contribution_amount or compensation profile currentNps", status: "missing" },
        };
      }

      const monthlyNpsContributionFromAccounts = npsAccounts.reduce((sum, account) => {
        return sum + contributionFrequencyToMonthlyAmount(Number(account.contribution_amount ?? 0), account.contribution_frequency);
      }, 0);
      if (monthlyNpsContributionFromAccounts > 0) {
        return {
          value: monthlyNpsContributionFromAccounts / currentBasicSalary.value * 100,
          report: { fieldName: "npsContributionRate", source: "nps_accounts.contribution_amount / currentBasicSalary", status: "derived" },
        };
      }

      if (compensationSummary && Number(compensationSummary.profile.currentNps) > 0) {
        return {
          value: Number(compensationSummary.profile.currentNps) / currentBasicSalary.value * 100,
          report: { fieldName: "npsContributionRate", source: "CompensationService profile currentNps / currentBasicSalary", status: "derived" },
        };
      }

      return {
        value: 0,
        report: { fieldName: "npsContributionRate", source: "No active NPS contribution source found", status: "default" },
        defaultUsed: "npsContributionRate defaulted to 0 because no recurring NPS contribution source exists.",
      };
    })();

    const ppfMonthlyContributionPriyesh: BuiltField<number> = (() => {
      if (!loadedData) {
        return {
          value: 0,
          report: { fieldName: "ppfMonthlyContributionPriyesh", source: "ppf_accounts owned by Priyesh with Monthly frequency", status: "missing" },
          warning: "PPF monthly contribution source could not be loaded; defaulting to 0.",
          defaultUsed: "ppfMonthlyContributionPriyesh defaulted to 0 because retirement accounts could not be loaded.",
        };
      }

      const supportedAccounts = ppfAccounts.filter((account) => matchesOwner(account.owner, "Priyesh") && account.contribution_frequency === "Monthly");
      const unsupportedAccounts = ppfAccounts.filter((account) => !matchesOwner(account.owner, "Priyesh") && account.contribution_frequency === "Monthly");
      const value = supportedAccounts.reduce((sum, account) => sum + Number(account.contribution_amount ?? 0), 0);

      return {
        value,
        warning: unsupportedAccounts.length > 0
          ? "Monthly PPF contributions owned outside Priyesh are not mapped into Fixed Projection V1."
          : undefined,
        report: { fieldName: "ppfMonthlyContributionPriyesh", source: "ppf_accounts owner=Priyesh and contribution_frequency=Monthly", status: "derived" },
      };
    })();

    const ppfAnnualContributionShobhana: BuiltField<number> = (() => {
      if (!loadedData) {
        return {
          value: 0,
          report: { fieldName: "ppfAnnualContributionShobhana", source: "ppf_accounts owned by Shobhana with Annual frequency", status: "missing" },
          warning: "PPF annual contribution source could not be loaded; defaulting to 0.",
          defaultUsed: "ppfAnnualContributionShobhana defaulted to 0 because retirement accounts could not be loaded.",
        };
      }

      const supportedAccounts = ppfAccounts.filter((account) => matchesOwner(account.owner, "Shobhana") && account.contribution_frequency === "Annual");
      const value = supportedAccounts.reduce((sum, account) => sum + Number(account.contribution_amount ?? 0), 0);
      return {
        value,
        report: { fieldName: "ppfAnnualContributionShobhana", source: "ppf_accounts owner=Shobhana and contribution_frequency=Annual", status: "derived" },
      };
    })();

    const ppfAnnualContributionMonth: BuiltField<number> = (() => {
      const supportedAccounts = ppfAccounts.filter((account) => matchesOwner(account.owner, "Shobhana") && account.contribution_frequency === "Annual");
      const months = uniqueMessages(supportedAccounts.map((account) => String(contributionMonthNameToNumber(account.contribution_month) ?? "")).filter(Boolean));
      if (months.length === 1) {
        return {
          value: Number(months[0]),
          report: { fieldName: "ppfAnnualContributionMonth", source: "ppf_accounts contribution_month for Shobhana annual PPF accounts", status: "derived" },
        };
      }

      return {
        value: DEFAULT_PPF_ANNUAL_CONTRIBUTION_MONTH,
        report: { fieldName: "ppfAnnualContributionMonth", source: "FixedProjectionService V1 default annual PPF contribution month", status: "default" },
        warning: supportedAccounts.length > 0 ? "PPF annual contribution month is inconsistent or missing; defaulting to April." : undefined,
        defaultUsed: supportedAccounts.length > 0 ? "ppfAnnualContributionMonth defaulted to April because the annual PPF month could not be resolved." : undefined,
      };
    })();

    const ppfContributionEndMonth: BuiltField<string | null> = (() => {
      const dates = ppfAccounts.map((account) => {
        const maturityDate = (account as Extract<RetirementAccount, { account_type: "PPF" }>).maturity_date;
        if (!maturityDate) {
          return null;
        }

        const parsed = new Date(`${maturityDate}T00:00:00Z`);
        return Number.isNaN(parsed.getTime()) ? null : toMonthlyKey(parsed);
      }).filter((value): value is string => Boolean(value));

      if (dates.length === 0) {
        return {
          value: null,
          report: { fieldName: "ppfContributionEndMonth", source: "ppf_accounts.maturity_date", status: "default" },
        };
      }

      return {
        value: dates.sort().at(-1) ?? null,
        report: { fieldName: "ppfContributionEndMonth", source: "ppf_accounts.maturity_date", status: "derived" },
      };
    })();

    const assumptionsRecord = effectiveAssumptions;

    const cashAnnualReturnPercent: BuiltField<number> = effectiveAssumptions
      ? {
        value: Number(effectiveAssumptions.cashReturn),
        report: { fieldName: "cashAnnualReturnPercent", source: "planning_assumptions.cash_return", status: "real" },
      }
      : {
        value: null,
        previewBlocker: "Savings return % is missing.",
        freezeBlocker: "Savings return % is required before freezing Fixed Projection.",
        report: { fieldName: "cashAnnualReturnPercent", source: "planning_assumptions.cash_return", status: "missing" },
      };
    const mutualFundsAnnualReturnPercent: BuiltField<number> = effectiveAssumptions
      ? {
        value: Number(effectiveAssumptions.equityReturn),
        report: { fieldName: "mutualFundsAnnualReturnPercent", source: "planning_assumptions.equity_return (Mutual Funds assumption)", status: "real" },
      }
      : {
        value: null,
        previewBlocker: "MF Return % is missing.",
        freezeBlocker: "MF Return present is required before freezing Fixed Projection.",
        report: { fieldName: "mutualFundsAnnualReturnPercent", source: "planning_assumptions.equity_return", status: "missing" },
      };

    const stocksAnnualReturnPercent: BuiltField<number> = (() => {
      const explicitStocksReturn = assumptionsRecord ? readOptionalNumericField(assumptionsRecord, ["stocksReturn", "stocksAnnualReturnPercent"]) : null;
      if (explicitStocksReturn !== null) {
        return {
          value: explicitStocksReturn,
          report: { fieldName: "stocksAnnualReturnPercent", source: "Distinct stock return assumption from effective assumptions payload", status: "real" },
        };
      }

      return {
        value: DEFAULT_STOCKS_ANNUAL_RETURN_PERCENT,
        report: { fieldName: "stocksAnnualReturnPercent", source: "System default stocks return assumption for Fixed Projection", status: "default" },
        defaultUsed: `stocksAnnualReturnPercent defaulted to ${DEFAULT_STOCKS_ANNUAL_RETURN_PERCENT}% because no user-configured stocks return exists.`,
      };
    })();

    const epfAnnualReturnPercent: BuiltField<number> = effectiveAssumptions
      ? {
        value: Number(effectiveAssumptions.epfReturn),
        report: { fieldName: "epfAnnualReturnPercent", source: "planning_assumptions.epf_return", status: "real" },
      }
      : {
        value: null,
        previewBlocker: "EPF Return % is missing.",
        freezeBlocker: "EPF Return present is required before freezing Fixed Projection.",
        report: { fieldName: "epfAnnualReturnPercent", source: "planning_assumptions.epf_return", status: "missing" },
      };
    const ppfAnnualReturnPercent: BuiltField<number> = effectiveAssumptions
      ? {
        value: Number(effectiveAssumptions.ppfReturn),
        report: { fieldName: "ppfAnnualReturnPercent", source: "planning_assumptions.ppf_return", status: "real" },
      }
      : {
        value: null,
        previewBlocker: "PPF Return % is missing.",
        freezeBlocker: "PPF Return present is required before freezing Fixed Projection.",
        report: { fieldName: "ppfAnnualReturnPercent", source: "planning_assumptions.ppf_return", status: "missing" },
      };

    const npsAnnualReturnPercent: BuiltField<number> = (() => {
      const explicitNpsReturn = assumptionsRecord ? readOptionalNumericField(assumptionsRecord, ["npsAnnualReturnPercent"]) : null;
      if (explicitNpsReturn !== null) {
        return {
          value: explicitNpsReturn,
          report: { fieldName: "npsAnnualReturnPercent", source: "Distinct NPS annual return assumption from effective assumptions payload", status: "real" },
        };
      }

      if (!effectiveAssumptions) {
        return {
          value: DEFAULT_NPS_ANNUAL_RETURN_PERCENT,
          report: { fieldName: "npsAnnualReturnPercent", source: "Default NPS return used because effective NPS assumptions are unavailable", status: "default" },
          defaultUsed: `npsAnnualReturnPercent defaulted to ${DEFAULT_NPS_ANNUAL_RETURN_PERCENT}% because effective NPS assumptions are unavailable.`,
        };
      }

      const activeAccounts = npsAccounts.filter((account) => Number(account.current_balance ?? 0) > 0 || Number(account.contribution_amount ?? 0) > 0);
      if (activeAccounts.length === 0) {
        return {
          value: DEFAULT_NPS_ANNUAL_RETURN_PERCENT,
          report: { fieldName: "npsAnnualReturnPercent", source: "No active NPS balances or contributions exist; using default NPS return", status: "default" },
          defaultUsed: `npsAnnualReturnPercent defaulted to ${DEFAULT_NPS_ANNUAL_RETURN_PERCENT}% because NPS allocation data is unavailable.`,
        };
      }

      let weightedBalance = 0;
      let weightedReturn = 0;
      for (const account of activeAccounts) {
        const equityPercent = Number((account as Extract<RetirementAccount, { account_type: "NPS" }>).equity_percent ?? 0);
        const corporateDebtPercent = Number((account as Extract<RetirementAccount, { account_type: "NPS" }>).corporate_debt_percent ?? 0);
        const governmentPercent = Number((account as Extract<RetirementAccount, { account_type: "NPS" }>).government_securities_percent ?? 0);
        const alternativePercent = Number((account as Extract<RetirementAccount, { account_type: "NPS" }>).alternative_assets_percent ?? 0);
        const allocationTotal = equityPercent + corporateDebtPercent + governmentPercent + alternativePercent;

        if (!Number.isFinite(allocationTotal) || allocationTotal <= 0 || alternativePercent > 0) {
          return {
            value: DEFAULT_NPS_ANNUAL_RETURN_PERCENT,
            report: { fieldName: "npsAnnualReturnPercent", source: "NPS allocation data is unavailable for weighted blending; using default NPS return", status: "default" },
            defaultUsed: `npsAnnualReturnPercent defaulted to ${DEFAULT_NPS_ANNUAL_RETURN_PERCENT}% because NPS allocation data is unavailable.`,
          };
        }

        const balanceWeight = Math.max(Number(account.current_balance ?? 0), Number(account.contribution_amount ?? 0), 1);
        const accountReturn = (
          (equityPercent / allocationTotal) * Number(effectiveAssumptions.npsEquityReturn)
          + ((corporateDebtPercent + governmentPercent) / allocationTotal) * Number(effectiveAssumptions.npsDebtReturn)
        );
        weightedBalance += balanceWeight;
        weightedReturn += balanceWeight * accountReturn;
      }

      if (weightedBalance > 0) {
        return {
          value: weightedReturn / weightedBalance,
          report: { fieldName: "npsAnnualReturnPercent", source: "Derived from nps_accounts allocation weights and planning_assumptions nps_equity_return / nps_debt_return", status: "derived" },
        };
      }

      return {
        value: DEFAULT_NPS_ANNUAL_RETURN_PERCENT,
        report: { fieldName: "npsAnnualReturnPercent", source: "Unable to derive weighted NPS return; using default NPS return", status: "default" },
        defaultUsed: `npsAnnualReturnPercent defaulted to ${DEFAULT_NPS_ANNUAL_RETURN_PERCENT}% because weighted derivation could not be completed.`,
      };
    })();

    const nonFinancialAnnualReturnPercent: BuiltField<number> = (() => {
      const explicitReturn = assumptionsRecord ? readOptionalNumericField(assumptionsRecord, ["nonFinancialAnnualReturnPercent"]) : null;
      if (explicitReturn !== null) {
        return {
          value: explicitReturn,
          report: { fieldName: "nonFinancialAnnualReturnPercent", source: "Distinct non-financial annual return assumption from effective assumptions payload", status: "real" },
        };
      }

      if (!effectiveAssumptions || openingProperty.value === null || openingGold.value === null || openingOtherNonFinancialAssets.value === null || loadedData === null) {
        return {
          value: DEFAULT_NON_FINANCIAL_ANNUAL_RETURN_PERCENT,
          report: { fieldName: "nonFinancialAnnualReturnPercent", source: "Default non-financial return used because weighted blend inputs are incomplete", status: "default" },
          defaultUsed: `nonFinancialAnnualReturnPercent defaulted to ${DEFAULT_NON_FINANCIAL_ANNUAL_RETURN_PERCENT}% because weighted blending inputs are incomplete.`,
        };
      }

      const silverBalance = silverFoldedBalance ?? 0;
      const otherNonFinancialBalance = Math.max(0, openingOtherNonFinancialAssets.value - silverBalance);
      const propertyReturn = Number(effectiveAssumptions.realEstateReturn);
      const goldReturn = Number(effectiveAssumptions.goldReturn);
      const silverReturn = Number(effectiveAssumptions.silverReturn);
      const otherNonFinancialReturn = readOptionalNumericField(assumptionsRecord, [
        "otherNonFinancialAnnualReturnPercent",
        "otherAssetsAnnualReturnPercent",
      ]) ?? Number(effectiveAssumptions.propertyInflation);

      const totalBalance = openingProperty.value + openingGold.value + silverBalance + otherNonFinancialBalance;
      if (totalBalance <= 0) {
        return {
          value: DEFAULT_NON_FINANCIAL_ANNUAL_RETURN_PERCENT,
          report: { fieldName: "nonFinancialAnnualReturnPercent", source: "No active non-financial balances for weighted blending; using default non-financial return", status: "default" },
          defaultUsed: `nonFinancialAnnualReturnPercent defaulted to ${DEFAULT_NON_FINANCIAL_ANNUAL_RETURN_PERCENT}% because there are no active non-financial balances for blending.`,
        };
      }

      if (![propertyReturn, goldReturn, silverReturn, otherNonFinancialReturn].every(Number.isFinite)) {
        return {
          value: DEFAULT_NON_FINANCIAL_ANNUAL_RETURN_PERCENT,
          report: { fieldName: "nonFinancialAnnualReturnPercent", source: "Weighted blend inputs contain invalid returns; using default non-financial return", status: "default" },
          defaultUsed: `nonFinancialAnnualReturnPercent defaulted to ${DEFAULT_NON_FINANCIAL_ANNUAL_RETURN_PERCENT}% because weighted blending inputs are invalid.`,
        };
      }

      const weightedReturn = (
        openingProperty.value * propertyReturn
        + openingGold.value * goldReturn
        + silverBalance * silverReturn
        + otherNonFinancialBalance * otherNonFinancialReturn
      ) / totalBalance;

      if (!Number.isFinite(weightedReturn)) {
        return {
          value: DEFAULT_NON_FINANCIAL_ANNUAL_RETURN_PERCENT,
          report: { fieldName: "nonFinancialAnnualReturnPercent", source: "Weighted blend could not be computed; using default non-financial return", status: "default" },
          defaultUsed: `nonFinancialAnnualReturnPercent defaulted to ${DEFAULT_NON_FINANCIAL_ANNUAL_RETURN_PERCENT}% because weighted blending could not be computed.`,
        };
      }

      return {
        value: weightedReturn,
        report: { fieldName: "nonFinancialAnnualReturnPercent", source: "Weighted blend of realEstateReturn, goldReturn, silverReturn, and other non-financial return assumptions by opening balances", status: "derived" },
      };
    })();

    const annualExpenseInflationPercent: BuiltField<number> = effectiveAssumptions
      ? {
        value: Number(effectiveAssumptions.generalInflation),
        report: { fieldName: "annualExpenseInflationPercent", source: "planning_assumptions.general_inflation", status: "real" },
      }
      : {
        value: null,
        previewBlocker: "Inflation % is missing.",
        freezeBlocker: "Inflation present is required before freezing Fixed Projection.",
        report: { fieldName: "annualExpenseInflationPercent", source: "planning_assumptions.general_inflation", status: "missing" },
      };

    const postRetirementExpenseReductionPercent: BuiltField<number> = effectiveAssumptions
      ? {
        value: Math.max(0, Math.min(100, 100 - Number(effectiveAssumptions.retirementExpenseRatio))),
        report: { fieldName: "postRetirementExpenseReductionPercent", source: "Derived as 100 - planning_assumptions.retirement_expense_ratio", status: "derived" },
      }
      : {
        value: 100 - SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.retirementExpenseRatio,
        report: { fieldName: "postRetirementExpenseReductionPercent", source: "System default retirement expense ratio", status: "default" },
        defaultUsed: "postRetirementExpenseReductionPercent defaulted from the system retirement expense ratio.",
      };

    sourceReport.push(
      { fieldName: "versionNo", source: "Initial Fixed Projection workflow version", status: "hardcoded" },
      { fieldName: "householdId", source: "No household lookup is wired in the current builder", status: "missing" },
      { fieldName: "npsSplitPolicy.lumpsumPercent", source: "Fixed Projection V1 default retirement policy", status: "hardcoded" },
      { fieldName: "npsSplitPolicy.annuityPercent", source: "Fixed Projection V1 default retirement policy", status: "hardcoded" },
      { fieldName: "eventDrawdownOrder", source: "Fixed Projection V1 default drawdown policy", status: "hardcoded" },
      { fieldName: "epfTransferToCashAfterRetirementYears", source: "FixedProjectionService retirement policy payload constant", status: "hardcoded" },
      { fieldName: "propertyLiquidationAllowed", source: "FixedProjectionService drawdown policy payload constant", status: "hardcoded" },
    );
    defaultsUsed.push(
      "versionNo is hardcoded to 1 for the initial Fixed Projection workflow.",
      "npsSplitPolicy defaults to 50/50 until a dedicated planning source exists.",
      `eventDrawdownOrder defaults to ${DEFAULT_EVENT_DRAWDOWN_ORDER.join(" -> ")}.`,
    );

    const fields = [
      openingCash,
      openingMutualFunds,
      openingStocks,
      openingEpf,
      openingPpf,
      openingNps,
      openingProperty,
      openingGold,
      openingOtherNonFinancialAssets,
      openingLiabilities,
      startMonth,
      horizonEndMonth,
      retirementMonth,
      currentGrossSalary,
      currentBasicSalary,
      annualIncrementPercent,
      preRetirementMonthlyExpense,
      monthlyEmi,
      monthlyInsurancePremium,
      mutualFundsMonthlySip,
      epfEmployeeContributionRate,
      epfEmployerContributionRate,
      npsContributionRate,
      ppfMonthlyContributionPriyesh,
      ppfAnnualContributionShobhana,
      ppfAnnualContributionMonth,
      ppfContributionEndMonth,
      cashAnnualReturnPercent,
      mutualFundsAnnualReturnPercent,
      stocksAnnualReturnPercent,
      epfAnnualReturnPercent,
      ppfAnnualReturnPercent,
      npsAnnualReturnPercent,
      nonFinancialAnnualReturnPercent,
      annualExpenseInflationPercent,
      postRetirementExpenseReductionPercent,
    ];

    for (const field of fields) {
      sourceReport.push(field.report);
      if (field.previewBlocker) {
        previewBlockers.push(field.previewBlocker);
      }
      if (field.freezeBlocker) {
        freezeBlockers.push(field.freezeBlocker);
      }
      if (field.warning) {
        warnings.push(field.warning);
      }
      if (field.defaultUsed) {
        defaultsUsed.push(field.defaultUsed);
      }
    }

    const canPreview = previewBlockers.length === 0;
    const canFreeze = canPreview && freezeBlockers.length === 0;

    if (!canPreview) {
      return {
        input: null,
        validation: {
          canPreview,
          canFreeze,
          blockers: uniqueMessages([...previewBlockers, ...freezeBlockers]),
          warnings: uniqueMessages(warnings),
          defaultsUsed: uniqueMessages(defaultsUsed),
        },
        sourceReport,
      };
    }

    return {
      input: {
        householdId: null,
        versionNo: 1,
        startMonth: startMonth.value ?? undefined,
        horizonEndMonth: horizonEndMonth.value ?? undefined,
        openingBalances: {
          cash: openingCash.value ?? 0,
          mutualFunds: openingMutualFunds.value ?? 0,
          stocks: openingStocks.value ?? 0,
          epf: openingEpf.value ?? 0,
          ppf: openingPpf.value ?? 0,
          nps: openingNps.value ?? 0,
          property: openingProperty.value ?? 0,
          gold: openingGold.value ?? 0,
          otherNonFinancialAssets: openingOtherNonFinancialAssets.value ?? 0,
          liabilities: openingLiabilities.value ?? 0,
        },
        assumptions: {
          salary: {
            currentGrossSalary: currentGrossSalary.value ?? 0,
            currentBasicSalary: currentBasicSalary.value ?? 0,
            annualIncrementPercent: annualIncrementPercent.value ?? 0,
            incrementMonth: compensationSummary?.profile.incrementMonth ?? null,
            retirementMonth: retirementMonth.value,
          },
          contributions: {
            mutualFundsMonthlySip: mutualFundsMonthlySip.value ?? 0,
            epfEmployeeContributionRate: epfEmployeeContributionRate.value ?? 0,
            epfEmployerContributionRate: epfEmployerContributionRate.value ?? 0,
            npsContributionRate: npsContributionRate.value ?? 0,
            ppfMonthlyContributionPriyesh: ppfMonthlyContributionPriyesh.value ?? 0,
            ppfAnnualContributionShobhana: ppfAnnualContributionShobhana.value ?? 0,
            ppfAnnualContributionMonth: ppfAnnualContributionMonth.value ?? DEFAULT_PPF_ANNUAL_CONTRIBUTION_MONTH,
            ppfContributionEndMonth: ppfContributionEndMonth.value,
          },
          returns: {
            cashAnnualReturnPercent: cashAnnualReturnPercent.value ?? 0,
            mutualFundsAnnualReturnPercent: mutualFundsAnnualReturnPercent.value ?? 0,
            stocksAnnualReturnPercent: stocksAnnualReturnPercent.value ?? 0,
            epfAnnualReturnPercent: epfAnnualReturnPercent.value ?? 0,
            ppfAnnualReturnPercent: ppfAnnualReturnPercent.value ?? 0,
            npsAnnualReturnPercent: npsAnnualReturnPercent.value ?? 0,
            nonFinancialAnnualReturnPercent: nonFinancialAnnualReturnPercent.value ?? 0,
          },
          expenses: {
            preRetirementMonthlyExpense: preRetirementMonthlyExpense.value ?? 0,
            annualExpenseInflationPercent: annualExpenseInflationPercent.value ?? 0,
            postRetirementExpenseReductionPercent: postRetirementExpenseReductionPercent.value ?? 0,
            monthlyEmi: monthlyEmi.value ?? 0,
            monthlyInsurancePremium: monthlyInsurancePremium.value ?? 0,
          },
          npsSplitPolicy: { ...DEFAULT_NPS_SPLIT_POLICY },
          liabilitiesMonthlyRepayment: monthlyEmi.value ?? 0,
          eventDrawdownOrder: [...DEFAULT_EVENT_DRAWDOWN_ORDER],
        },
      },
      validation: {
        canPreview,
        canFreeze,
        blockers: uniqueMessages([...previewBlockers, ...freezeBlockers]),
        warnings: uniqueMessages(warnings),
        defaultsUsed: uniqueMessages(defaultsUsed),
      },
      sourceReport,
    };
  }
}

export const fixedProjectionInputBuilder = new FixedProjectionInputBuilder();
export const FIXED_PROJECTION_INPUT_BUILDER_DEFAULTS = {
  npsSplitPolicy: DEFAULT_NPS_SPLIT_POLICY,
  eventDrawdownOrder: DEFAULT_EVENT_DRAWDOWN_ORDER,
  ppfAnnualContributionMonth: DEFAULT_PPF_ANNUAL_CONTRIBUTION_MONTH,
  epfTransferToCashAfterRetirementYears: DEFAULT_EPF_TRANSFER_AFTER_RETIREMENT_YEARS,
  propertyLiquidationAllowed: DEFAULT_PROPERTY_LIQUIDATION_ALLOWED,
};