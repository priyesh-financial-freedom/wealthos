import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PlanningScenario,
  PlanningScenarioInsert,
  PlanningScenarioOverride,
  PlanningScenarioOverrideInput,
  PlanningScenarioUpdate,
  PlanningScenarioWithOverrides,
} from "@/types/planningScenario";
import type { ProjectionBalanceState, ProjectedEntity } from "@/types/projection";
import type { MonthEndCloseItem } from "@/types/monthEndClose";

export type SupabaseClientFactory = () => Promise<SupabaseClient>;

export interface MonthEndSnapshot {
  id: string;
  month: string;
  openingBalances: ProjectionBalanceState;
  openingEntities: ProjectedEntity[];
}

export interface PlanningScenarioStore {
  getAuthenticatedUserId(): Promise<string>;
  listScenarios(userId: string): Promise<PlanningScenarioWithOverrides[]>;
  getScenario(userId: string, scenarioId: string): Promise<PlanningScenarioWithOverrides | null>;
  createScenario(userId: string, input: PlanningScenarioInsert): Promise<PlanningScenario>;
  updateScenario(userId: string, input: PlanningScenarioUpdate): Promise<PlanningScenario>;
  deleteScenario(userId: string, scenarioId: string): Promise<void>;
  saveOverrides(userId: string, scenarioId: string, overrides: PlanningScenarioOverrideInput[]): Promise<void>;
  loadOverrides(userId: string, scenarioId: string): Promise<PlanningScenarioOverride[]>;
  loadLatestMonthEndSnapshot(userId: string): Promise<MonthEndSnapshot | null>;
}

interface MonthEndCloseRow {
  id: string;
  close_month: number;
  close_year: number;
}

function extractSupabaseMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Supabase request failed.";
  }

  const maybeError = error as { message?: unknown };
  if (typeof maybeError.message === "string" && maybeError.message.trim().length > 0) {
    return maybeError.message;
  }

  return "Supabase request failed.";
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

function mapMonthEndCloseItemToProjectedEntity(item: MonthEndCloseItem, month: string): ProjectedEntity {
  const kind = mapItemKeyToEntityKind(item.item_key);
  return {
    id: item.id,
    kind,
    name: item.entity_name,
    month,
    openingBalance: Number(item.actual_value ?? 0),
    contributionActivity: 0,
    growthActivity: 0,
    otherActivity: 0,
    closingBalance: Number(item.actual_value ?? 0),
    dimensions: mapEntityKindToDimensions(kind),
  };
}

function summarizeProjectedEntities(entities: ProjectedEntity[]): ProjectionBalanceState {
  return entities.reduce<ProjectionBalanceState>(
    (accumulator, entity) => {
      const amount = Number(entity.closingBalance ?? 0);

      if (entity.kind === "bank-account") {
        accumulator.cash += amount;
        accumulator.assets += amount;
      } else if (["real-estate", "other-asset"].includes(entity.kind)) {
        accumulator.assets += amount;
      } else if (["mutual-fund", "stock", "gold", "silver", "fixed-deposit"].includes(entity.kind)) {
        accumulator.investments += amount;
      } else if (["epf", "ppf", "nps"].includes(entity.kind)) {
        accumulator.investments += amount;
        accumulator.retirement += amount;
      } else {
        accumulator.liabilities += amount;
      }

      accumulator.netWorth = accumulator.assets + accumulator.investments + accumulator.retirement - accumulator.liabilities;
      return accumulator;
    },
    { assets: 0, liabilities: 0, investments: 0, retirement: 0, cash: 0, netWorth: 0 },
  );
}

export class PlanningScenarioRepository implements PlanningScenarioStore {
  constructor(private readonly clientFactory: SupabaseClientFactory) {}

  private async getClient() {
    return this.clientFactory();
  }

  async getAuthenticatedUserId(): Promise<string> {
    const client = await this.getClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      throw new Error("Authentication required.");
    }

    return user.id;
  }

  async listScenarios(userId: string): Promise<PlanningScenarioWithOverrides[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("planning_scenarios")
      .select("*")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    const scenarios = (data ?? []) as PlanningScenario[];
    return Promise.all(scenarios.map(async (scenario) => ({ ...scenario, overrides: await this.loadOverrides(userId, scenario.id) })));
  }

  async getScenario(userId: string, scenarioId: string): Promise<PlanningScenarioWithOverrides | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("planning_scenarios")
      .select("*")
      .eq("user_id", userId)
      .eq("id", scenarioId)
      .limit(1);

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    const scenario = (data?.[0] ?? null) as PlanningScenario | null;
    if (!scenario) {
      return null;
    }

    return {
      ...scenario,
      overrides: await this.loadOverrides(userId, scenario.id),
    };
  }

  async createScenario(userId: string, input: PlanningScenarioInsert): Promise<PlanningScenario> {
    const client = await this.getClient();
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
      throw new Error(extractSupabaseMessage(error));
    }

    return data as PlanningScenario;
  }

  async updateScenario(userId: string, input: PlanningScenarioUpdate): Promise<PlanningScenario> {
    const client = await this.getClient();
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
      throw new Error(extractSupabaseMessage(error));
    }

    return data as PlanningScenario;
  }

  async deleteScenario(userId: string, scenarioId: string): Promise<void> {
    const client = await this.getClient();
    const { error } = await client.from("planning_scenarios").delete().eq("user_id", userId).eq("id", scenarioId);

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }
  }

  async saveOverrides(userId: string, scenarioId: string, overrides: PlanningScenarioOverrideInput[]): Promise<void> {
    const client = await this.getClient();

    const { error: deleteError } = await client
      .from("planning_scenario_overrides")
      .delete()
      .eq("user_id", userId)
      .eq("scenario_id", scenarioId);

    if (deleteError) {
      throw new Error(extractSupabaseMessage(deleteError));
    }

    if (overrides.length === 0) {
      return;
    }

    const { error: upsertError } = await client.from("planning_scenario_overrides").upsert(
      overrides.map((override) => ({
        user_id: userId,
        scenario_id: scenarioId,
        assumption_key: override.assumption_key,
        override_value: override.override_value,
      })),
      { onConflict: "scenario_id,assumption_key" },
    );

    if (upsertError) {
      throw new Error(extractSupabaseMessage(upsertError));
    }
  }

  async loadOverrides(userId: string, scenarioId: string): Promise<PlanningScenarioOverride[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("planning_scenario_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("scenario_id", scenarioId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    return (data ?? []) as PlanningScenarioOverride[];
  }

  async loadLatestMonthEndSnapshot(userId: string): Promise<MonthEndSnapshot | null> {
    const client = await this.getClient();
    const { data: closeRows, error: closeError } = await client
      .from("month_end_closes")
      .select("id, close_month, close_year")
      .eq("user_id", userId)
      .eq("status", "closed")
      .order("close_year", { ascending: false })
      .order("close_month", { ascending: false })
      .order("version_number", { ascending: false })
      .limit(1);

    if (closeError) {
      throw new Error(extractSupabaseMessage(closeError));
    }

    const close = (closeRows?.[0] ?? null) as MonthEndCloseRow | null;
    if (!close) {
      return null;
    }

    const { data: items, error: itemError } = await client
      .from("month_end_close_items")
      .select("*")
      .eq("close_id", close.id)
      .order("sort_order", { ascending: true });

    if (itemError) {
      throw new Error(extractSupabaseMessage(itemError));
    }

    const month = `${close.close_year}-${String(close.close_month).padStart(2, "0")}`;
    const openingEntities = ((items ?? []) as MonthEndCloseItem[]).map((item) => mapMonthEndCloseItemToProjectedEntity(item, month));
    const openingBalances = summarizeProjectedEntities(openingEntities);

    return {
      id: close.id,
      month,
      openingBalances,
      openingEntities,
    };
  }
}
