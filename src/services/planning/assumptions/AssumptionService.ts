import { supabase } from "@/lib/supabase/client";
import type { AssumptionsBundle } from "@/types/assumptions";

import {
  getScenarioRecommendedAssumptions,
  SCENARIO_PRESET_DESCRIPTIONS,
  SCENARIO_PRESET_OVERRIDES,
  SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS,
} from "./AssumptionDefaults";
import { PlanningAssumptionRepository } from "./AssumptionRepository";
import { PLANNING_ASSUMPTION_KEYS } from "./AssumptionTypes";
import type {
  EffectivePlanningAssumptions,
  PlanningAssumptionEditorState,
  PlanningAssumptionKey,
  PlanningAssumptionOverrides,
  PlanningAssumptionRecord,
  PlanningAssumptionScopeSelection,
  PlanningGoalSummary,
  PlanningScenarioPreset,
  PlanningScenarioSummary,
} from "./AssumptionTypes";
import { validatePlanningAssumptionPatch } from "./AssumptionValidators";

interface PlanningAssumptionServiceDependencies {
  repository?: PlanningAssumptionRepository;
}

const CORE_SCENARIOS: ReadonlyArray<{ name: string; preset: PlanningScenarioPreset; type: string }> = [
  { name: "Base", preset: "BASE", type: "BASE" },
  { name: "Conservative", preset: "CONSERVATIVE", type: "CUSTOM" },
  { name: "Optimistic", preset: "OPTIMISTIC", type: "CUSTOM" },
  { name: "Custom", preset: "CUSTOM", type: "CUSTOM" },
];

const LEGACY_BUNDLE_DEFAULTS: AssumptionsBundle = {
  income: {
    monthlyIncome: 0,
    annualIncrementRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.salaryGrowthRate,
    salaryGrowthRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.salaryGrowthRate,
    bonusAmount: 0,
    bonusMonth: 3,
    otherMonthlyIncome: 0,
    salaryStopMonth: 12,
    salaryStopYear: new Date().getFullYear() + (SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.retirementAge - SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.currentAge),
  },
  investments: {
    monthlySipAmount: 0,
    stockInvestmentAmount: 0,
    annualIncrementRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.salaryGrowthRate,
    expectedReturnRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.equityReturn,
    fixedDepositRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.debtReturn,
    goldAppreciationRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.goldReturn,
    realEstateAppreciationRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.realEstateReturn,
  },
  inflation: {
    generalInflationRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.generalInflation,
    educationInflationRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.educationInflation,
    healthcareInflationRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.medicalInflation,
    retirementInflationRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.lifestyleInflation,
  },
  loans: {
    averageInterestRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.homeLoanInterest,
    emiIncrementRate: 0,
    annualPrepaymentAmount: 0,
    annualPrepaymentMonth: 3,
    useExtraCashForPrepayment: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.loanPrepaymentStrategy !== "NONE",
  },
  retirement: {
    epfEmployeeContributionRate: 0,
    epfEmployerContributionRate: 0,
    npsContributionRate: 0,
    ppfMonthlyContribution: 0,
    retirementTargetAge: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.retirementAge,
    salaryStopMonth: 12,
    salaryStopYear: new Date().getFullYear() + (SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.retirementAge - SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.currentAge),
  },
  tax: {
    regime: "new",
    effectiveTaxRate: SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS.incomeTaxRate,
    surchargeRate: 0,
    cessRate: 0,
    note: "Derived from Planning Assumptions 2.0 defaults.",
  },
  planning: {
    startMonth: new Date().toISOString().slice(0, 7),
    endYear: new Date().getFullYear() + 30,
    endMonth: 12,
  },
};

function browserClientFactory() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return Promise.resolve(supabase);
}

function inferScenarioPreset(name: string): PlanningScenarioPreset {
  const normalized = name.trim().toLowerCase();

  if (normalized === "conservative") {
    return "CONSERVATIVE";
  }
  if (normalized === "optimistic") {
    return "OPTIMISTIC";
  }
  if (normalized === "custom") {
    return "CUSTOM";
  }

  return "BASE";
}

function mergeAssumptionLayers(...layers: Array<PlanningAssumptionOverrides | null | undefined>): EffectivePlanningAssumptions {
  return layers.reduce<EffectivePlanningAssumptions>(
    (accumulator, layer) => ({
      ...accumulator,
      ...(layer ?? {}),
    }),
    { ...SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS },
  );
}

function assignOverrideValue<Key extends PlanningAssumptionKey>(
  overrides: PlanningAssumptionOverrides,
  key: Key,
  value: EffectivePlanningAssumptions[Key],
) {
  overrides[key] = value;
}

function extractOverrides(record: PlanningAssumptionRecord | null): PlanningAssumptionOverrides {
  if (!record) {
    return {};
  }

  const overrides: PlanningAssumptionOverrides = {};
  for (const key of PLANNING_ASSUMPTION_KEYS) {
    const value = record[key];
    if (typeof value !== "undefined") {
      assignOverrideValue(overrides, key, value);
    }
  }

  return overrides;
}

function hasOverrides(overrides: PlanningAssumptionOverrides) {
  return PLANNING_ASSUMPTION_KEYS.some((key) => typeof overrides[key] !== "undefined");
}

function deriveScenarioSeed(preset: PlanningScenarioPreset): PlanningAssumptionOverrides {
  return { ...SCENARIO_PRESET_OVERRIDES[preset] };
}

function mapLegacyBundle(effective: EffectivePlanningAssumptions): AssumptionsBundle {
  return {
    income: {
      ...LEGACY_BUNDLE_DEFAULTS.income,
      annualIncrementRate: effective.salaryGrowthRate,
      salaryGrowthRate: effective.salaryGrowthRate,
    },
    investments: {
      ...LEGACY_BUNDLE_DEFAULTS.investments,
      expectedReturnRate: effective.equityReturn,
      fixedDepositRate: effective.debtReturn,
      goldAppreciationRate: effective.goldReturn,
      realEstateAppreciationRate: effective.realEstateReturn,
    },
    inflation: {
      ...LEGACY_BUNDLE_DEFAULTS.inflation,
      generalInflationRate: effective.generalInflation,
      educationInflationRate: effective.educationInflation,
      healthcareInflationRate: effective.medicalInflation,
      retirementInflationRate: effective.lifestyleInflation,
    },
    loans: {
      ...LEGACY_BUNDLE_DEFAULTS.loans,
      averageInterestRate: effective.homeLoanInterest,
      useExtraCashForPrepayment: effective.loanPrepaymentStrategy !== "NONE",
    },
    retirement: {
      ...LEGACY_BUNDLE_DEFAULTS.retirement,
      retirementTargetAge: effective.retirementAge,
      salaryStopYear: new Date().getFullYear() + Math.max(0, effective.retirementAge - effective.currentAge),
    },
    tax: {
      ...LEGACY_BUNDLE_DEFAULTS.tax,
      effectiveTaxRate: effective.incomeTaxRate,
    },
    planning: { ...LEGACY_BUNDLE_DEFAULTS.planning },
  };
}

export class PlanningAssumptionService {
  private readonly repository: PlanningAssumptionRepository;

  constructor(dependencies: PlanningAssumptionServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new PlanningAssumptionRepository(browserClientFactory);
  }

  async listScenarios(): Promise<PlanningScenarioSummary[]> {
    const { user } = await this.repository.getAuthenticatedUser();
    return this.ensureCoreScenarios(user.id);
  }

  async createCustomScenario(name: string): Promise<PlanningScenarioSummary[]> {
    const normalized = name.trim();
    if (!normalized) {
      throw new Error("Scenario name is required.");
    }

    const { user } = await this.repository.getAuthenticatedUser();
    await this.repository.createScenario(user.id, {
      name: normalized,
      description: SCENARIO_PRESET_DESCRIPTIONS.CUSTOM,
      type: "CUSTOM",
      isDefault: false,
      isActive: false,
    });

    return this.ensureCoreScenarios(user.id);
  }

  async setActiveScenario(scenarioId: string): Promise<PlanningScenarioSummary[]> {
    const { user } = await this.repository.getAuthenticatedUser();
    await this.repository.updateScenarioFlags(user.id, scenarioId, { isActive: true });
    return this.ensureCoreScenarios(user.id);
  }

  async getEditorState(scope: PlanningAssumptionScopeSelection = { level: "SCENARIO", scenarioId: "" }): Promise<PlanningAssumptionEditorState> {
    const { user } = await this.repository.getAuthenticatedUser();
    const scenarios = await this.ensureCoreScenarios(user.id);

    const resolvedScope = await this.resolveScope(user.id, scenarios, scope);
    const userDefaultsRecord = await this.repository.getUserDefaults(user.id);
    const userDefaultsOverrides = extractOverrides(userDefaultsRecord);
    const inheritedFromUserDefaults = mergeAssumptionLayers(userDefaultsOverrides);

    let goal: PlanningGoalSummary | null = null;
    let scenarioOverrides: PlanningAssumptionOverrides = {};
    let goalOverrides: PlanningAssumptionOverrides = {};
    let inherited = { ...SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS };
    let recommended = { ...SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS };
    let overrides = userDefaultsOverrides;

    if (resolvedScope.level === "USER_DEFAULTS") {
      inherited = { ...SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS };
      recommended = { ...SYSTEM_DEFAULT_PLANNING_ASSUMPTIONS };
    } else {
      const resolvedScenarioId = resolvedScope.level === "SCENARIO" ? resolvedScope.scenarioId : resolvedScope.scenarioId ?? null;
      const scenarioRecord = resolvedScenarioId ? await this.repository.getScenarioOverrides(user.id, resolvedScenarioId) : null;
      scenarioOverrides = extractOverrides(scenarioRecord);
      const scenario = resolvedScenarioId ? scenarios.find((item) => item.id === resolvedScenarioId) ?? null : null;

      inherited = inheritedFromUserDefaults;
      recommended = scenario ? getScenarioRecommendedAssumptions(scenario.preset) : inheritedFromUserDefaults;
      overrides = scenarioOverrides;

      if (resolvedScope.level === "GOAL") {
        goal = await this.repository.getGoalSummary(user.id, resolvedScope.goalId);
        const goalRecord = await this.repository.getGoalOverrides(user.id, resolvedScope.goalId);
        goalOverrides = extractOverrides(goalRecord);
        inherited = mergeAssumptionLayers(userDefaultsOverrides, scenarioOverrides, goal ? { goalFundingPriority: goal.priority } : null);
        recommended = inherited;
        overrides = goalOverrides;
      }
    }

    const effective = mergeAssumptionLayers(inherited, overrides);

    return {
      scope: resolvedScope,
      scenarios,
      activeScenarioId: scenarios.find((scenario) => scenario.isActive)?.id ?? null,
      goal,
      effective,
      inherited,
      recommended,
      overrides,
    };
  }

  async updateScopeValues(scope: PlanningAssumptionScopeSelection, values: PlanningAssumptionOverrides) {
    const issues = validatePlanningAssumptionPatch(values);
    const firstIssue = Object.values(issues)[0] ?? null;
    if (firstIssue) {
      throw new Error(firstIssue);
    }

    const { user } = await this.repository.getAuthenticatedUser();
    const editorState = await this.getEditorState(scope);
    const nextOverrides: PlanningAssumptionOverrides = { ...editorState.overrides };

    for (const key of PLANNING_ASSUMPTION_KEYS) {
      if (!(key in values)) {
        continue;
      }

      const nextValue = values[key];
      if (typeof nextValue === "undefined") {
        continue;
      }

      if (editorState.inherited[key] === nextValue) {
        delete nextOverrides[key];
      } else {
        assignOverrideValue(nextOverrides, key, nextValue);
      }
    }

    const persistenceScope = this.toPersistenceScope(editorState.scope);

    if (hasOverrides(nextOverrides)) {
      await this.repository.upsertAssumptionRecord(user.id, persistenceScope, nextOverrides);
    } else {
      await this.repository.deleteAssumptionRecord(user.id, persistenceScope);
    }

    return this.getEditorState(editorState.scope);
  }

  async resetScopeValues(scope: PlanningAssumptionScopeSelection, keys: readonly PlanningAssumptionKey[]) {
    const { user } = await this.repository.getAuthenticatedUser();
    const editorState = await this.getEditorState(scope);
    const nextOverrides: PlanningAssumptionOverrides = { ...editorState.overrides };

    for (const key of keys) {
      delete nextOverrides[key];
    }

    const persistenceScope = this.toPersistenceScope(editorState.scope);
    if (hasOverrides(nextOverrides)) {
      await this.repository.upsertAssumptionRecord(user.id, persistenceScope, nextOverrides);
    } else {
      await this.repository.deleteAssumptionRecord(user.id, persistenceScope);
    }

    return this.getEditorState(editorState.scope);
  }

  async getEffectiveAssumptions(options: { scenarioId?: string | null; goalId?: string | null } = {}): Promise<EffectivePlanningAssumptions> {
    const { user } = await this.repository.getAuthenticatedUser();
    const scenarios = await this.ensureCoreScenarios(user.id);
    const scope = await this.resolveScope(
      user.id,
      scenarios,
      options.goalId ? { level: "GOAL", goalId: options.goalId, scenarioId: options.scenarioId ?? null } : { level: "SCENARIO", scenarioId: options.scenarioId ?? "" },
    );

    const editorState = await this.getEditorState(scope);
    return editorState.effective;
  }

  async getLegacyAssumptionsBundle(options: { scenarioId?: string | null; goalId?: string | null } = {}) {
    const effective = await this.getEffectiveAssumptions(options);
    return mapLegacyBundle(effective);
  }

  private async ensureCoreScenarios(userId: string): Promise<PlanningScenarioSummary[]> {
    const scenarios = await this.repository.listScenarios(userId);
    const existingNames = new Set(scenarios.map((scenario) => scenario.name.trim().toLowerCase()));

    for (const definition of CORE_SCENARIOS) {
      if (existingNames.has(definition.name.toLowerCase())) {
        continue;
      }

      await this.repository.createScenario(userId, {
        name: definition.name,
        description: SCENARIO_PRESET_DESCRIPTIONS[definition.preset],
        type: definition.type,
        isDefault: scenarios.length === 0 && definition.preset === "BASE",
        isActive: scenarios.length === 0 && definition.preset === "BASE",
      });
    }

    let refreshed = (await this.repository.listScenarios(userId)).map((scenario) => ({
      ...scenario,
      preset: inferScenarioPreset(scenario.name),
    }));

    const activeScenario = refreshed.find((scenario) => scenario.isActive) ?? null;
    if (!activeScenario) {
      const baseScenario = refreshed.find((scenario) => scenario.preset === "BASE") ?? refreshed[0] ?? null;
      if (baseScenario) {
        await this.repository.updateScenarioFlags(userId, baseScenario.id, { isActive: true });
        refreshed = (await this.repository.listScenarios(userId)).map((scenario) => ({
          ...scenario,
          preset: inferScenarioPreset(scenario.name),
        }));
      }
    }

    for (const scenario of refreshed) {
      if (scenario.preset === "BASE" || scenario.preset === "CUSTOM") {
        continue;
      }

      const existingRecord = await this.repository.getScenarioOverrides(userId, scenario.id);
      if (existingRecord) {
        continue;
      }

      const seed = deriveScenarioSeed(scenario.preset);
      if (hasOverrides(seed)) {
        await this.repository.upsertAssumptionRecord(userId, { scenarioId: scenario.id, goalId: null }, seed);
      }
    }

    return (await this.repository.listScenarios(userId)).map((scenario) => ({
      ...scenario,
      preset: inferScenarioPreset(scenario.name),
    }));
  }

  private async resolveScope(
    userId: string,
    scenarios: PlanningScenarioSummary[],
    scope: PlanningAssumptionScopeSelection,
  ): Promise<PlanningAssumptionScopeSelection> {
    if (scope.level === "USER_DEFAULTS") {
      return scope;
    }

    if (scope.level === "GOAL") {
      const goal = await this.repository.getGoalSummary(userId, scope.goalId);
      if (!goal) {
        throw new Error("Goal override target not found.");
      }

      return {
        level: "GOAL",
        goalId: goal.id,
        scenarioId: scope.scenarioId ?? goal.linkedScenarioId,
      };
    }

    const resolvedScenarioId = scope.scenarioId || scenarios.find((scenario) => scenario.isActive)?.id || scenarios[0]?.id;
    if (!resolvedScenarioId) {
      throw new Error("No planning scenarios are available.");
    }

    return {
      level: "SCENARIO",
      scenarioId: resolvedScenarioId,
    };
  }

  private toPersistenceScope(scope: PlanningAssumptionScopeSelection) {
    if (scope.level === "USER_DEFAULTS") {
      return { scenarioId: null, goalId: null };
    }

    if (scope.level === "SCENARIO") {
      return { scenarioId: scope.scenarioId, goalId: null };
    }

    return { scenarioId: null, goalId: scope.goalId };
  }
}

export function createPlanningAssumptionBrowserService() {
  return new PlanningAssumptionService();
}

export const planningAssumptionService = createPlanningAssumptionBrowserService();

export { mapLegacyBundle, LEGACY_BUNDLE_DEFAULTS };