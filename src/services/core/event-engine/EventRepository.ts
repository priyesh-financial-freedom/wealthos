import { supabase } from "@/lib/supabase/client";
import type {
  EventExecutionCreateInput,
  FinancialEvent,
  FinancialEventCreateInput,
  FinancialEventExecution,
  FinancialEventFilters,
  FinancialEventListOptions,
  FinancialEventListResult,
  FinancialEventUpdateInput,
} from "@/types/financialEvent";

interface FinancialEventRow {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  event_category: string;
  event_type: string;
  priority: string;
  scheduled_at: string;
  executed_at: string | null;
  amount: number | string;
  currency: string;
  status: string;
  correlation_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface FinancialEventExecutionRow {
  id: string;
  event_id: string;
  execution_start: string;
  execution_end: string;
  duration_ms: number;
  result: Record<string, unknown> | null;
  warnings: unknown;
  error_message: string | null;
  retry_count: number;
}

function assertSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  return supabase;
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function mapEvent(row: FinancialEventRow): FinancialEvent {
  return {
    id: row.id,
    userId: row.user_id,
    sourceType: row.source_type as FinancialEvent["sourceType"],
    sourceId: row.source_id,
    eventCategory: row.event_category as FinancialEvent["eventCategory"],
    eventType: row.event_type as FinancialEvent["eventType"],
    priority: row.priority as FinancialEvent["priority"],
    scheduledAt: row.scheduled_at,
    executedAt: row.executed_at,
    amount: toNumber(row.amount),
    currency: row.currency,
    status: row.status as FinancialEvent["status"],
    correlationId: row.correlation_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExecution(row: FinancialEventExecutionRow): FinancialEventExecution {
  return {
    id: row.id,
    eventId: row.event_id,
    executionStart: row.execution_start,
    executionEnd: row.execution_end,
    durationMs: row.duration_ms,
    result: row.result ?? {},
    warnings: Array.isArray(row.warnings) ? row.warnings.map((item) => String(item)) : [],
    errorMessage: row.error_message,
    retryCount: row.retry_count,
  };
}

export class EventRepository {
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

  async createEvent(input: FinancialEventCreateInput): Promise<FinancialEvent> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("financial_events")
      .insert({
        user_id: user.id,
        source_type: input.sourceType,
        source_id: input.sourceId,
        event_category: input.eventCategory,
        event_type: input.eventType,
        priority: input.priority,
        scheduled_at: input.scheduledAt,
        amount: Number(input.amount),
        currency: input.currency ?? "INR",
        status: input.status ?? "PENDING",
        correlation_id: input.correlationId,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapEvent(data as FinancialEventRow);
  }

  async updateEvent(eventId: string, updates: FinancialEventUpdateInput): Promise<FinancialEvent> {
    const { client, user } = await this.getAuthenticatedUser();
    const payload: Record<string, unknown> = {};

    if (updates.status !== undefined) {
      payload.status = updates.status;
    }
    if (updates.executedAt !== undefined) {
      payload.executed_at = updates.executedAt;
    }
    if (updates.metadata !== undefined) {
      payload.metadata = updates.metadata;
    }
    if (updates.priority !== undefined) {
      payload.priority = updates.priority;
    }
    if (updates.scheduledAt !== undefined) {
      payload.scheduled_at = updates.scheduledAt;
    }

    const { data, error } = await client
      .from("financial_events")
      .update(payload)
      .eq("user_id", user.id)
      .eq("id", eventId)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapEvent(data as FinancialEventRow);
  }

  async getEvent(eventId: string): Promise<FinancialEvent | null> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("financial_events")
      .select("*")
      .eq("user_id", user.id)
      .eq("id", eventId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return mapEvent(data as FinancialEventRow);
  }

  async listEvents(filters: FinancialEventFilters = {}, options: FinancialEventListOptions = {}): Promise<FinancialEventListResult> {
    const { client, user } = await this.getAuthenticatedUser();
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, options.pageSize ?? 25));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from("financial_events")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filters.status && filters.status !== "ALL") {
      query = query.eq("status", filters.status);
    }
    if (filters.category && filters.category !== "ALL") {
      query = query.eq("event_category", filters.category);
    }
    if (filters.sourceType && filters.sourceType !== "ALL") {
      query = query.eq("source_type", filters.sourceType);
    }
    if (filters.dateFrom) {
      query = query.gte("scheduled_at", filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte("scheduled_at", filters.dateTo);
    }

    const { data, error, count } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return {
      rows: (data ?? []).map((row) => mapEvent(row as FinancialEventRow)),
      total: Number(count ?? 0),
      page,
      pageSize,
    };
  }

  async listPendingEvents(asOf = new Date().toISOString(), limit = 500): Promise<FinancialEvent[]> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("financial_events")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["PENDING", "SCHEDULED"])
      .lte("scheduled_at", asOf)
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(Math.max(1, Math.min(limit, 1000)));

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapEvent(row as FinancialEventRow));
  }

  async listEventsByDate(startIso: string, endIso: string, options: { statuses?: FinancialEvent["status"][]; limit?: number } = {}): Promise<FinancialEvent[]> {
    const { client, user } = await this.getAuthenticatedUser();
    let query = client
      .from("financial_events")
      .select("*")
      .eq("user_id", user.id)
      .gte("scheduled_at", startIso)
      .lte("scheduled_at", endIso)
      .order("scheduled_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(Math.max(1, Math.min(options.limit ?? 500, 2000)));

    if (options.statuses && options.statuses.length > 0) {
      query = query.in("status", options.statuses);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapEvent(row as FinancialEventRow));
  }

  async listEventsByPolicy(sourceType: FinancialEvent["sourceType"], sourceId: string): Promise<FinancialEvent[]> {
    const { client, user } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("financial_events")
      .select("*")
      .eq("user_id", user.id)
      .eq("source_type", sourceType)
      .eq("source_id", sourceId)
      .order("scheduled_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => mapEvent(row as FinancialEventRow));
  }

  async createExecutionLog(input: EventExecutionCreateInput): Promise<FinancialEventExecution> {
    const { client } = await this.getAuthenticatedUser();
    const { data, error } = await client
      .from("financial_event_execution")
      .insert({
        event_id: input.eventId,
        execution_start: input.executionStart,
        execution_end: input.executionEnd,
        duration_ms: Math.max(0, Math.round(input.durationMs)),
        result: input.result,
        warnings: input.warnings ?? [],
        error_message: input.errorMessage ?? null,
        retry_count: input.retryCount ?? 0,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapExecution(data as FinancialEventExecutionRow);
  }

  async getExecutionHistory(eventId?: string, options: FinancialEventListOptions = {}): Promise<FinancialEventExecution[]> {
    const { client, user } = await this.getAuthenticatedUser();
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, options.pageSize ?? 50));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from("financial_event_execution")
      .select("*, financial_events!inner(user_id)")
      .eq("financial_events.user_id", user.id)
      .order("execution_start", { ascending: false })
      .range(from, to);

    if (eventId) {
      query = query.eq("event_id", eventId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row) => {
      const entry = row as unknown as FinancialEventExecutionRow;
      return mapExecution(entry);
    });
  }
}
