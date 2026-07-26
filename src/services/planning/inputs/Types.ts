export const INPUTS_MODULE_KEY = "inputs" as const;

export type InputsModuleKey = typeof INPUTS_MODULE_KEY;

export type ISODateString = string;
export type ISODateTimeString = string;

export interface PlanningInputVersionedEntity {
  id: string;
  effectiveDate: ISODateString;
  version: number;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  isActive: boolean;
  futureEffectiveDate: ISODateString | null;
}

export interface PersonalProfile extends PlanningInputVersionedEntity {
  fullName: string | null;
  dateOfBirth: ISODateString | null;
  maritalStatus: "SINGLE" | "MARRIED" | "OTHER" | null;
  dependentsCount: number | null;
  countryOfResidence: string | null;
  baseCurrency: string | null;
}

export interface EmploymentProfile extends PlanningInputVersionedEntity {
  employmentStatus: "SALARIED" | "SELF_EMPLOYED" | "BUSINESS_OWNER" | "RETIRED" | "OTHER" | null;
  employerName: string | null;
  roleTitle: string | null;
  workCity: string | null;
  workCountry: string | null;
}

export interface IncomeProfile extends PlanningInputVersionedEntity {
  salaryAnnual: number | null;
  bonusAnnual: number | null;
  businessIncomeAnnual: number | null;
  rentalIncomeAnnual: number | null;
  otherIncomeAnnual: number | null;
}

export interface ExpenseProfile extends PlanningInputVersionedEntity {
  essentialExpenseAnnual: number | null;
  discretionaryExpenseAnnual: number | null;
  emiExpenseAnnual: number | null;
  educationExpenseAnnual: number | null;
  healthcareExpenseAnnual: number | null;
}

export interface RetirementProfile extends PlanningInputVersionedEntity {
  targetRetirementAge: number | null;
  retirementExpenseRatio: number | null;
  targetRetirementCorpus: number | null;
  expectedLongevityAge: number | null;
}

export interface TaxProfile extends PlanningInputVersionedEntity {
  taxRegime: "OLD" | "NEW" | "UNKNOWN" | null;
  marginalTaxRate: number | null;
  capitalGainsTaxRate: number | null;
  dividendTaxRate: number | null;
  surchargeRate: number | null;
}

export interface InvestmentAssumptions extends PlanningInputVersionedEntity {
  equityReturnRate: number | null;
  debtReturnRate: number | null;
  cashReturnRate: number | null;
  goldReturnRate: number | null;
  realEstateReturnRate: number | null;
}

export interface LoanAssumptions extends PlanningInputVersionedEntity {
  homeLoanInterestRate: number | null;
  carLoanInterestRate: number | null;
  personalLoanInterestRate: number | null;
  loanPrepaymentStrategy: "NONE" | "AVALANCHE" | "SNOWBALL" | "HYBRID" | null;
  debtPaydownPriority: "LOW" | "MEDIUM" | "HIGH" | null;
}

export interface InsuranceAssumptions extends PlanningInputVersionedEntity {
  lifeCoverAmount: number | null;
  healthCoverAmount: number | null;
  criticalIllnessCoverAmount: number | null;
  personalAccidentCoverAmount: number | null;
  annualInsurancePremium: number | null;
}

export interface GoalPlanningAssumptions extends PlanningInputVersionedEntity {
  defaultGoalPriority: "LOW" | "MEDIUM" | "HIGH" | null;
  successProbabilityThreshold: number | null;
  emergencyCorpusMonths: number | null;
  contingencyBufferRate: number | null;
}

export interface InflationAssumptions extends PlanningInputVersionedEntity {
  generalInflationRate: number | null;
  healthcareInflationRate: number | null;
  educationInflationRate: number | null;
  lifestyleInflationRate: number | null;
  propertyInflationRate: number | null;
}

export interface PlanningInputEntityMap {
  PersonalProfile: PersonalProfile;
  EmploymentProfile: EmploymentProfile;
  IncomeProfile: IncomeProfile;
  ExpenseProfile: ExpenseProfile;
  RetirementProfile: RetirementProfile;
  TaxProfile: TaxProfile;
  InvestmentAssumptions: InvestmentAssumptions;
  LoanAssumptions: LoanAssumptions;
  InsuranceAssumptions: InsuranceAssumptions;
  GoalPlanningAssumptions: GoalPlanningAssumptions;
  InflationAssumptions: InflationAssumptions;
}

export type PlanningInputEntityName = keyof PlanningInputEntityMap;

export type PlanningInputEntity = PlanningInputEntityMap[PlanningInputEntityName];

export type PlanningInputCreate<TEntityName extends PlanningInputEntityName> =
  Omit<PlanningInputEntityMap[TEntityName], "createdAt" | "updatedAt"> & {
    createdAt?: ISODateTimeString;
    updatedAt?: ISODateTimeString;
  };

export type PlanningInputPatch<TEntityName extends PlanningInputEntityName> =
  Partial<Omit<PlanningInputEntityMap[TEntityName], "id" | "version" | "createdAt">> & {
    id: string;
    version: number;
  };
