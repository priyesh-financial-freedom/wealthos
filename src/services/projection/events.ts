import { supabase } from "@/lib/supabase/client";
import type { FinancialEvent, ProjectionModule, ProjectionEventType, ProjectionFrequency } from "@/types/projection";

export const DEFAULT_PROJECTION_SCENARIO_KEY = "default";

interface FinancialEventRow {
  id: string;
  user_id: string;
  scenario_key: string;
  module: ProjectionModule;
  event_type: ProjectionEventType;
  event_name: string;
  amount: number;
  event_date: string;
  frequency: ProjectionFrequency;
  repeat_every_months: number | null;
  starts_on: string | null;
  ends_on: string | null;
  is_enabled: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface FinancialEventInsert {
  scenarioKey?: string;
  module: ProjectionModule;
  type: ProjectionEventType;
  name: string;
  amount: number;
  date: string;
  frequency?: ProjectionFrequency;
  repeatEveryMonths?: number | null;
  startsOn?: string | null;
  endsOn?: string | null;
  isEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface FinancialEventUpdate extends Partial<FinancialEventInsert> {
  id: string;
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

function mapRowToEvent(row: FinancialEventRow): FinancialEvent {
  return {
    id: row.id,
    module: row.module,
    type: row.event_type,
    name: row.event_name,
    amount: Number(row.amount ?? 0),
    date: row.event_date,
    frequency: row.frequency,
    repeatEveryMonths: row.repeat_every_months,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isEnabled: Boolean(row.is_enabled),
    metadata: row.metadata ?? {},
  };
}

function mapInsertToRow(userId: string, input: FinancialEventInsert) {
  return {
    user_id: userId,
    scenario_key: input.scenarioKey ?? DEFAULT_PROJECTION_SCENARIO_KEY,
    module: input.module,
    event_type: input.type,
    event_name: input.name,
    amount: Number(input.amount ?? 0),
    event_date: input.date,
    frequency: input.frequency ?? "one-time",
    repeat_every_months: input.repeatEveryMonths ?? null,
    starts_on: input.startsOn ?? null,
    ends_on: input.endsOn ?? null,
    is_enabled: input.isEnabled ?? true,
    metadata: input.metadata ?? {},
  };
}

export class ProjectionEventsService {
  async listEvents(scenarioKey = DEFAULT_PROJECTION_SCENARIO_KEY): Promise<FinancialEvent[]> {
    const { client, user } = await requireAuthenticatedUser();

    const { data, error } = await client
      .from("financial_events")
      .select("*")
      .eq("user_id", user.id)
      .eq("scenario_key", scenarioKey)
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as FinancialEventRow[]).map(mapRowToEvent);
  }

  async createEvent(input: FinancialEventInsert): Promise<FinancialEvent> {
    const { client, user } = await requireAuthenticatedUser();

    const { data, error } = await client
      .from("financial_events")
      .insert(mapInsertToRow(user.id, input))
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRowToEvent(data as FinancialEventRow);
  }

  async updateEvent(input: FinancialEventUpdate): Promise<FinancialEvent> {
    const { client, user } = await requireAuthenticatedUser();

    const updatePayload: Record<string, unknown> = {};

    if (input.scenarioKey !== undefined) {
      updatePayload.scenario_key = input.scenarioKey;
    }
    if (input.module !== undefined) {
      updatePayload.module = input.module;
    }
    if (input.type !== undefined) {
      updatePayload.event_type = input.type;
    }
    if (input.name !== undefined) {
      updatePayload.event_name = input.name;
    }
    if (input.amount !== undefined) {
      updatePayload.amount = Number(input.amount ?? 0);
    }
    if (input.date !== undefined) {
      updatePayload.event_date = input.date;
    }
    if (input.frequency !== undefined) {
      updatePayload.frequency = input.frequency;
    }
    if (input.repeatEveryMonths !== undefined) {
      updatePayload.repeat_every_months = input.repeatEveryMonths;
    }
    if (input.startsOn !== undefined) {
      updatePayload.starts_on = input.startsOn;
    }
    if (input.endsOn !== undefined) {
      updatePayload.ends_on = input.endsOn;
    }
    if (input.isEnabled !== undefined) {
      updatePayload.is_enabled = input.isEnabled;
    }
    if (input.metadata !== undefined) {
      updatePayload.metadata = input.metadata;
    }

    const { data, error } = await client
      .from("financial_events")
      .update(updatePayload)
      .eq("id", input.id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapRowToEvent(data as FinancialEventRow);
  }

  async deleteEvent(id: string): Promise<void> {
    const { client, user } = await requireAuthenticatedUser();

    const { error } = await client
      .from("financial_events")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

export const projectionEventsService = new ProjectionEventsService();
