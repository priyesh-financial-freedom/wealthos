import { assumptionsService, DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import { compensationService } from "@/services/compensation";
import { FinancialSimulationEngine } from "@/services/simulation";
import { projectionEventsService } from "@/services/projection/events";
import type { AssumptionsBundle } from "@/types/assumptions";
import type {
  PlanningScenarioComparison,
  PlanningScenarioEditableKey,
  PlanningScenario,
  PlanningScenarioInsert,
  PlanningScenarioOverride,
  PlanningScenarioOverrideInput,
  PlanningScenarioUpdate,
  PlanningScenarioWithOverrides,
  JsonValue,
} from "@/types/planningScenario";
import type { SimulationOutcome, SimulationResult } from "@/services/simulation";
import type { SimulationRequest, SnapshotProvider, AssumptionProvider, EventProvider } from "@/services/simulation";
import type { PlanningScenarioStore } from "./PlanningScenarioRepository";
import { PlanningScenarioRepository } from "./PlanningScenarioRepository";

const SCENARIO_OVERRIDE_KEYS: PlanningScenarioEditableKey[] = [
  "retirement_target_age",
  "salary_growth_rate",
  "inflation_rate",
  "investment_return_rate",
  "expense_inflation_rate",
];

const SIMULATION_VERSION = "planning-scenarios-v1";

interface PlanningScenarioServiceDependencies {
  repository?: PlanningScenarioRepository;
  store?: PlanningScenarioStore;
  simulationEngine?: FinancialSimulationEngine;
}

export interface PlanningScenarioSummaryComparison {
  projectedNetWorth: number;
  goalReadiness: string;
  cashFlow: number;
  simulationDate: string;
}

export interface PlanningScenarioComparisonResult {
  left: { scenario: PlanningScenarioWithOverrides; simulation: SimulationResult; summary: PlanningScenarioSummaryComparison };
  right: { scenario: PlanningScenarioWithOverrides; simulation: SimulationResult; summary: PlanningScenarioSummaryComparison };
}

function isEditableKey(value: string): value is PlanningScenarioEditableKey {
  return SCENARIO_OVERRIDE_KEYS.includes(value as PlanningScenarioEditableKey);
}

function toNumber(value: JsonValue) {
  return Number(value ?? 0);
}

function cloneBundle(bundle: AssumptionsBundle): AssumptionsBundle {
  return JSON.parse(JSON.stringify(bundle)) as AssumptionsBundle;
}

function mergeOverrideBundle(base: AssumptionsBundle, overrides: PlanningScenarioOverride[]): Partial<AssumptionsBundle> {
  const bundle = cloneBundle(base);

  for (const override of overrides) {
    switch (override.assumption_key) {
      case "retirement_target_age":
        bundle.retirement.retirementTargetAge = toNumber(override.override_value);
        break;
      case "salary_growth_rate":
        bundle.income.salaryGrowthRate = toNumber(override.override_value);
        break;
      case "inflation_rate":
        bundle.inflation.generalInflationRate = toNumber(override.override_value);
        break;
      case "investment_return_rate":
        bundle.investments.expectedReturnRate = toNumber(override.override_value);
        break;
      case "expense_inflation_rate":
        bundle.inflation.healthcareInflationRate = toNumber(override.override_value);
        break;
    }
  }

  return {
    income: bundle.income,
    investments: bundle.investments,
    inflation: bundle.inflation,
    retirement: bundle.retirement,
    planning: bundle.planning,
  };
}

function buildScenarioOverrideInput(base: AssumptionsBundle, overrides: PlanningScenarioOverride[]): Partial<AssumptionsBundle> {
  const bundle = cloneBundle(base);

  for (const override of overrides) {
    const value = toNumber(override.override_value);

    switch (override.assumption_key) {
      case "retirement_target_age":
        bundle.retirement.retirementTargetAge = value;
        break;
      case "salary_growth_rate":
        bundle.income.salaryGrowthRate = value;
        break;
      case "inflation_rate":
        bundle.inflation.generalInflationRate = value;
        break;
      case "investment_return_rate":
        bundle.investments.expectedReturnRate = value;
        break;
      case "expense_inflation_rate":
        bundle.inflation.healthcareInflationRate = value;
        break;
    }
  }

  return {
    income: bundle.income,
    investments: bundle.investments,
    inflation: bundle.inflation,
    loans: bundle.loans,
    retirement: bundle.retirement,
    tax: bundle.tax,
    planning: bundle.planning,
  };
}

function buildSimulationRequest(scenarioId: string, baseAssumptions: AssumptionsBundle, overrides: PlanningScenarioOverride[]): SimulationRequest {
  return {
    snapshotId: scenarioId,
    scenarioOverrides: {
      assumptions: buildScenarioOverrideInput(baseAssumptions, overrides),
    },
  };
}

export class PlanningScenarioService {
  constructor(private readonly dependencies: PlanningScenarioServiceDependencies = {}) {}

  private readonly bootstrapScenarioName = "Base";
  private readonly bootstrapScenarioDescription = "System generated default planning scenario aligned to the planning assumptions baseline.";

  private get store(): PlanningScenarioStore {
    if (this.dependencies.repository) {
      return this.dependencies.repository;
    }

    if (this.dependencies.store) {
      return this.dependencies.store;
    }

    throw new Error("PlanningScenarioService requires a repository. Use createPlanningScenarioBrowserService() or createPlanningScenarioServerService().");
  }

  private get simulationEngine(): FinancialSimulationEngine {
    if (this.dependencies.simulationEngine) {
      return this.dependencies.simulationEngine;
    }

    return new FinancialSimulationEngine({
      snapshotProvider: {
        loadSnapshot: async () => {
          const userId = await this.userId();
          return this.store.loadLatestMonthEndSnapshot(userId);
        },
      },
      assumptionProvider: {
        loadAssumptions: async () => {
          return compensationService.getCompensatedAssumptionsBundle(DEFAULT_SCENARIO_KEY);
        },
      },
      eventProvider: {
        loadEvents: async () => projectionEventsService.listEvents(DEFAULT_SCENARIO_KEY).catch(() => []),
      },
    });
  }

  private async userId(): Promise<string> {
    return this.store.getAuthenticatedUserId();
  }

  async listScenarios(): Promise<PlanningScenarioWithOverrides[]> {
    const userId = await this.userId();
    return this.ensureDefaultScenario(userId);
  }

  private async ensureDefaultScenario(userId: string): Promise<PlanningScenarioWithOverrides[]> {
    const scenarios = await this.store.listScenarios(userId);

    if (scenarios.length > 0) {
      return scenarios;
    }

    const created = await this.store.createScenario(userId, {
      name: this.bootstrapScenarioName,
      description: this.bootstrapScenarioDescription,
      type: "BASE",
      is_default: true,
      is_active: true,
    });

    const createdWithOverrides: PlanningScenarioWithOverrides = {
      ...created,
      overrides: [],
    };

    return [createdWithOverrides];
  }

  async getScenario(scenarioId: string): Promise<PlanningScenarioWithOverrides | null> {
    const userId = await this.userId();
    return this.store.getScenario(userId, scenarioId);
  }

  async createScenario(input: PlanningScenarioInsert): Promise<PlanningScenarioWithOverrides> {
    const userId = await this.userId();
    const scenarios = await this.store.listScenarios(userId);
    const isFirstScenario = scenarios.length === 0;
    const scenario = await this.store.createScenario(userId, {
      name: input.name,
      description: input.description ?? null,
      type: isFirstScenario ? "BASE" : input.type ?? "CUSTOM",
      is_default: isFirstScenario,
      is_active: isFirstScenario,
    });

    if (input.type && !isFirstScenario) {
      await this.store.updateScenario(userId, { id: scenario.id, name: scenario.name, description: scenario.description, type: input.type });
    }

    if (input.is_default) {
      await this.setDefaultScenario(scenario.id);
    }

    return this.getScenarioOrThrow(scenario.id);
  }

  async updateScenario(input: PlanningScenarioUpdate, overrides?: PlanningScenarioOverrideInput[]): Promise<PlanningScenarioWithOverrides> {
    const userId = await this.userId();
    await this.store.updateScenario(userId, input);

    if (overrides) {
      await this.store.saveOverrides(userId, input.id, overrides);
    }

    return this.getScenarioOrThrow(input.id);
  }

  async deleteScenario(scenarioId: string): Promise<void> {
    const scenario = await this.getScenarioOrThrow(scenarioId);

    if (scenario.is_default) {
      throw new Error("The default scenario cannot be deleted.");
    }

    if (scenario.is_active) {
      throw new Error("Active scenarios must be archived before deletion.");
    }

    if (scenario.type === "SYSTEM") {
      throw new Error("System scenarios cannot be deleted.");
    }

    const userId = await this.userId();
    await this.store.deleteScenario(userId, scenarioId);
  }

  async archiveScenario(scenarioId: string): Promise<PlanningScenarioWithOverrides> {
    const userId = await this.userId();
    const scenario = await this.getScenarioOrThrow(scenarioId);

    if (scenario.is_active) {
      throw new Error("Active scenarios cannot be archived.");
    }

    await this.store.updateScenario(userId, {
      id: scenarioId,
      name: scenario.name,
      description: scenario.description,
      type: scenario.type,
      is_active: false,
    });

    return this.getScenarioOrThrow(scenarioId);
  }

  async duplicateScenario(scenarioId: string): Promise<PlanningScenarioWithOverrides> {
    const source = await this.getScenarioOrThrow(scenarioId);
    const copy = await this.createScenario({
      name: this.buildDuplicateName(source.name),
      description: source.description,
      type: "CUSTOM",
      is_default: false,
      is_active: false,
    });

    if (source.overrides.length > 0) {
      await this.saveOverrides(copy.id, source.overrides.map((override) => ({
        assumption_key: override.assumption_key,
        override_value: override.override_value,
      })));
    }

    return this.getScenarioOrThrow(copy.id);
  }

  async activateScenario(scenarioId: string): Promise<PlanningScenarioWithOverrides> {
    const userId = await this.userId();
    const scenarios = await this.store.listScenarios(userId);
    const target = scenarios.find((scenario) => scenario.id === scenarioId);

    if (!target) {
      throw new Error("Scenario not found.");
    }

    await Promise.all(
      scenarios.map((scenario) =>
        this.store.updateScenario(userId, {
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          type: scenario.type,
          is_active: scenario.id === scenarioId,
        }),
      ),
    );

    return this.getScenarioOrThrow(scenarioId);
  }

  async setDefaultScenario(scenarioId: string): Promise<PlanningScenarioWithOverrides> {
    const userId = await this.userId();
    const scenarios = await this.store.listScenarios(userId);
    const target = scenarios.find((scenario) => scenario.id === scenarioId);

    if (!target) {
      throw new Error("Scenario not found.");
    }

    await Promise.all(
      scenarios.map((scenario) =>
        this.store.updateScenario(userId, {
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          type: scenario.type,
          is_default: scenario.id === scenarioId,
        }),
      ),
    );

    return this.getScenarioOrThrow(scenarioId);
  }

  async saveOverrides(scenarioId: string, overrides: PlanningScenarioOverrideInput[]): Promise<PlanningScenarioWithOverrides> {
    const userId = await this.userId();
    await this.store.saveOverrides(userId, scenarioId, overrides.filter((override) => isEditableKey(override.assumption_key)));
    return this.getScenarioOrThrow(scenarioId);
  }

  async loadOverrides(scenarioId: string): Promise<PlanningScenarioOverride[]> {
    const userId = await this.userId();
    return this.store.loadOverrides(userId, scenarioId);
  }

  async runSimulation(scenarioId: string): Promise<SimulationResult> {
    const scenario = await this.getScenarioOrThrow(scenarioId);
    const bundle = await compensationService.getCompensatedAssumptionsBundle(DEFAULT_SCENARIO_KEY);
    const overrides = await this.loadOverrides(scenarioId);
    const request = buildSimulationRequest(scenarioId, bundle, overrides);
    const outcome = await this.simulationEngine.run(request);

    if (!outcome.ok) {
      throw new Error(outcome.error.message);
    }

    return outcome.result;
  }

  async compareScenarios(leftScenarioId: string, rightScenarioId: string): Promise<PlanningScenarioComparison> {
    const [leftScenario, rightScenario, leftSimulation, rightSimulation] = await Promise.all([
      this.getScenarioOrThrow(leftScenarioId),
      this.getScenarioOrThrow(rightScenarioId),
      this.runSimulation(leftScenarioId),
      this.runSimulation(rightScenarioId),
    ]);

    return {
      left: {
        scenario: leftScenario,
        simulation: leftSimulation,
        summary: buildComparisonSummary(leftSimulation),
      },
      right: {
        scenario: rightScenario,
        simulation: rightSimulation,
        summary: buildComparisonSummary(rightSimulation),
      },
    };
  }

  private async getScenarioOrThrow(scenarioId: string): Promise<PlanningScenarioWithOverrides> {
    const scenario = await this.getScenario(scenarioId);
    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    return scenario;
  }

  private buildDuplicateName(name: string): string {
    return `${name} Copy`;
  }
}

function buildComparisonSummary(simulation: SimulationResult): PlanningScenarioSummaryComparison {
  return {
    projectedNetWorth: simulation.summary.finalNetWorth,
    goalReadiness: simulation.goalReadiness.message,
    cashFlow: simulation.cashFlowForecast.points.at(-1)?.value ?? 0,
    simulationDate: simulation.metadata.projectionEnd,
  };
}

export function createPlanningScenarioSimulationEngine(params: {
  snapshotProvider?: SnapshotProvider;
  assumptionProvider?: AssumptionProvider;
  eventProvider?: EventProvider;
} = {}): FinancialSimulationEngine {
  const snapshotProvider: SnapshotProvider = params.snapshotProvider ?? {
    loadSnapshot: async () => null,
  };

  const assumptionProvider: AssumptionProvider = params.assumptionProvider ?? {
    loadAssumptions: async () => compensationService.getCompensatedAssumptionsBundle(DEFAULT_SCENARIO_KEY),
  };

  const eventProvider: EventProvider = params.eventProvider ?? {
    loadEvents: async () => projectionEventsService.listEvents(DEFAULT_SCENARIO_KEY).catch(() => []),
  };

  return new FinancialSimulationEngine({
    snapshotProvider,
    assumptionProvider,
    eventProvider,
  });
}
