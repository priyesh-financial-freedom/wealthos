import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PLANNING_ASSUMPTION_COLUMN_BY_KEY, PLANNING_ASSUMPTION_KEYS } from "./AssumptionTypes";
import type {
  PlanningAssumptionKey,
  PlanningAssumptionOverrides,
  PlanningAssumptionRecord,
  PlanningGoalSummary,
  PlanningScenarioSummary,
} from "./AssumptionTypes";

type SupabaseClientFactory = () => Promise<SupabaseClient>;

interface PlanningAssumptionRow {
  id: string;
  user_id: string;
  scenario_id: string | null;
  goal_id: string | null;
  current_age: number | null;
  retirement_age: number | null;
  life_expectancy: number | null;
  spouse_life_expectancy: number | null;
  salary_growth_rate: number | null;
  bonus_growth_rate: number | null;
  business_income_growth: number | null;
  rental_income_growth: number | null;
  other_income_growth: number | null;
  general_inflation: number | null;
  medical_inflation: number | null;
  education_inflation: number | null;
  lifestyle_inflation: number | null;
  property_inflation: number | null;
  luxury_inflation: number | null;
  equity_return: number | null;
  debt_return: number | null;
  gold_return: number | null;
  silver_return: number | null;
  real_estate_return: number | null;
  cash_return: number | null;
  epf_return: number | null;
  ppf_return: number | null;
  nps_equity_return: number | null;
  nps_debt_return: number | null;
  home_loan_interest: number | null;
  car_loan_interest: number | null;
  personal_loan_interest: number | null;
  loan_prepayment_strategy: string | null;
  income_tax_rate: number | null;
  capital_gains_tax: number | null;
  dividend_tax: number | null;
  rental_tax_rate: number | null;
  withdrawal_rate: number | null;
  retirement_expense_ratio: number | null;
  legacy_target: number | null;
  emergency_corpus_months: number | null;
  goal_funding_priority: string | null;
  created_at: string;
  updated_at: string;
}

interface PlanningScenarioRow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  is_default: boolean;
  is_active: boolean;
  updated_at: string;
}

interface PlanningGoalRow {
  id: string;
  name: string;
  linked_scenario_id: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

function assignRecordValue<Key extends PlanningAssumptionKey>(
  record: PlanningAssumptionRecord,
  key: Key,
  value: PlanningAssumptionRecord[Key],
) {
  record[key] = value;
}

function isLoanPrepaymentStrategy(value: string): value is Exclude<PlanningAssumptionRecord["loanPrepaymentStrategy"], undefined> {
  return value === "NONE" || value === "AVALANCHE" || value === "SNOWBALL" || value === "HYBRID";
}

function isGoalFundingPriority(value: string): value is Exclude<PlanningAssumptionRecord["goalFundingPriority"], undefined> {
  return value === "LOW" || value === "MEDIUM" || value === "HIGH";
}

function mapPlanningAssumptionRow(row: PlanningAssumptionRow): PlanningAssumptionRecord {
  const record: PlanningAssumptionRecord = {
    id: row.id,
    userId: row.user_id,
    scenarioId: row.scenario_id,
    goalId: row.goal_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  for (const key of PLANNING_ASSUMPTION_KEYS) {
    const column = PLANNING_ASSUMPTION_COLUMN_BY_KEY[key] as keyof PlanningAssumptionRow;
    const value = row[column];
    if (value !== null) {
      if (key === "loanPrepaymentStrategy" && typeof value === "string" && isLoanPrepaymentStrategy(value)) {
        assignRecordValue(record, key, value);
      }

      if (key === "goalFundingPriority" && typeof value === "string" && isGoalFundingPriority(value)) {
        assignRecordValue(record, key, value);
      }

      if (key !== "loanPrepaymentStrategy" && key !== "goalFundingPriority" && typeof value === "number") {
        assignRecordValue(record, key, value);
      }
    }
  }

  return record;
}

function mapScenarioRow(row: PlanningScenarioRow): Omit<PlanningScenarioSummary, "preset"> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type,
    isDefault: row.is_default,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

function mapGoalRow(row: PlanningGoalRow): PlanningGoalSummary {
  return {
    id: row.id,
    name: row.name,
    linkedScenarioId: row.linked_scenario_id,
    priority: row.priority,
  };
}

function serializeOverrides(overrides: PlanningAssumptionOverrides) {
  const payload: Record<string, number | string | null> = {};

  for (const key of PLANNING_ASSUMPTION_KEYS) {
    if (!(key in overrides)) {
      continue;
    }

    const value = overrides[key];
    if (typeof value === "undefined") {
      continue;
    }

    payload[PLANNING_ASSUMPTION_COLUMN_BY_KEY[key]] = value;
  }

  return payload;
}

export class PlanningAssumptionRepository {
  constructor(private readonly clientFactory: SupabaseClientFactory) {}

  private async getClient() {
    return this.clientFactory();
  }

  async getAuthenticatedUser(): Promise<{ client: SupabaseClient; user: User }> {
    const client = await this.getClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();

    if (error || !user) {
      throw new Error("Authentication required.");
    }

    return { client, user };
  }

  async listScenarios(userId: string) {
    const client = await this.getClient();
    const { data, error } = await client
      .from("planning_scenarios")
      .select("id, name, description, type, is_default, is_active, updated_at")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapScenarioRow(row as PlanningScenarioRow));
  }

  async createScenario(
    userId: string,
    input: { name: string; description: string | null; type: string; isDefault: boolean; isActive: boolean },
  ) {
    const client = await this.getClient();
    const { data, error } = await client
      .from("planning_scenarios")
      .insert({
        user_id: userId,
        name: input.name,
        description: input.description,
        type: input.type,
        is_default: input.isDefault,
        is_active: input.isActive,
      })
      .select("id, name, description, type, is_default, is_active, updated_at")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapScenarioRow(data as PlanningScenarioRow);
  }

  async updateScenarioFlags(userId: string, scenarioId: string, patch: { isDefault?: boolean; isActive?: boolean }) {
    const client = await this.getClient();

    if (patch.isDefault) {
      const { error: clearDefaultError } = await client
        .from("planning_scenarios")
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("is_default", true);

      if (clearDefaultError) {
        throw new Error(clearDefaultError.message);
      }
    }

    if (patch.isActive) {
      const { error: clearActiveError } = await client
        .from("planning_scenarios")
        .update({ is_active: false })
        .eq("user_id", userId)
        .eq("is_active", true);

      if (clearActiveError) {
        throw new Error(clearActiveError.message);
      }
    }

    const updatePayload: Record<string, boolean> = {};
    if (typeof patch.isDefault === "boolean") {
      updatePayload.is_default = patch.isDefault;
    }
    if (typeof patch.isActive === "boolean") {
      updatePayload.is_active = patch.isActive;
    }

    if (Object.keys(updatePayload).length === 0) {
      return;
    }

    const { error } = await client
      .from("planning_scenarios")
      .update(updatePayload)
      .eq("user_id", userId)
      .eq("id", scenarioId);

    if (error) {
      throw new Error(error.message);
    }
  }

  async getGoalSummary(userId: string, goalId: string) {
    const client = await this.getClient();
    const { data, error } = await client
      .from("financial_goals")
      .select("id, name, linked_scenario_id, priority")
      .eq("user_id", userId)
      .eq("id", goalId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return mapGoalRow(data as PlanningGoalRow);
  }

  async getUserDefaults(userId: string) {
    return this.findAssumptionRecord(userId, { scenarioId: null, goalId: null });
  }

  async getScenarioOverrides(userId: string, scenarioId: string) {
    return this.findAssumptionRecord(userId, { scenarioId, goalId: null });
  }

  async getGoalOverrides(userId: string, goalId: string) {
    return this.findAssumptionRecord(userId, { scenarioId: null, goalId });
  }

  private async findAssumptionRecord(
    userId: string,
    scope: { scenarioId: string | null; goalId: string | null },
  ) {
    const client = await this.getClient();
    let query = client
      .from("planning_assumptions")
      .select("*")
      .eq("user_id", userId);

    query = scope.scenarioId === null ? query.is("scenario_id", null) : query.eq("scenario_id", scope.scenarioId);
    query = scope.goalId === null ? query.is("goal_id", null) : query.eq("goal_id", scope.goalId);

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return mapPlanningAssumptionRow(data as PlanningAssumptionRow);
  }

  async upsertAssumptionRecord(
    userId: string,
    scope: { scenarioId: string | null; goalId: string | null },
    overrides: PlanningAssumptionOverrides,
  ) {
    const client = await this.getClient();
    const existing = await this.findAssumptionRecord(userId, scope);
    const payload = serializeOverrides(overrides);

    if (existing) {
      const { data, error } = await client
        .from("planning_assumptions")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return mapPlanningAssumptionRow(data as PlanningAssumptionRow);
    }

    const { data, error } = await client
      .from("planning_assumptions")
      .insert({
        user_id: userId,
        scenario_id: scope.scenarioId,
        goal_id: scope.goalId,
        ...payload,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapPlanningAssumptionRow(data as PlanningAssumptionRow);
  }

  async deleteAssumptionRecord(userId: string, scope: { scenarioId: string | null; goalId: string | null }) {
    const client = await this.getClient();
    let query = client.from("planning_assumptions").delete().eq("user_id", userId);

    query = scope.scenarioId === null ? query.is("scenario_id", null) : query.eq("scenario_id", scope.scenarioId);
    query = scope.goalId === null ? query.is("goal_id", null) : query.eq("goal_id", scope.goalId);

    const { error } = await query;
    if (error) {
      throw new Error(error.message);
    }
  }
}