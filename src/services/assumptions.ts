import { supabase } from "@/lib/supabase/client";
import type {
  AssumptionRecord,
  AssumptionSection,
  AssumptionsBundle,
  AssumptionPayload,
  IncomeAssumptions,
  InvestmentAssumptions,
  InflationAssumptions,
  LoanAssumptions,
  PlanningHorizon,
  RetirementAssumptions,
  TaxAssumptions,
} from "@/types/assumptions";

export const DEFAULT_SCENARIO_KEY = "default";

export const DEFAULT_ASSUMPTIONS_BUNDLE: AssumptionsBundle = {
  income: {
    monthlyIncome: 0,
    annualIncrementRate: 0,
    salaryGrowthRate: 0,
    bonusAmount: 0,
    bonusMonth: 3,
    otherMonthlyIncome: 0,
    salaryStopMonth: 7,
    salaryStopYear: 2032,
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
    annualPrepaymentMonth: 3,
    useExtraCashForPrepayment: false,
  },
  retirement: {
    epfEmployeeContributionRate: 0,
    epfEmployerContributionRate: 0,
    npsContributionRate: 0,
    ppfMonthlyContribution: 0,
    retirementTargetAge: 60,
    salaryStopMonth: 7,
    salaryStopYear: 2032,
  },
  tax: {
    regime: "new",
    effectiveTaxRate: 0,
    surchargeRate: 0,
    cessRate: 0,
    note: "Placeholder until tax planning rules are modeled.",
  },
  planning: {
    startMonth: new Date().toISOString().slice(0, 7),
    endYear: 2062,
    endMonth: 12,
  },
};

const assumptionSections: AssumptionSection[] = ["income", "investments", "inflation", "loans", "retirement", "tax", "planning"];

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

async function requireAuthenticatedUser() {
  const client = assertSupabaseClient();

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
    throw new Error("Authentication required.");
  }

  return { client, user };
}

function isAssumptionSection(value: string): value is AssumptionSection {
  return assumptionSections.includes(value as AssumptionSection);
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function toBoolean(value: unknown) {
  return Boolean(value);
}

function parseIncomeAssumptions(payload: Record<string, unknown>): IncomeAssumptions {
  return {
    monthlyIncome: toNumber(payload.monthlyIncome),
    annualIncrementRate: toNumber(payload.annualIncrementRate),
    salaryGrowthRate: toNumber(payload.salaryGrowthRate),
    bonusAmount: toNumber(payload.bonusAmount),
    bonusMonth: toNumber(payload.bonusMonth) || DEFAULT_ASSUMPTIONS_BUNDLE.income.bonusMonth,
    otherMonthlyIncome: toNumber(payload.otherMonthlyIncome),
    salaryStopMonth: toNumber(payload.salaryStopMonth) || DEFAULT_ASSUMPTIONS_BUNDLE.income.salaryStopMonth,
    salaryStopYear: toNumber(payload.salaryStopYear) || DEFAULT_ASSUMPTIONS_BUNDLE.income.salaryStopYear,
  };
}

function parseInvestmentAssumptions(payload: Record<string, unknown>): InvestmentAssumptions {
  return {
    monthlySipAmount: toNumber(payload.monthlySipAmount),
    stockInvestmentAmount: toNumber(payload.stockInvestmentAmount),
    annualIncrementRate: toNumber(payload.annualIncrementRate),
    expectedReturnRate: toNumber(payload.expectedReturnRate),
    fixedDepositRate: toNumber(payload.fixedDepositRate),
    goldAppreciationRate: toNumber(payload.goldAppreciationRate),
    realEstateAppreciationRate: toNumber(payload.realEstateAppreciationRate),
  };
}

function parseInflationAssumptions(payload: Record<string, unknown>): InflationAssumptions {
  return {
    generalInflationRate: toNumber(payload.generalInflationRate),
    educationInflationRate: toNumber(payload.educationInflationRate),
    healthcareInflationRate: toNumber(payload.healthcareInflationRate),
    retirementInflationRate: toNumber(payload.retirementInflationRate),
  };
}

function parseLoanAssumptions(payload: Record<string, unknown>): LoanAssumptions {
  return {
    averageInterestRate: toNumber(payload.averageInterestRate),
    emiIncrementRate: toNumber(payload.emiIncrementRate),
    annualPrepaymentAmount: toNumber(payload.annualPrepaymentAmount),
    annualPrepaymentMonth: toNumber(payload.annualPrepaymentMonth) || DEFAULT_ASSUMPTIONS_BUNDLE.loans.annualPrepaymentMonth,
    useExtraCashForPrepayment: toBoolean(payload.useExtraCashForPrepayment),
  };
}

function parseRetirementAssumptions(payload: Record<string, unknown>): RetirementAssumptions {
  return {
    epfEmployeeContributionRate: toNumber(payload.epfEmployeeContributionRate),
    epfEmployerContributionRate: toNumber(payload.epfEmployerContributionRate),
    npsContributionRate: toNumber(payload.npsContributionRate),
    ppfMonthlyContribution: toNumber(payload.ppfMonthlyContribution),
    retirementTargetAge: toNumber(payload.retirementTargetAge) || DEFAULT_ASSUMPTIONS_BUNDLE.retirement.retirementTargetAge,
    salaryStopMonth: toNumber(payload.salaryStopMonth) || DEFAULT_ASSUMPTIONS_BUNDLE.retirement.salaryStopMonth,
    salaryStopYear: toNumber(payload.salaryStopYear) || DEFAULT_ASSUMPTIONS_BUNDLE.retirement.salaryStopYear,
  };
}

function parseTaxAssumptions(payload: Record<string, unknown>): TaxAssumptions {
  const regime = payload.regime === "old" || payload.regime === "new" || payload.regime === "custom" ? payload.regime : DEFAULT_ASSUMPTIONS_BUNDLE.tax.regime;

  return {
    regime,
    effectiveTaxRate: toNumber(payload.effectiveTaxRate),
    surchargeRate: toNumber(payload.surchargeRate),
    cessRate: toNumber(payload.cessRate),
    note: String(payload.note ?? DEFAULT_ASSUMPTIONS_BUNDLE.tax.note),
  };
}

function parsePlanningHorizon(payload: Record<string, unknown>): PlanningHorizon {
  return {
    startMonth: String(payload.startMonth ?? DEFAULT_ASSUMPTIONS_BUNDLE.planning.startMonth),
    endYear: toNumber(payload.endYear) || DEFAULT_ASSUMPTIONS_BUNDLE.planning.endYear,
    endMonth: toNumber(payload.endMonth) || DEFAULT_ASSUMPTIONS_BUNDLE.planning.endMonth,
  };
}

function parseBundleSection(section: AssumptionSection, payload: Record<string, unknown>) {
  switch (section) {
    case "income":
      return parseIncomeAssumptions(payload);
    case "investments":
      return parseInvestmentAssumptions(payload);
    case "inflation":
      return parseInflationAssumptions(payload);
    case "loans":
      return parseLoanAssumptions(payload);
    case "retirement":
      return parseRetirementAssumptions(payload);
    case "tax":
      return parseTaxAssumptions(payload);
    case "planning":
    default:
      return parsePlanningHorizon(payload);
  }
}

function mergeBundle(base: AssumptionsBundle, section: AssumptionSection, payload: Record<string, unknown>): AssumptionsBundle {
  return {
    ...base,
    [section]: parseBundleSection(section, payload),
  } as AssumptionsBundle;
}

export class AssumptionsService {
  async listAssumptions(scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord[]> {
    const { client, user } = await requireAuthenticatedUser();

    const { data, error } = await client
      .from("financial_assumptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("scenario_key", scenarioKey)
      .order("section", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as AssumptionRecord[]).filter((record) => isAssumptionSection(record.section));
  }

  async getAssumption(section: AssumptionSection, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord | null> {
    const records = await this.listAssumptions(scenarioKey);
    return records.find((record) => record.section === section) ?? null;
  }

  async createAssumption(section: AssumptionSection, payload: AssumptionPayload, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    const { client, user } = await requireAuthenticatedUser();

    const { data, error } = await client
      .from("financial_assumptions")
      .insert({
        user_id: user.id,
        scenario_key: scenarioKey,
        section,
        payload: payload as unknown as Record<string, unknown>,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as AssumptionRecord;
  }

  async updateAssumption(section: AssumptionSection, payload: AssumptionPayload, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    const { client, user } = await requireAuthenticatedUser();

    const { data, error } = await client
      .from("financial_assumptions")
      .update({ payload: payload as unknown as Record<string, unknown> })
      .eq("user_id", user.id)
      .eq("scenario_key", scenarioKey)
      .eq("section", section)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as AssumptionRecord;
  }

  async upsertAssumption(section: AssumptionSection, payload: AssumptionPayload, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    const { client, user } = await requireAuthenticatedUser();

    const { data, error } = await client
      .from("financial_assumptions")
      .upsert(
        {
          user_id: user.id,
          scenario_key: scenarioKey,
          section,
          payload: payload as unknown as Record<string, unknown>,
        },
        { onConflict: "user_id,scenario_key,section" },
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as AssumptionRecord;
  }

  async deleteAssumption(section: AssumptionSection, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<void> {
    const { client, user } = await requireAuthenticatedUser();

    const { error } = await client
      .from("financial_assumptions")
      .delete()
      .eq("user_id", user.id)
      .eq("scenario_key", scenarioKey)
      .eq("section", section);

    if (error) {
      throw new Error(error.message);
    }
  }

  async getAssumptionsBundle(scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionsBundle> {
    const bundle = structuredClone(DEFAULT_ASSUMPTIONS_BUNDLE);
    const records = await this.listAssumptions(scenarioKey);

    return records.reduce((accumulator, record) => mergeBundle(accumulator, record.section, record.payload ?? {}), bundle);
  }

  async saveIncomeAssumptions(value: IncomeAssumptions, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    return this.upsertAssumption("income", value, scenarioKey);
  }

  async saveInvestmentAssumptions(value: InvestmentAssumptions, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    return this.upsertAssumption("investments", value, scenarioKey);
  }

  async saveInflationAssumptions(value: InflationAssumptions, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    return this.upsertAssumption("inflation", value, scenarioKey);
  }

  async saveLoanAssumptions(value: LoanAssumptions, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    return this.upsertAssumption("loans", value, scenarioKey);
  }

  async saveRetirementAssumptions(value: RetirementAssumptions, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    return this.upsertAssumption("retirement", value, scenarioKey);
  }

  async saveTaxAssumptions(value: TaxAssumptions, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    return this.upsertAssumption("tax", value, scenarioKey);
  }

  async savePlanningHorizon(value: PlanningHorizon, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionRecord> {
    return this.upsertAssumption("planning", value, scenarioKey);
  }
}

export const assumptionsService = new AssumptionsService();

export {
  assumptionService as assumptionEngineService,
  AssumptionRepository,
  AssumptionService,
  ValidationService,
  VersionService,
} from "./assumptions/index";