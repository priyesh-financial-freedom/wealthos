import { supabase } from "@/lib/supabase/client";
import type {
  ContributionEvent,
  ContributionEventType,
  ContributionHistory,
  ContributionPolicy,
  ContributionPolicyCreateInput,
  ContributionPolicyGroup,
  ContributionPolicyGroupCreateInput,
  ContributionPolicyStatus,
  ContributionPolicyUpdateInput,
} from "@/types/contributionPolicy";

interface ContributionPolicyRow {
  id: string;
  user_id: string;
  policy_group_id: string | null;
  name: string;
  description: string | null;
  target_account: string | null;
  amount: number | string;
  currency: string;
  frequency: string;
  start_date: string;
  end_date: string | null;
  growth_strategy: string;
  growth_rate: number | string | null;
  growth_amount: number | string | null;
  min_limit_amount: number | string | null;
  max_limit_amount: number | string | null;
  cash_protection_enabled: boolean | null;
  goal_reference: string | null;
  formula_expression: string | null;
  formula_variables: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ContributionPolicyGroupRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface ContributionEventRow {
  id: string;
  user_id: string;
  policy_id: string;
  event_type: string;
  event_payload: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
}

interface ContributionHistoryRow {
  id: string;
  user_id: string;
  policy_id: string;
  change_type: string;
  snapshot: Record<string, unknown>;
  notes: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
}

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function mapPolicy(row: ContributionPolicyRow): ContributionPolicy {
  return {
    id: row.id,
    userId: row.user_id,
    policyGroupId: row.policy_group_id,
    name: row.name,
    description: row.description,
    targetAccount: row.target_account,
    amount: toNumber(row.amount),
    currency: row.currency,
    frequency: row.frequency as ContributionPolicy["frequency"],
    startDate: row.start_date,
    endDate: row.end_date,
    growthStrategy: row.growth_strategy as ContributionPolicy["growthStrategy"],
    growthRate: row.growth_rate === null ? null : toNumber(row.growth_rate),
    growthAmount: row.growth_amount === null ? null : toNumber(row.growth_amount),
    minLimitAmount: row.min_limit_amount === null ? null : toNumber(row.min_limit_amount),
    maxLimitAmount: row.max_limit_amount === null ? null : toNumber(row.max_limit_amount),
    cashProtectionEnabled: Boolean(row.cash_protection_enabled),
    goalReference: row.goal_reference,
    formulaExpression: row.formula_expression,
    formulaVariables: row.formula_variables,
    status: row.status as ContributionPolicyStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPolicyGroup(row: ContributionPolicyGroupRow): ContributionPolicyGroup {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: ContributionEventRow): ContributionEvent {
  return {
    id: row.id,
    userId: row.user_id,
    policyId: row.policy_id,
    eventType: row.event_type as ContributionEventType,
    eventPayload: row.event_payload ?? {},
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHistory(row: ContributionHistoryRow): ContributionHistory {
  return {
    id: row.id,
    userId: row.user_id,
    policyId: row.policy_id,
    changeType: row.change_type as ContributionHistory["changeType"],
    snapshot: row.snapshot,
    notes: row.notes,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ContributionRepository {
  async getAuthenticatedUser() {
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

  async listPolicies(): Promise<ContributionPolicy[]> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("contribution_policies")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapPolicy(row as ContributionPolicyRow));
  }

  async listPolicyGroups(): Promise<ContributionPolicyGroup[]> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("contribution_policy_groups")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapPolicyGroup(row as ContributionPolicyGroupRow));
  }

  async createPolicyGroup(input: ContributionPolicyGroupCreateInput): Promise<ContributionPolicyGroup> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("contribution_policy_groups")
      .insert({
        user_id: user.id,
        name: input.name,
        description: input.description ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapPolicyGroup(data as ContributionPolicyGroupRow);
  }

  async getPolicy(policyId: string): Promise<ContributionPolicy | null> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("contribution_policies")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", policyId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return mapPolicy(data as ContributionPolicyRow);
  }

  async createPolicy(input: ContributionPolicyCreateInput): Promise<ContributionPolicy> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("contribution_policies")
      .insert({
        user_id: user.id,
        policy_group_id: input.policyGroupId ?? null,
        name: input.name,
        description: input.description ?? null,
        target_account: input.targetAccount ?? null,
        amount: Number(input.amount),
        currency: input.currency ?? "INR",
        frequency: input.frequency,
        start_date: input.startDate,
        end_date: input.endDate ?? null,
        growth_strategy: input.growthStrategy,
        growth_rate: input.growthRate ?? null,
        growth_amount: input.growthAmount ?? null,
        min_limit_amount: input.minLimitAmount ?? null,
        max_limit_amount: input.maxLimitAmount ?? null,
        cash_protection_enabled: input.cashProtectionEnabled ?? false,
        goal_reference: input.goalReference ?? null,
        formula_expression: input.formulaExpression ?? null,
        formula_variables: input.formulaVariables ?? null,
        status: "ACTIVE",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapPolicy(data as ContributionPolicyRow);
  }

  async updatePolicy(input: ContributionPolicyUpdateInput): Promise<ContributionPolicy> {
    const { client, user } = await this.getAuthenticatedUser();
    const payload: Record<string, unknown> = {};

    if (input.policyGroupId !== undefined) {
      payload.policy_group_id = input.policyGroupId;
    }
    if (input.name !== undefined) {
      payload.name = input.name;
    }
    if (input.description !== undefined) {
      payload.description = input.description;
    }
    if (input.targetAccount !== undefined) {
      payload.target_account = input.targetAccount;
    }
    if (input.amount !== undefined) {
      payload.amount = Number(input.amount);
    }
    if (input.currency !== undefined) {
      payload.currency = input.currency;
    }
    if (input.frequency !== undefined) {
      payload.frequency = input.frequency;
    }
    if (input.startDate !== undefined) {
      payload.start_date = input.startDate;
    }
    if (input.endDate !== undefined) {
      payload.end_date = input.endDate;
    }
    if (input.growthStrategy !== undefined) {
      payload.growth_strategy = input.growthStrategy;
    }
    if (input.growthRate !== undefined) {
      payload.growth_rate = input.growthRate;
    }
    if (input.growthAmount !== undefined) {
      payload.growth_amount = input.growthAmount;
    }
    if (input.minLimitAmount !== undefined) {
      payload.min_limit_amount = input.minLimitAmount;
    }
    if (input.maxLimitAmount !== undefined) {
      payload.max_limit_amount = input.maxLimitAmount;
    }
    if (input.cashProtectionEnabled !== undefined) {
      payload.cash_protection_enabled = input.cashProtectionEnabled;
    }
    if (input.goalReference !== undefined) {
      payload.goal_reference = input.goalReference;
    }
    if (input.formulaExpression !== undefined) {
      payload.formula_expression = input.formulaExpression;
    }
    if (input.formulaVariables !== undefined) {
      payload.formula_variables = input.formulaVariables;
    }

    const { data, error } = await client
      .from("contribution_policies")
      .update(payload)
      .eq("user_id", user.id)
      .eq("id", input.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapPolicy(data as ContributionPolicyRow);
  }

  async updatePolicyStatus(policyId: string, status: ContributionPolicyStatus): Promise<ContributionPolicy> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("contribution_policies")
      .update({ status })
      .eq("user_id", user.id)
      .eq("id", policyId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapPolicy(data as ContributionPolicyRow);
  }

  async createEvent(input: {
    policyId: string;
    eventType: ContributionEventType;
    payload?: Record<string, unknown>;
  }): Promise<ContributionEvent> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("contribution_policy_events")
      .insert({
        user_id: user.id,
        policy_id: input.policyId,
        event_type: input.eventType,
        event_payload: input.payload ?? {},
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapEvent(data as ContributionEventRow);
  }

  async listEvents(policyId?: string): Promise<ContributionEvent[]> {
    const { client, user } = await this.getAuthenticatedUser();
    let query = client
      .from("contribution_policy_events")
      .select("*")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false });

    if (policyId) {
      query = query.eq("policy_id", policyId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapEvent(row as ContributionEventRow));
  }

  async createHistory(input: {
    policyId: string;
    changeType: ContributionHistory["changeType"];
    snapshot: Record<string, unknown>;
    notes?: string | null;
  }): Promise<ContributionHistory> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("contribution_policy_history")
      .insert({
        user_id: user.id,
        policy_id: input.policyId,
        change_type: input.changeType,
        snapshot: input.snapshot,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapHistory(data as ContributionHistoryRow);
  }

  async listHistory(policyId?: string): Promise<ContributionHistory[]> {
    const { client, user } = await this.getAuthenticatedUser();
    let query = client
      .from("contribution_policy_history")
      .select("*")
      .eq("user_id", user.id)
      .order("recorded_at", { ascending: false });

    if (policyId) {
      query = query.eq("policy_id", policyId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapHistory(row as ContributionHistoryRow));
  }
}
