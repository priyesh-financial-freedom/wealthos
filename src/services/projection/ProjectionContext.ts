import type { AssumptionsBundle, PlanningHorizon } from "@/types/assumptions";
import type { Account } from "@/types/account";
import type { Asset } from "@/types/asset";
import type { BankAccount } from "@/types/bankAccount";
import type { FinancialGoal } from "@/types/financialGoal";
import type { FixedDeposit } from "@/types/fixedDeposit";
import type { GoldHolding } from "@/types/goldHolding";
import type { Investment } from "@/types/investment";
import type { Liability } from "@/types/liability";
import type {
  FinancialEvent,
  MonthlyLedger,
  MonthlyLedgerRecord,
  ProjectionExpenseItem,
  ProjectionFamilyMember,
  ProjectionIncomeSource,
  ProjectionInsurancePolicy,
  ProjectionScenario,
  ProjectionTaxProfile,
} from "@/types/projection";
import type { RealEstateProperty } from "@/types/realEstateProperty";
import type { RetirementAccount } from "@/types/retirementAccount";
import type { SilverHolding } from "@/types/silverHolding";
import type { EffectivePlanningAssumptions } from "@/services/planning/assumptions";

export interface ProjectionOpeningSource {
  kind: "live-balance-sheet" | "month-end-close";
  asOfMonth: string;
  closeId?: string;
}

export interface ProjectionMonthState {
  cash: number;
  investments: number;
  assets: number;
  liabilities: number;
  retirementCorpus: number;
}

export interface ProjectionMutableLedgerRecord extends MonthlyLedgerRecord {}

export interface ProjectionContext {
  scenario: ProjectionScenario;
  assumptions: AssumptionsBundle;
  effectiveAssumptions: EffectivePlanningAssumptions;
  assets: Asset[];
  liabilities: Liability[];
  bankAccounts: BankAccount[];
  investments: Investment[];
  realEstate: RealEstateProperty[];
  retirementAccounts: RetirementAccount[];
  fixedDeposits: FixedDeposit[];
  goldHoldings: GoldHolding[];
  silverHoldings: SilverHolding[];
  insurancePolicies: ProjectionInsurancePolicy[];
  insuranceAccounts: Account[];
  incomeSources: ProjectionIncomeSource[];
  expenses: ProjectionExpenseItem[];
  goals: FinancialGoal[];
  taxes: ProjectionTaxProfile;
  familyMembers: ProjectionFamilyMember[];
  planningHorizon: PlanningHorizon;
  currentDate: Date;
  projectionStartDate: string;
  currentMonth: string;
  monthIndex: number;
  openingSource: ProjectionOpeningSource;
  financialEvents: FinancialEvent[];
  monthlyLedger: MonthlyLedger;
  currentRecord: ProjectionMutableLedgerRecord;
  currentState: ProjectionMonthState;
}

export function cloneProjectionState(state: ProjectionMonthState): ProjectionMonthState {
  return {
    cash: Number(state.cash ?? 0),
    investments: Number(state.investments ?? 0),
    assets: Number(state.assets ?? 0),
    liabilities: Number(state.liabilities ?? 0),
    retirementCorpus: Number(state.retirementCorpus ?? 0),
  };
}

export function createMonthlyLedgerRecord(month: string, age: number, state: ProjectionMonthState): ProjectionMutableLedgerRecord {
  return {
    month,
    age,
    openingCash: Number(state.cash ?? 0),
    openingInvestments: Number(state.investments ?? 0),
    openingAssets: Number(state.assets ?? 0),
    openingLiabilities: Number(state.liabilities ?? 0),
    salary: 0,
    bonus: 0,
    rentalIncome: 0,
    businessIncome: 0,
    otherIncome: 0,
    livingExpenses: 0,
    insurancePremium: 0,
    taxes: 0,
    emis: 0,
    loanPrincipal: 0,
    loanInterest: 0,
    investmentContributions: 0,
    investmentReturns: 0,
    goalFunding: 0,
    emergencyFund: 0,
    closingCash: Number(state.cash ?? 0),
    closingInvestments: Number(state.investments ?? 0),
    closingAssets: Number(state.assets ?? 0),
    closingLiabilities: Number(state.liabilities ?? 0),
    closingNetWorth: Number(state.cash ?? 0) + Number(state.investments ?? 0) + Number(state.assets ?? 0) + Number(state.retirementCorpus ?? 0) - Number(state.liabilities ?? 0),
    liquidity: 0,
    retirementCorpus: Number(state.retirementCorpus ?? 0),
  };
}

export function updateProjectionRecord(
  context: ProjectionContext,
  patch: Partial<ProjectionMutableLedgerRecord>,
  nextState?: Partial<ProjectionMonthState>,
): ProjectionContext {
  return {
    ...context,
    currentRecord: {
      ...context.currentRecord,
      ...patch,
    },
    currentState: nextState
      ? {
          ...context.currentState,
          ...nextState,
        }
      : context.currentState,
  };
}

export function finalizeProjectionRecord(record: ProjectionMutableLedgerRecord): Readonly<MonthlyLedgerRecord> {
  return Object.freeze({ ...record });
}