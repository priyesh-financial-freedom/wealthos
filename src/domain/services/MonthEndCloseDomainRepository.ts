import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertValidFinancialNumber,
  assertValidNullableFinancialNumber,
  MAX_PERCENTAGE_ABS_VALUE_24_4,
} from "@/lib/financialNumberValidation";
import type { MonthEndCloseItemType, MonthEndCloseStatus } from "@/types/monthEndClose";
import { FinancialPeriodStatus } from "@/types/monthEndCloseDomain";
import type { FinancialPeriodTransitionAuditEntry, MonthEndCloseAggregate, MonthEndCloseLineItem, MonthEndCloseLineItemInput } from "@/types/monthEndCloseDomain";

export type MonthEndCloseSupabaseClientFactory = () => Promise<SupabaseClient>;

export interface MonthEndCloseDomainRepository {
  getAuthenticatedUserId(): Promise<string>;
  getCloseById(userId: string, closeId: string): Promise<MonthEndCloseAggregate | null>;
  getDraftForMonth(userId: string, closeYear: number, closeMonth: number): Promise<MonthEndCloseAggregate | null>;
  getLatestVersionForMonth(userId: string, closeYear: number, closeMonth: number): Promise<MonthEndCloseAggregate | null>;
  getLatestClosed(userId: string): Promise<MonthEndCloseAggregate | null>;
  createClose(input: {
    userId: string;
    closeMonth: number;
    closeYear: number;
    versionNumber: number;
    status: MonthEndCloseStatus;
    supersedesCloseId: string | null;
    closedAt: string | null;
  }): Promise<MonthEndCloseAggregate>;
  updateCloseStatus(input: {
    id: string;
    userId: string;
    status: MonthEndCloseStatus;
    closedAt: string | null;
  }): Promise<MonthEndCloseAggregate>;
  saveReopenFields(id: string, userId: string, reopenReason: string, reopenedAt: string): Promise<void>;
  replaceItems(closeId: string, userId: string, items: MonthEndCloseLineItemInput[]): Promise<void>;
  listItems(closeId: string): Promise<MonthEndCloseLineItem[]>;
  appendTransitionAudit(input: {
    closeId: string;
    userId: string;
    fromStatus: FinancialPeriodStatus;
    toStatus: FinancialPeriodStatus;
    reason: string | null;
    transitionedAt: string;
  }): Promise<void>;
  listTransitionAudit(closeId: string): Promise<FinancialPeriodTransitionAuditEntry[]>;
}

interface MonthEndCloseRow {
  id: string;
  user_id: string;
  close_month: number;
  close_year: number;
  version_number: number;
  status: MonthEndCloseStatus;
  supersedes_close_id: string | null;
  closed_at: string | null;
  reopen_reason: string | null;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MonthEndCloseItemRow {
  id: string;
  close_id: string;
  user_id: string;
  entity_id: string;
  entity_type: string;
  entity_name: string;
  item_key: string;
  item_label: string;
  item_type: MonthEndCloseItemType;
  sort_order: number;
  opening_value: number | string;
  projected_value: number | string;
  actual_value: number | string;
  actual_balance: number | string | null;
  is_required: boolean;
  absolute_variance: number | string;
  percentage_variance: number | string | null;
  created_at: string;
  updated_at: string;
}

interface MonthEndCloseTransitionAuditRow {
  id: string;
  close_id: string;
  user_id: string;
  from_status: FinancialPeriodStatus;
  to_status: FinancialPeriodStatus;
  reason: string | null;
  transitioned_at: string;
  created_at: string;
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
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

function mapClose(row: MonthEndCloseRow): MonthEndCloseAggregate {
  return {
    id: row.id,
    userId: row.user_id,
    closeMonth: row.close_month,
    closeYear: row.close_year,
    versionNumber: row.version_number,
    status: row.status,
    supersedesCloseId: row.supersedes_close_id,
    closedAt: row.closed_at,
    reopenReason: row.reopen_reason,
    reopenedAt: row.reopened_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: MonthEndCloseItemRow): MonthEndCloseLineItem {
  return {
    id: row.id,
    closeId: row.close_id,
    userId: row.user_id,
    entityId: String(row.entity_id),
    entityType: row.entity_type,
    entityName: row.entity_name,
    itemKey: row.item_key as MonthEndCloseLineItem["itemKey"],
    itemLabel: row.item_label,
    itemType: row.item_type,
    sortOrder: row.sort_order,
    openingValue: toNumber(row.opening_value),
    projectedValue: toNumber(row.projected_value),
    actualValue: toNumber(row.actual_value),
    actualBalance: row.actual_balance === null ? null : toNumber(row.actual_balance),
    isRequired: row.is_required,
    absoluteVariance: toNumber(row.absolute_variance),
    percentageVariance: row.percentage_variance === null ? null : toNumber(row.percentage_variance),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPersistedItem(input: { closeId: string; userId: string; item: MonthEndCloseLineItemInput }) {
  const actualBalanceRaw = input.item.actualBalance === undefined ? input.item.actualValue : input.item.actualBalance;
  const openingValue = assertValidFinancialNumber(input.item.openingValue ?? 0, `${input.item.entityName} opening_value`, { roundToScale: 2 });
  const projectedValue = assertValidFinancialNumber(input.item.projectedValue ?? 0, `${input.item.entityName} projected_value`, { roundToScale: 2 });
  const actualValue = assertValidFinancialNumber(actualBalanceRaw ?? input.item.actualValue ?? 0, `${input.item.entityName} actual_value`, {
    roundToScale: 2,
  });
  const absoluteVariance = assertValidFinancialNumber(actualValue - projectedValue, `${input.item.entityName} absolute_variance`, {
    roundToScale: 2,
  });
  const percentageVariance = projectedValue === 0
    ? null
    : assertValidNullableFinancialNumber((absoluteVariance / projectedValue) * 100, `${input.item.entityName} percentage_variance`, {
      roundToScale: 4,
      maxAbs: MAX_PERCENTAGE_ABS_VALUE_24_4,
    });
  const actualBalance = actualBalanceRaw === null || actualBalanceRaw === undefined
    ? null
    : assertValidFinancialNumber(actualBalanceRaw, `${input.item.entityName} actual_balance`, { roundToScale: 2 });

  return {
    close_id: input.closeId,
    user_id: input.userId,
    entity_id: input.item.entityId,
    entity_type: input.item.entityType,
    entity_name: input.item.entityName,
    item_key: input.item.itemKey,
    item_label: input.item.itemLabel,
    item_type: input.item.itemType,
    sort_order: input.item.sortOrder,
    opening_value: openingValue,
    projected_value: projectedValue,
    actual_value: actualValue,
    actual_balance: actualBalance,
    is_required: input.item.isRequired !== false,
    absolute_variance: absoluteVariance,
    percentage_variance: percentageVariance,
  };
}

function mapTransitionAudit(row: MonthEndCloseTransitionAuditRow): FinancialPeriodTransitionAuditEntry {
  return {
    id: row.id,
    closeId: row.close_id,
    userId: row.user_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason,
    transitionedAt: row.transitioned_at,
    createdAt: row.created_at,
  };
}

export class SupabaseMonthEndCloseDomainRepository implements MonthEndCloseDomainRepository {
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

  async getCloseById(userId: string, closeId: string): Promise<MonthEndCloseAggregate | null> {
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

    const row = (data?.[0] ?? null) as MonthEndCloseRow | null;
    return row ? mapClose(row) : null;
  }

  async getDraftForMonth(userId: string, closeYear: number, closeMonth: number): Promise<MonthEndCloseAggregate | null> {
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

    const row = (data?.[0] ?? null) as MonthEndCloseRow | null;
    return row ? mapClose(row) : null;
  }

  async getLatestVersionForMonth(userId: string, closeYear: number, closeMonth: number): Promise<MonthEndCloseAggregate | null> {
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

    const row = (data?.[0] ?? null) as MonthEndCloseRow | null;
    return row ? mapClose(row) : null;
  }

  async getLatestClosed(userId: string): Promise<MonthEndCloseAggregate | null> {
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

    const row = (data?.[0] ?? null) as MonthEndCloseRow | null;
    return row ? mapClose(row) : null;
  }

  async createClose(input: {
    userId: string;
    closeMonth: number;
    closeYear: number;
    versionNumber: number;
    status: MonthEndCloseStatus;
    supersedesCloseId: string | null;
    closedAt: string | null;
  }): Promise<MonthEndCloseAggregate> {
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

    return mapClose(data as MonthEndCloseRow);
  }

  async updateCloseStatus(input: {
    id: string;
    userId: string;
    status: MonthEndCloseStatus;
    closedAt: string | null;
  }): Promise<MonthEndCloseAggregate> {
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

    return mapClose(data as MonthEndCloseRow);
  }

  async saveReopenFields(id: string, userId: string, reopenReason: string, reopenedAt: string): Promise<void> {
    const client = await this.getClient();
    const { error } = await client
      .from("month_end_closes")
      .update({ reopen_reason: reopenReason, reopened_at: reopenedAt })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }
  }

  async replaceItems(closeId: string, userId: string, items: MonthEndCloseLineItemInput[]): Promise<void> {
    const client = await this.getClient();

    const { error: deleteError } = await client
      .from("month_end_close_items")
      .delete()
      .eq("close_id", closeId)
      .eq("user_id", userId);

    if (deleteError) {
      throw new Error(extractSupabaseMessage(deleteError));
    }

    if (items.length === 0) {
      return;
    }

    const rows = items.map((item) => toPersistedItem({ closeId, userId, item }));
    const { error: insertError } = await client.from("month_end_close_items").insert(rows);

    if (insertError) {
      throw new Error(extractSupabaseMessage(insertError));
    }
  }

  async listItems(closeId: string): Promise<MonthEndCloseLineItem[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_close_items")
      .select("*")
      .eq("close_id", closeId)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    return ((data ?? []) as MonthEndCloseItemRow[]).map(mapItem);
  }

  async appendTransitionAudit(input: {
    closeId: string;
    userId: string;
    fromStatus: FinancialPeriodStatus;
    toStatus: FinancialPeriodStatus;
    reason: string | null;
    transitionedAt: string;
  }): Promise<void> {
    const client = await this.getClient();
    const { error } = await client.from("month_end_close_period_audit").insert({
      close_id: input.closeId,
      user_id: input.userId,
      from_status: input.fromStatus,
      to_status: input.toStatus,
      reason: input.reason,
      transitioned_at: input.transitionedAt,
    });

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }
  }

  async listTransitionAudit(closeId: string): Promise<FinancialPeriodTransitionAuditEntry[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from("month_end_close_period_audit")
      .select("*")
      .eq("close_id", closeId)
      .order("transitioned_at", { ascending: true });

    if (error) {
      throw new Error(extractSupabaseMessage(error));
    }

    return ((data ?? []) as MonthEndCloseTransitionAuditRow[]).map(mapTransitionAudit);
  }
}
