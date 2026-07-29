import type { SupabaseClient } from "@supabase/supabase-js";

import type { MonthEndClose, MonthEndCloseItem } from "@/types/monthEndClose";

export type MonthEndCloseSupabaseClientFactory = () => Promise<SupabaseClient>;

export interface MonthEndCloseItemUpsertRow {
  close_id: string;
  user_id: string;
  entity_id: string;
  entity_type: string;
  entity_name: string;
  item_key: MonthEndCloseItem["item_key"];
  item_label: string;
  item_type: MonthEndCloseItem["item_type"];
  sort_order: number;
  opening_value: number;
  projected_value: number;
  actual_value: number;
  absolute_variance: number;
  percentage_variance: number | null;
}

interface CreateMonthEndCloseInput {
  userId: string;
  closeMonth: number;
  closeYear: number;
  versionNumber: number;
  status: "draft" | "closed";
  supersedesCloseId: string | null;
  closedAt: string | null;
}

interface UpdateMonthEndCloseStatusInput {
  id: string;
  userId: string;
  status: "draft" | "closed";
  closedAt: string | null;
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

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function normalizeMonthEndClose(row: MonthEndClose): MonthEndClose {
  return row;
}

function normalizeMonthEndCloseItem(row: MonthEndCloseItem): MonthEndCloseItem {
  return {
    ...row,
    entity_id: String(row.entity_id),
    entity_type: row.entity_type,
    entity_name: row.entity_name,
    opening_value: toNumber(row.opening_value),
    projected_value: toNumber(row.projected_value),
    actual_value: toNumber(row.actual_value),
    absolute_variance: toNumber(row.absolute_variance),
    percentage_variance: row.percentage_variance === null ? null : toNumber(row.percentage_variance),
  };
}

export class MonthEndCloseRepository {
  constructor(private readonly clientFactory: MonthEndCloseSupabaseClientFactory) {}

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

  async getLatestClosedMonthEndClose(userId: string): Promise<MonthEndClose | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_closes")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "closed")
      .order("close_year", { ascending: false })
      .order("close_month", { ascending: false })
      .order("version_number", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    const row = (data?.[0] ?? null) as MonthEndClose | null;
    return row ? normalizeMonthEndClose(row) : null;
  }

  async getEarliestOpenMonthEndClose(userId: string): Promise<MonthEndClose | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_closes")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "draft")
      .order("close_year", { ascending: true })
      .order("close_month", { ascending: true })
      .order("version_number", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    const row = (data?.[0] ?? null) as MonthEndClose | null;
    return row ? normalizeMonthEndClose(row) : null;
  }

  async getLatestVersionForMonth(userId: string, closeYear: number, closeMonth: number): Promise<MonthEndClose | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_closes")
      .select("*")
      .eq("user_id", userId)
      .eq("close_year", closeYear)
      .eq("close_month", closeMonth)
      .order("version_number", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    const row = (data?.[0] ?? null) as MonthEndClose | null;
    return row ? normalizeMonthEndClose(row) : null;
  }

  async getDraftForMonth(userId: string, closeYear: number, closeMonth: number): Promise<MonthEndClose | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_closes")
      .select("*")
      .eq("user_id", userId)
      .eq("close_year", closeYear)
      .eq("close_month", closeMonth)
      .eq("status", "draft")
      .order("version_number", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    const row = (data?.[0] ?? null) as MonthEndClose | null;
    return row ? normalizeMonthEndClose(row) : null;
  }

  async getCloseItems(closeId: string): Promise<MonthEndCloseItem[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_close_items")
      .select("*")
      .eq("close_id", closeId)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    return ((data ?? []) as MonthEndCloseItem[]).map((row) => normalizeMonthEndCloseItem(row));
  }

  async getCloseById(userId: string, closeId: string): Promise<MonthEndClose | null> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_closes")
      .select("*")
      .eq("id", closeId)
      .eq("user_id", userId)
      .limit(1);

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    const row = (data?.[0] ?? null) as MonthEndClose | null;
    return row ? normalizeMonthEndClose(row) : null;
  }

  async createMonthEndClose(input: CreateMonthEndCloseInput): Promise<MonthEndClose> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_closes")
      .insert({
        user_id: input.userId,
        close_month: input.closeMonth,
        close_year: input.closeYear,
        version_number: input.versionNumber,
        status: input.status,
        supersedes_close_id: input.supersedesCloseId,
        closed_at: input.closedAt,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    return normalizeMonthEndClose(data as MonthEndClose);
  }

  async updateMonthEndCloseStatus(input: UpdateMonthEndCloseStatusInput): Promise<MonthEndClose> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_closes")
      .update({
        status: input.status,
        closed_at: input.closedAt,
      })
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    return normalizeMonthEndClose(data as MonthEndClose);
  }

  async deleteCloseItemsByIds(itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) {
      return;
    }

    const client = await this.getClient();
    const { error } = await client.from("month_end_close_items").delete().in("id", itemIds);

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }
  }

  async upsertCloseItems(rows: MonthEndCloseItemUpsertRow[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    const client = await this.getClient();
    const { error } = await client.from("month_end_close_items").upsert(rows, {
      onConflict: "close_id,entity_type,entity_id",
    });

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }
  }
}
