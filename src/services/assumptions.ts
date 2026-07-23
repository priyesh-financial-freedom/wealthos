import type {
  AssumptionRecord,
  AssumptionsBundle,
  AssumptionPayload,
  AssumptionSection,
  InflationAssumptions,
  IncomeAssumptions,
  InvestmentAssumptions,
  LoanAssumptions,
  PlanningHorizon,
  RetirementAssumptions,
  TaxAssumptions,
} from "@/types/assumptions";

import {
  LEGACY_BUNDLE_DEFAULTS,
  planningAssumptionService,
  SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS,
} from "@/services/planning/assumptions";

export const DEFAULT_SCENARIO_KEY = "default";
export const DEFAULT_ASSUMPTIONS_BUNDLE: AssumptionsBundle = structuredClone(LEGACY_BUNDLE_DEFAULTS);

function unsupportedMutation(methodName: string): never {
  throw new Error(`${methodName} has been retired. Update assumptions through Planning -> Assumptions.`);
}

export class AssumptionsService {
  async listAssumptions(): Promise<AssumptionRecord[]> {
    return [];
  }

  async getAssumption(): Promise<AssumptionRecord | null> {
    return null;
  }

  async createAssumption(_section: AssumptionSection, _payload: AssumptionPayload): Promise<AssumptionRecord> {
    return unsupportedMutation("createAssumption");
  }

  async updateAssumption(_section: AssumptionSection, _payload: AssumptionPayload): Promise<AssumptionRecord> {
    return unsupportedMutation("updateAssumption");
  }

  async upsertAssumption(_section: AssumptionSection, _payload: AssumptionPayload): Promise<AssumptionRecord> {
    return unsupportedMutation("upsertAssumption");
  }

  async deleteAssumption(section: AssumptionSection, scenarioKey = DEFAULT_SCENARIO_KEY): Promise<void> {
    void section;
    void scenarioKey;
    return unsupportedMutation("deleteAssumption");
  }

  async getAssumptionsBundle(scenarioKey = DEFAULT_SCENARIO_KEY): Promise<AssumptionsBundle> {
    const scenarioId = scenarioKey === DEFAULT_SCENARIO_KEY ? null : scenarioKey;
    return planningAssumptionService.getLegacyAssumptionsBundle({ scenarioId });
  }

  async getEffectiveAssumptions(options?: { scenarioId?: string | null; goalId?: string | null }) {
    return planningAssumptionService.getEffectiveAssumptions(options);
  }

  async saveIncomeAssumptions(_value: IncomeAssumptions): Promise<AssumptionRecord> {
    return unsupportedMutation("saveIncomeAssumptions");
  }

  async saveInvestmentAssumptions(_value: InvestmentAssumptions): Promise<AssumptionRecord> {
    return unsupportedMutation("saveInvestmentAssumptions");
  }

  async saveInflationAssumptions(_value: InflationAssumptions): Promise<AssumptionRecord> {
    return unsupportedMutation("saveInflationAssumptions");
  }

  async saveLoanAssumptions(_value: LoanAssumptions): Promise<AssumptionRecord> {
    return unsupportedMutation("saveLoanAssumptions");
  }

  async saveRetirementAssumptions(_value: RetirementAssumptions): Promise<AssumptionRecord> {
    return unsupportedMutation("saveRetirementAssumptions");
  }

  async saveTaxAssumptions(_value: TaxAssumptions): Promise<AssumptionRecord> {
    return unsupportedMutation("saveTaxAssumptions");
  }

  async savePlanningHorizon(_value: PlanningHorizon): Promise<AssumptionRecord> {
    return unsupportedMutation("savePlanningHorizon");
  }
}

export const assumptionsService = new AssumptionsService();

export const CURRENT_PLANNING_ASSUMPTION_BASELINE = SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS;

export {
  assumptionService as assumptionEngineService,
  AssumptionRepository,
  AssumptionService,
  ValidationService,
  VersionService,
} from "./assumptions/index";