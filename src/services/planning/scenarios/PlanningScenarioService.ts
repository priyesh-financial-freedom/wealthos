import { supabase } from "@/lib/supabase/client";
import { assumptionsService, DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import { FinancialSimulationEngine } from "@/services/simulation";
import { projectionEventsService } from "@/services/projection";
import type { MonthlySnapshot, ProjectedEntity, ProjectionBalanceState } from "@/types/projection";
import type { AssumptionsBundle } from "@/types/assumptions";
import type {
  PlanningScenario,
  PlanningScenarioComparison,
  PlanningScenarioEditableKey,
  PlanningScenarioInsert,
  PlanningScenarioOverride,
  PlanningScenarioOverrideInput,
  PlanningScenarioType,
  PlanningScenarioUpdate,
  PlanningScenarioWithOverrides,
  JsonValue,
} from "@/types/planningScenario";
import type { SimulationOutcome, SimulationResult } from "@/services/simulation";
import type { SimulationRequest, SnapshotProvider, AssumptionProvider, EventProvider } from "@/services/simulation";
import type { MonthEndCloseItem, MonthReference } from "@/types/monthEndClose";

const SCENARIO_OVERRIDE_KEYS: PlanningScenarioEditableKey[] = [
  "retirement_target_age",
  "salary_growth_rate",
  "inflation_rate",
  "investment_return_rate",
  "expense_inflation_rate",
];

const SIMULATION_VERSION = "planning-scenarios-v1";

interface PlanningScenarioStore {
  listScenarios(userId: string): Promise<PlanningScenarioWithOverrides[]>;
  getScenario(userId: string, scenarioId: string): Promise<PlanningScenarioWithOverrides | null>;
  createScenario(userId: string, input: PlanningScenarioInsert): Promise<PlanningScenario>;
  updateScenario(userId: string, input: PlanningScenarioUpdate): Promise<PlanningScenario>;
  deleteScenario(userId: string, scenarioId: string): Promise<void>;
  saveOverrides(userId: string, scenarioId: string, overrides: PlanningScenarioOverrideInput[]): Promise<void>;
  loadOverrides(userId: string, scenarioId: string): Promise<PlanningScenarioOverride[]>;
}

interface PlanningScenarioServiceDependencies {
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

function mapMonthEndCloseItemToProjectedEntity(item: MonthEndCloseItem, month: string): ProjectedEntity {
  return {
    id: item.id,
    kind: mapItemKeyToEntityKind(item.item_key),
    name: item.entity_name,
    month,
    openingBalance: Number(item.actual_value ?? 0),
    contributionActivity: 0,
    growthActivity: 0,
    otherActivity: 0,
    closingBalance: Number(item.actual_value ?? 0),
    dimensions: mapEntityKindToDimensions(mapItemKeyToEntityKind(item.item_key)),
  };
}

function mapItemKeyToEntityKind(itemKey: MonthEndCloseItem["item_key"]): ProjectedEntity["kind"] {
  switch (itemKey) {
    case "bank_accounts":
      return "bank-account";
    case "mutual_funds":
      return "mutual-fund";
    case "stocks":
      return "stock";
    case "gold":
      return "gold";
    case "silver":
      return "silver";
    case "fixed_deposits":
      return "fixed-deposit";
    case "epf":
      return "epf";
    case "ppf":
      return "ppf";
    case "nps":
      return "nps";
    case "real_estate":
      return "real-estate";
    case "other_assets":
      return "other-asset";
    case "home_loans":
      return "home-loan";
    case "car_loans":
      return "car-loan";
    case "other_liabilities":
    default:
      return "other-liability";
  }
}

function mapEntityKindToDimensions(kind: ProjectedEntity["kind"]): ProjectedEntity["dimensions"] {
  return {
    assets: ["bank-account", "real-estate", "other-asset"].includes(kind),
    liabilities: ["home-loan", "car-loan", "other-liability"].includes(kind),
    investments: ["mutual-fund", "stock", "gold", "silver", "fixed-deposit", "epf", "ppf", "nps"].includes(kind),
    retirement: ["epf", "ppf", "nps"].includes(kind),
    cash: kind === "bank-account",
  };
}

function summarizeProjectedEntities(entities: ProjectedEntity[]): ProjectionBalanceState {
  return entities.reduce<ProjectionBalanceState>(
    (acc, entity) => {
      const amount = Number(entity.closingBalance ?? 0);

      if (entity.kind === "bank-account") {
        acc.cash += amount;
        acc.assets += amount;
      } else if (["real-estate", "other-asset"].includes(entity.kind)) {
        acc.assets += amount;
      } else if (["mutual-fund", "stock", "gold", "silver", "fixed-deposit"].includes(entity.kind)) {
        acc.investments += amount;
      } else if (["epf", "ppf", "nps"].includes(entity.kind)) {
        acc.investments += amount;
        acc.retirement += amount;
      } else {
        acc.liabilities += amount;
      }

      acc.netWorth = acc.assets + acc.investments + acc.retirement - acc.liabilities;
      return acc;
    },
    { assets: 0, liabilities: 0, investments: 0, retirement: 0, cash: 0, netWorth: 0 },
  );
}

class SupabasePlanningScenarioStore implements PlanningScenarioStore {
  private async authUserId() {
    const { user } = await requireAuthenticatedUser();
    return user.id;
  }

  private async queryScenarioRows(userId: string) {
    const client = assertSupabaseClient();
    const { data, error } = await client
      .from("planning_scenarios")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as PlanningScenario[];
  }

  async listScenarios(userId: string): Promise<PlanningScenarioWithOverrides[]> {
    const scenarios = await this.queryScenarioRows(userId);
    return Promise.all(scenarios.map(async (scenario) => ({ ...scenario, overrides: await this.loadOverrides(userId, scenario.id) })));
  }

  async getScenario(userId: string, scenarioId: string): Promise<PlanningScenarioWithOverrides | null> {
    const client = assertSupabaseClient();
    const { data, error } = await client.from("planning_scenarios").select("*").eq("user_id", userId).eq("id", scenarioId).limit(1);

    if (error) {
      throw new Error(error.message);
    }

    const row = (data?.[0] ?? null) as PlanningScenario | null;
    if (!row) {
      return null;
    }

    return {
      ...row,
      overrides: await this.loadOverrides(userId, row.id),
    };
  }

  async createScenario(userId: string, input: PlanningScenarioInsert): Promise<PlanningScenario> {
    const client = assertSupabaseClient();
    const { data, error } = await client
      .from("planning_scenarios")
      .insert({
        user_id: userId,
        name: input.name,
        description: input.description ?? null,
        type: input.type ?? "CUSTOM",
        is_default: Boolean(input.is_default),
        is_active: Boolean(input.is_active),
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as PlanningScenario;
  }

  async updateScenario(userId: string, input: PlanningScenarioUpdate): Promise<PlanningScenario> {
    const client = assertSupabaseClient();
    const { id, ...updates } = input;
    const { data, error } = await client
      .from("planning_scenarios")
      .update({
        name: updates.name,
        description: updates.description ?? null,
        type: updates.type,
        is_default: updates.is_default,
        is_active: updates.is_active,
      })
      .eq("user_id", userId)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as PlanningScenario;
  }

  async deleteScenario(userId: string, scenarioId: string): Promise<void> {
    const client = assertSupabaseClient();
    const { error } = await client.from("planning_scenarios").delete().eq("user_id", userId).eq("id", scenarioId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async saveOverrides(userId: string, scenarioId: string, overrides: PlanningScenarioOverrideInput[]): Promise<void> {
    const client = assertSupabaseClient();
    const normalized = overrides.filter((override) => isEditableKey(override.assumption_key));

    const { error: deleteError } = await client.from("planning_scenario_overrides").delete().eq("user_id", userId).eq("scenario_id", scenarioId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    if (normalized.length === 0) {
      return;
    }

    const { error } = await client.from("planning_scenario_overrides").upsert(
      normalized.map((override) => ({
        user_id: userId,
        scenario_id: scenarioId,
        assumption_key: override.assumption_key,
        override_value: override.override_value,
      })),
      { onConflict: "scenario_id,assumption_key" },
    );

    if (error) {
      throw new Error(error.message);
    }
  }

  async loadOverrides(userId: string, scenarioId: string): Promise<PlanningScenarioOverride[]> {
    const client = assertSupabaseClient();
    const { data, error } = await client
      .from("planning_scenario_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("scenario_id", scenarioId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as PlanningScenarioOverride[];
  }
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

async function buildSnapshotFromLatestMonthEnd(): Promise<{ id: string; month: string; openingBalances: ProjectionBalanceState; openingEntities: ProjectedEntity[] } | null> {
  const { client, user } = await requireAuthenticatedUser();

  const { data: closeRows, error: closeError } = await client
    .from("month_end_closes")
    .select("id, close_month, close_year")
    .eq("user_id", user.id)
    .eq("status", "closed")
    .order("close_year", { ascending: false })
    .order("close_month", { ascending: false })
    .order("version_number", { ascending: false })
    .limit(1);

  if (closeError) {
    throw new Error(closeError.message);
  }

  const closeRow = closeRows?.[0];
  if (!closeRow) {
    return null;
  }

  const { data: items, error: itemsError } = await client
    .from("month_end_close_items")
    .select("*")
    .eq("close_id", closeRow.id)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const month = `${closeRow.close_year}-${String(closeRow.close_month).padStart(2, "0")}`;
  const projectedEntities = ((items ?? []) as MonthEndCloseItem[]).map((item) => mapMonthEndCloseItemToProjectedEntity(item, month));
  const openingBalances = summarizeProjectedEntities(projectedEntities);

  return {
    id: closeRow.id,
    month,
    openingBalances,
    openingEntities: projectedEntities,
  };
}

export class PlanningScenarioService {
  constructor(private readonly dependencies: PlanningScenarioServiceDependencies = {}) {}

  private get store(): PlanningScenarioStore {
    return this.dependencies.store ?? new SupabasePlanningScenarioStore();
  }

  private get simulationEngine(): FinancialSimulationEngine {
    if (this.dependencies.simulationEngine) {
      return this.dependencies.simulationEngine;
    }

    return new FinancialSimulationEngine({
      snapshotProvider: {
        loadSnapshot: async () => buildSnapshotFromLatestMonthEnd(),
      },
      assumptionProvider: {
        loadAssumptions: async () => {
          return assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY);
        },
      },
      eventProvider: {
        loadEvents: async () => projectionEventsService.listEvents(DEFAULT_SCENARIO_KEY).catch(() => []),
      },
    });
  }

  private async userId(): Promise<string> {
    const { user } = await requireAuthenticatedUser();
    return user.id;
  }

  async listScenarios(): Promise<PlanningScenarioWithOverrides[]> {
    const userId = await this.userId();
    return this.store.listScenarios(userId);
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
    const bundle = await assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY);
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

export const planningScenarioService = new PlanningScenarioService();

export function createPlanningScenarioSimulationEngine(): FinancialSimulationEngine {
  return new FinancialSimulationEngine({
    snapshotProvider: {
      loadSnapshot: async () => buildSnapshotFromLatestMonthEnd(),
    },
    assumptionProvider: {
      loadAssumptions: async () => assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY),
    },
    eventProvider: {
      loadEvents: async () => projectionEventsService.listEvents(DEFAULT_SCENARIO_KEY).catch(() => []),
    },
  });
}
