import { supabase } from "@/lib/supabase/client";
import { assumptionsService, DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import { planningScenarioService } from "@/services/planning/scenarios";
import { projectionEventsService } from "@/services/projection";
import { FinancialSimulationEngine } from "@/services/simulation";
import type { SimulationResult } from "@/services/simulation";
import type {
  FinancialGoal,
  FinancialGoalInsert,
  FinancialGoalUpdate,
  FinancialGoalWithProgress,
  GoalProgress,
  GoalStatus,
  GoalSummary,
} from "@/types/financialGoal";
import type { ProjectedEntity, ProjectionBalanceState } from "@/types/projection";
import type { MonthEndCloseItem } from "@/types/monthEndClose";

interface GoalStore {
  listGoals(userId: string): Promise<FinancialGoal[]>;
  getGoal(userId: string, goalId: string): Promise<FinancialGoal | null>;
  createGoal(userId: string, input: FinancialGoalInsert): Promise<FinancialGoal>;
  updateGoal(userId: string, input: FinancialGoalUpdate): Promise<FinancialGoal>;
  deleteGoal(userId: string, goalId: string): Promise<void>;
  listScenarioNames(userId: string): Promise<Map<string, string>>;
  hasScenario(userId: string, scenarioId: string): Promise<boolean>;
}

interface GoalServiceDependencies {
  store?: GoalStore;
  simulationEngine?: FinancialSimulationEngine;
  scenarioSimulation?: (scenarioId: string) => Promise<SimulationResult>;
  now?: () => Date;
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

function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toMonthKey(dateValue: string): string {
  return dateValue.slice(0, 7);
}

function normalizeDate(dateValue: string): string {
  const normalized = new Date(dateValue);
  if (Number.isNaN(normalized.getTime())) {
    throw new Error("Invalid goal target date.");
  }

  return normalized.toISOString().slice(0, 10);
}

function normalizeCustomGoalType(goalType: FinancialGoal["goal_type"], customGoalType: string | null | undefined): string | null {
  if (goalType !== "CUSTOM") {
    return null;
  }

  const normalized = customGoalType?.trim() ?? "";
  return normalized || null;
}

function extractSupabaseErrorFields(error: unknown): {
  message: string | null;
  details: string | null;
  hint: string | null;
  code: string | null;
} {
  if (!error || typeof error !== "object") {
    return {
      message: null,
      details: null,
      hint: null,
      code: null,
    };
  }

  const maybeError = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  };

  return {
    message: typeof maybeError.message === "string" ? maybeError.message : null,
    details: typeof maybeError.details === "string" ? maybeError.details : null,
    hint: typeof maybeError.hint === "string" ? maybeError.hint : null,
    code: typeof maybeError.code === "string" ? maybeError.code : null,
  };
}

function pickProjectionValue(simulation: SimulationResult, targetMonth: string): { month: string; value: number } {
  const points = simulation.netWorthProjection.points;
  if (points.length === 0) {
    return { month: simulation.summary.projectionEnd, value: 0 };
  }

  const exactOrFuture = points.find((point) => point.month >= targetMonth);
  if (exactOrFuture) {
    return { month: exactOrFuture.month, value: Number(exactOrFuture.value ?? 0) };
  }

  const fallback = points[points.length - 1];
  return { month: fallback.month, value: Number(fallback.value ?? 0) };
}

function deriveGoalStatus(goal: FinancialGoal, progressPercent: number, today: Date): GoalStatus {
  if (goal.is_completed) {
    return "COMPLETED";
  }

  if (progressPercent <= 0) {
    return "NOT_STARTED";
  }

  if (progressPercent >= 100) {
    return "ON_TRACK";
  }

  const targetDate = new Date(goal.target_date);
  if (!Number.isNaN(targetDate.getTime()) && targetDate.getTime() < today.getTime()) {
    return "AT_RISK";
  }

  if (progressPercent >= 70) {
    return "ON_TRACK";
  }

  if (progressPercent >= 40) {
    return "NEEDS_ATTENTION";
  }

  return "AT_RISK";
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

class SupabaseGoalStore implements GoalStore {
  async listGoals(userId: string): Promise<FinancialGoal[]> {
    const client = assertSupabaseClient();
    const { data, error } = await client.from("financial_goals").select("*").eq("user_id", userId).order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []) as FinancialGoal[];
  }

  async getGoal(userId: string, goalId: string): Promise<FinancialGoal | null> {
    const client = assertSupabaseClient();
    const { data, error } = await client.from("financial_goals").select("*").eq("user_id", userId).eq("id", goalId).maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? null) as FinancialGoal | null;
  }

  async createGoal(userId: string, input: FinancialGoalInsert): Promise<FinancialGoal> {
    const client = assertSupabaseClient();
    const customGoalType = normalizeCustomGoalType(input.goal_type, input.custom_goal_type);

    if (input.goal_type === "CUSTOM" && !customGoalType) {
      throw new Error("Custom goal type is required when goal type is CUSTOM.");
    }

    const insertPayload = {
      user_id: userId,
      name: input.name,
      goal_type: input.goal_type,
      custom_goal_type: customGoalType,
      target_amount: Number(input.target_amount ?? 0),
      target_date: normalizeDate(input.target_date),
      priority: input.priority,
      status: "NOT_STARTED",
      funding_source: input.funding_source ?? null,
      linked_scenario_id: input.linked_scenario_id ?? null,
      notes: input.notes ?? null,
      is_completed: false,
    };

    console.info("[TEMP][GoalCreateDebug][SupabaseGoalStore.createGoal] beforeInsert", {
      userId,
      linkedScenarioId: insertPayload.linked_scenario_id,
      goalType: insertPayload.goal_type,
      customGoalType: insertPayload.custom_goal_type,
      payload: insertPayload,
    });

    console.info("[TEMP][GoalCreateDebug][SupabaseGoalStore.createGoal] insertPayloadRaw", insertPayload);

    const {
      data: { session },
    } = await client.auth.getSession();

    console.log("[TEMP] Session User:", session?.user?.id);
    console.log("[TEMP] GoalService userId:", userId);
    console.log("[TEMP] Payload userId:", insertPayload.user_id);

    const result = await client
      .from("financial_goals")
      .insert(insertPayload)
      .select("*")
      .single();

    console.dir(result, { depth: null });

    if (result.error) {
      throw result.error;
    }

    return result.data as FinancialGoal;
  }

  async updateGoal(userId: string, input: FinancialGoalUpdate): Promise<FinancialGoal> {
    const client = assertSupabaseClient();
    const { id, ...updates } = input;
    const existingGoal = await this.getGoal(userId, id);

    if (!existingGoal) {
      throw new Error("Goal not found.");
    }

    const resolvedGoalType = updates.goal_type ?? existingGoal.goal_type;
    const customGoalTypeInput =
      typeof updates.custom_goal_type !== "undefined" ? updates.custom_goal_type : existingGoal.custom_goal_type;
    const normalizedCustomGoalType = normalizeCustomGoalType(resolvedGoalType, customGoalTypeInput);

    if (resolvedGoalType === "CUSTOM" && !normalizedCustomGoalType) {
      throw new Error("Custom goal type is required when goal type is CUSTOM.");
    }

    const payload: Record<string, unknown> = {
      ...updates,
      custom_goal_type: normalizedCustomGoalType,
    };

    if (typeof updates.target_amount !== "undefined") {
      payload.target_amount = Number(updates.target_amount);
    }

    if (updates.target_date) {
      payload.target_date = normalizeDate(updates.target_date);
    }

    const { data, error } = await client.from("financial_goals").update(payload).eq("user_id", userId).eq("id", id).select("*").single();

    if (error) {
      throw new Error(error.message);
    }

    return data as FinancialGoal;
  }

  async deleteGoal(userId: string, goalId: string): Promise<void> {
    const client = assertSupabaseClient();
    const { error } = await client.from("financial_goals").delete().eq("user_id", userId).eq("id", goalId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async listScenarioNames(userId: string): Promise<Map<string, string>> {
    const client = assertSupabaseClient();
    const { data, error } = await client.from("planning_scenarios").select("id, name").eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }

    return new Map((data ?? []).map((scenario) => [String(scenario.id), String(scenario.name)]));
  }

  async hasScenario(userId: string, scenarioId: string): Promise<boolean> {
    const client = assertSupabaseClient();
    const { data, error } = await client
      .from("planning_scenarios")
      .select("id")
      .eq("user_id", userId)
      .eq("id", scenarioId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return Boolean(data?.id);
  }
}

export class GoalService {
  constructor(private readonly dependencies: GoalServiceDependencies = {}) {}

  private get store(): GoalStore {
    return this.dependencies.store ?? new SupabaseGoalStore();
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
        loadAssumptions: async () => assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY),
      },
      eventProvider: {
        loadEvents: async () => projectionEventsService.listEvents(DEFAULT_SCENARIO_KEY).catch(() => []),
      },
    });
  }

  private get scenarioSimulation() {
    return this.dependencies.scenarioSimulation ?? ((scenarioId: string) => planningScenarioService.runSimulation(scenarioId));
  }

  private get now() {
    return this.dependencies.now ?? (() => new Date());
  }

  private async userId(): Promise<string> {
    const { user } = await requireAuthenticatedUser();
    return user.id;
  }

  async createGoal(input: FinancialGoalInsert): Promise<FinancialGoalWithProgress> {
    const userId = await this.userId();
    let linkedScenarioId: string | null = input.linked_scenario_id ?? null;

    console.info("[TEMP][GoalCreateDebug][GoalService.createGoal] inputPayload", {
      userId,
      input,
    });

    console.info("[TEMP][GoalCreateDebug][GoalService.createGoal] start", {
      userId,
      providedLinkedScenarioId: input.linked_scenario_id ?? null,
      goalType: input.goal_type,
      customGoalType: input.custom_goal_type ?? null,
    });

    try {
      if (linkedScenarioId) {
        const hasLinkedScenario = await this.store.hasScenario(userId, linkedScenarioId);
        if (!hasLinkedScenario) {
          throw new Error("Linked scenario was not found.");
        }
      } else {
        const scenarios = await planningScenarioService.listScenarios();
        console.info("[TEMP][GoalCreateDebug][GoalService.createGoal] listScenariosResult", {
          userId,
          scenarios,
        });
        const defaultScenario = scenarios.find((scenario) => scenario.is_default) ?? scenarios[0] ?? null;
        linkedScenarioId = defaultScenario?.id ?? null;

        console.info("[TEMP][GoalCreateDebug][GoalService.createGoal] resolvedDefaultScenario", {
          userId,
          scenarioCount: scenarios.length,
          defaultScenarioId: defaultScenario?.id ?? null,
          linkedScenarioId,
        });
      }

      console.info("[TEMP][GoalCreateDebug][GoalService.createGoal] resolvedLinkedScenarioId", {
        userId,
        linkedScenarioId,
      });

      const createPayload: FinancialGoalInsert = {
        ...input,
        linked_scenario_id: linkedScenarioId,
      };

      console.info("[TEMP][GoalCreateDebug][GoalService.createGoal] beforeStoreCreate", {
        userId,
        linkedScenarioId: createPayload.linked_scenario_id ?? null,
        goalType: createPayload.goal_type,
        customGoalType: createPayload.custom_goal_type ?? null,
      });

      const created = await this.store.createGoal(userId, createPayload);

      console.info("[TEMP][GoalCreateDebug][GoalService.createGoal] success", {
        userId,
        goalId: created.id,
        linkedScenarioId: created.linked_scenario_id,
      });

      return this.enrichGoal(created, userId, true);
    } catch (error) {
      const supabaseError = extractSupabaseErrorFields(error);
      console.error("[TEMP][GoalCreateDebug][GoalService.createGoal] error", {
        userId,
        linkedScenarioId,
        goalType: input.goal_type,
        customGoalType: input.custom_goal_type ?? null,
        supabaseError,
        error,
      });

      if (error instanceof Error) {
        console.error("[TEMP][GoalCreateDebug][GoalService.createGoal] errorJavaScript", {
          userId,
          message: error.message,
          stack: error.stack,
        });
      }

      throw error;
    }
  }

  async updateGoal(input: FinancialGoalUpdate): Promise<FinancialGoalWithProgress> {
    const userId = await this.userId();

    if (input.linked_scenario_id) {
      const hasLinkedScenario = await this.store.hasScenario(userId, input.linked_scenario_id);
      if (!hasLinkedScenario) {
        throw new Error("Linked scenario was not found.");
      }
    }

    const patched = {
      ...input,
      status: input.is_completed ? "COMPLETED" : input.status,
    };

    const updated = await this.store.updateGoal(userId, patched);
    return this.enrichGoal(updated, userId, true);
  }

  async deleteGoal(goalId: string, options?: { confirmCompleted?: boolean }): Promise<void> {
    const userId = await this.userId();
    const goal = await this.getGoalRecordOrThrow(goalId, userId);

    if (goal.is_completed && !options?.confirmCompleted) {
      throw new Error("Completed goals require confirmation before deletion.");
    }

    await this.store.deleteGoal(userId, goalId);
  }

  async archiveGoal(goalId: string): Promise<FinancialGoalWithProgress> {
    const userId = await this.userId();
    const goal = await this.getGoalRecordOrThrow(goalId, userId);
    const archiveStamp = this.now().toISOString().slice(0, 10);
    const notes = goal.notes ? `${goal.notes}\nArchived on ${archiveStamp}` : `Archived on ${archiveStamp}`;

    const archived = await this.store.updateGoal(userId, {
      id: goalId,
      status: "COMPLETED",
      is_completed: true,
      notes,
    });

    return this.enrichGoal(archived, userId, false);
  }

  async listGoals(options?: { includeProgress?: boolean }): Promise<FinancialGoalWithProgress[]> {
    const startedAt = Date.now();
    console.log("[GoalService] listGoals start", { options });
    const userId = await this.userId();
    console.log("[GoalService] listGoals after userId", { userId, durationMs: Date.now() - startedAt });
    const [goals, scenarioNames] = await Promise.all([this.store.listGoals(userId), this.store.listScenarioNames(userId)]);
    console.log("[GoalService] listGoals fetched base records", {
      goalsCount: goals.length,
      scenarioNamesCount: scenarioNames.size,
      durationMs: Date.now() - startedAt,
    });

    const includeProgress = options?.includeProgress ?? true;
    console.log("[GoalService] listGoals before enrich", { includeProgress, goalsCount: goals.length });
    const enriched = await Promise.all(goals.map((goal) => this.enrichGoal(goal, userId, includeProgress, scenarioNames)));
    console.log("[GoalService] listGoals complete", {
      goalsCount: enriched.length,
      durationMs: Date.now() - startedAt,
    });

    return enriched;
  }

  async getGoal(goalId: string): Promise<FinancialGoalWithProgress | null> {
    const userId = await this.userId();
    const goal = await this.store.getGoal(userId, goalId);

    if (!goal) {
      return null;
    }

    return this.enrichGoal(goal, userId, true);
  }

  async linkScenario(goalId: string, scenarioId: string | null): Promise<FinancialGoalWithProgress> {
    const userId = await this.userId();

    if (scenarioId) {
      const hasScenario = await this.store.hasScenario(userId, scenarioId);
      if (!hasScenario) {
        throw new Error("Scenario not found.");
      }
    }

    const updated = await this.store.updateGoal(userId, {
      id: goalId,
      linked_scenario_id: scenarioId,
    });

    return this.enrichGoal(updated, userId, true);
  }

  async calculateGoalProgress(goalId: string): Promise<GoalProgress> {
    const userId = await this.userId();
    const goal = await this.getGoalRecordOrThrow(goalId, userId);
    const progress = await this.calculateGoalProgressForRecord(goal, userId);

    if (goal.status !== progress.status) {
      await this.store.updateGoal(userId, { id: goal.id, status: progress.status });
    }

    return progress;
  }

  async markCompleted(goalId: string): Promise<FinancialGoalWithProgress> {
    const userId = await this.userId();
    const updated = await this.store.updateGoal(userId, {
      id: goalId,
      is_completed: true,
      status: "COMPLETED",
    });

    return this.enrichGoal(updated, userId, false);
  }

  async getSummary(): Promise<GoalSummary> {
    const goals = await this.listGoals({ includeProgress: true });

    return {
      totalGoals: goals.length,
      completedGoals: goals.filter((goal) => goal.status === "COMPLETED").length,
      onTrackGoals: goals.filter((goal) => goal.status === "ON_TRACK").length,
      atRiskGoals: goals.filter((goal) => goal.status === "AT_RISK").length,
    };
  }

  private async getGoalRecordOrThrow(goalId: string, userId: string): Promise<FinancialGoal> {
    const goal = await this.store.getGoal(userId, goalId);
    if (!goal) {
      throw new Error("Goal not found.");
    }

    return goal;
  }

  private async enrichGoal(goal: FinancialGoal, userId: string, includeProgress: boolean, scenarioNames?: Map<string, string>): Promise<FinancialGoalWithProgress> {
    const startedAt = Date.now();
    console.log("[GoalService] enrichGoal start", {
      goalId: goal.id,
      includeProgress,
      linkedScenarioId: goal.linked_scenario_id ?? null,
    });
    const linkedScenarioName = goal.linked_scenario_id ? (scenarioNames ?? (await this.store.listScenarioNames(userId))).get(goal.linked_scenario_id) ?? null : null;
    if (goal.linked_scenario_id) {
      console.log("[GoalService] enrichGoal resolved scenario name", {
        goalId: goal.id,
        linkedScenarioId: goal.linked_scenario_id,
        linkedScenarioName,
      });
    }

    console.log("[GoalService] enrichGoal before progress calculation", {
      goalId: goal.id,
      includeProgress,
    });
    const progress = includeProgress ? await this.calculateGoalProgressForRecord(goal, userId) : null;
    console.log("[GoalService] enrichGoal after progress calculation", {
      goalId: goal.id,
      hasProgress: Boolean(progress),
      durationMs: Date.now() - startedAt,
    });

    return {
      ...goal,
      progress,
      linked_scenario_name: linkedScenarioName,
      status: progress?.status ?? goal.status,
    };
  }

  private async calculateGoalProgressForRecord(goal: FinancialGoal, userId: string): Promise<GoalProgress> {
    const simulation = await this.runGoalSimulation(goal, userId);
    const targetMonth = toMonthKey(goal.target_date);
    const projection = pickProjectionValue(simulation, targetMonth);
    const targetAmount = Math.max(0, Number(goal.target_amount ?? 0));
    const projectedAmount = Number(projection.value ?? 0);
    const ratio = targetAmount === 0 ? 0 : projectedAmount / targetAmount;
    const progressPercent = roundTo(Math.max(0, Math.min(100, ratio * 100)));
    const status = deriveGoalStatus(goal, progressPercent, this.now());

    return {
      goal_id: goal.id,
      target_amount: targetAmount,
      projected_amount: roundTo(projectedAmount),
      progress_percent: progressPercent,
      status,
      projection_month: projection.month,
    };
  }

  private async runGoalSimulation(goal: FinancialGoal, userId: string): Promise<SimulationResult> {
    const startedAt = Date.now();
    console.log("[GoalService] runGoalSimulation start", {
      goalId: goal.id,
      userId,
      linkedScenarioId: goal.linked_scenario_id ?? null,
    });

    if (goal.linked_scenario_id) {
      console.log("[GoalService] runGoalSimulation before hasScenario", {
        goalId: goal.id,
        linkedScenarioId: goal.linked_scenario_id,
      });
      const hasScenario = await this.store.hasScenario(userId, goal.linked_scenario_id);
      console.log("[GoalService] runGoalSimulation after hasScenario", {
        goalId: goal.id,
        linkedScenarioId: goal.linked_scenario_id,
        hasScenario,
      });
      if (!hasScenario) {
        throw new Error("Linked scenario was not found.");
      }

      console.log("[GoalService] runGoalSimulation before scenarioSimulation", {
        goalId: goal.id,
        linkedScenarioId: goal.linked_scenario_id,
      });
      const scenarioResult = await this.scenarioSimulation(goal.linked_scenario_id);
      console.log("[GoalService] runGoalSimulation after scenarioSimulation", {
        goalId: goal.id,
        durationMs: Date.now() - startedAt,
      });
      return scenarioResult;
    }

    console.log("[GoalService] runGoalSimulation before simulationEngine.run", {
      goalId: goal.id,
    });
    const outcome = await this.simulationEngine.run({
      snapshotId: goal.id,
    });
    console.log("[GoalService] runGoalSimulation after simulationEngine.run", {
      goalId: goal.id,
      ok: outcome.ok,
      durationMs: Date.now() - startedAt,
    });

    if (!outcome.ok) {
      throw new Error(outcome.error.message);
    }

    return outcome.result;
  }
}

export const goalService = new GoalService();
