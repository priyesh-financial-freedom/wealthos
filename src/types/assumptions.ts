export type AssumptionSection = "income" | "investments" | "inflation" | "loans" | "retirement" | "tax" | "planning";

export interface IncomeAssumptions {
  monthlyIncome: number;
  annualIncrementRate: number;
  salaryGrowthRate: number;
  bonusAmount: number;
  bonusMonth: number;
  otherMonthlyIncome: number;
  salaryStopMonth: number;
  salaryStopYear: number;
}

export interface InvestmentAssumptions {
  monthlySipAmount: number;
  stockInvestmentAmount: number;
  annualIncrementRate: number;
  expectedReturnRate: number;
  fixedDepositRate: number;
  goldAppreciationRate: number;
  realEstateAppreciationRate: number;
}

export interface InflationAssumptions {
  generalInflationRate: number;
  educationInflationRate: number;
  healthcareInflationRate: number;
  retirementInflationRate: number;
}

export interface LoanAssumptions {
  averageInterestRate: number;
  emiIncrementRate: number;
  annualPrepaymentAmount: number;
  annualPrepaymentMonth: number;
  useExtraCashForPrepayment: boolean;
}

export interface RetirementAssumptions {
  epfEmployeeContributionRate: number;
  epfEmployerContributionRate: number;
  npsContributionRate: number;
  ppfMonthlyContribution: number;
  retirementTargetAge: number;
  salaryStopMonth: number;
  salaryStopYear: number;
}

export interface TaxAssumptions {
  regime: "old" | "new" | "custom";
  effectiveTaxRate: number;
  surchargeRate: number;
  cessRate: number;
  note: string;
}

export interface PlanningHorizon {
  startMonth: string;
  endYear: number;
  endMonth: number;
}

export interface AssumptionsBundle {
  income: IncomeAssumptions;
  investments: InvestmentAssumptions;
  inflation: InflationAssumptions;
  loans: LoanAssumptions;
  retirement: RetirementAssumptions;
  tax: TaxAssumptions;
  planning: PlanningHorizon;
}

export type AssumptionPayload =
  | IncomeAssumptions
  | InvestmentAssumptions
  | InflationAssumptions
  | LoanAssumptions
  | RetirementAssumptions
  | TaxAssumptions
  | PlanningHorizon;

export interface AssumptionRecord {
  id: string;
  section: AssumptionSection;
  scenarioKey: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}