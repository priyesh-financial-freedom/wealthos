import type { MonthEndCloseStatus } from "@/types/monthEndClose";
import {
  FinancialPeriodDomainError,
  FinancialPeriodDomainErrorCode,
  FinancialPeriodStatus,
  MonthEndCloseBalanceDomainError,
  MonthEndCloseBalanceDomainErrorCode,
} from "@/types/monthEndCloseDomain";
import type {
  FinancialPeriodTransitionAuditEntry,
  FinancialPeriodTransitionRequest,
  MonthEndCloseAggregate,
  MonthEndCloseDraftUpsertInput,
  MonthEndCloseLineItem,
  MonthEndCloseLineItemInput,
} from "@/types/monthEndCloseDomain";

import type { MonthEndCloseDomainRepository } from "./MonthEndCloseDomainRepository";

export interface SaveMonthEndCloseDraftResult {
  close: MonthEndCloseAggregate;
  items: MonthEndCloseLineItem[];
}

function normalizePersistedItems(items: MonthEndCloseLineItemInput[]): MonthEndCloseLineItemInput[] {
  return [...items]
    .map((item) => ({
      ...item,
      openingValue: Number(item.openingValue ?? 0),
      projectedValue: Number(item.projectedValue ?? 0),
      actualValue: Number(item.actualValue ?? 0),
      actualBalance:
        item.actualBalance === null || item.actualBalance === undefined
          ? null
          : Number(item.actualBalance),
      isRequired: item.isRequired !== false,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.itemLabel.localeCompare(right.itemLabel));
}

function validateActualBalances(items: MonthEndCloseLineItemInput[]) {
  for (const item of items) {
    const isRequired = item.isRequired !== false;
    const balanceFromInput = item.actualBalance === undefined ? item.actualValue : item.actualBalance;

    if (isRequired && (balanceFromInput === null || balanceFromInput === undefined)) {
      throw new MonthEndCloseBalanceDomainError({
        code: MonthEndCloseBalanceDomainErrorCode.REQUIRED_ACTUAL_BALANCE_MISSING,
        message: `Required line item '${item.itemLabel}' must include an actual balance.`,
      });
    }

    if (balanceFromInput !== null && balanceFromInput !== undefined && Number(balanceFromInput) < 0) {
      throw new MonthEndCloseBalanceDomainError({
        code: MonthEndCloseBalanceDomainErrorCode.NEGATIVE_ACTUAL_BALANCE,
        message: `Line item '${item.itemLabel}' cannot have a negative actual balance.`,
      });
    }
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeReason(reason: string | null | undefined): string | null {
  const normalized = String(reason ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function mapCloseStatusToFinancialPeriodStatus(status: MonthEndCloseStatus): FinancialPeriodStatus {
  return status === "closed" ? FinancialPeriodStatus.CLOSED : FinancialPeriodStatus.OPEN;
}

function mapFinancialPeriodStatusToCloseStatus(status: FinancialPeriodStatus): MonthEndCloseStatus {
  return status === FinancialPeriodStatus.CLOSED ? "closed" : "draft";
}

function isValidTransition(fromStatus: FinancialPeriodStatus, toStatus: FinancialPeriodStatus): boolean {
  if (fromStatus === FinancialPeriodStatus.OPEN && toStatus === FinancialPeriodStatus.CLOSED) {
    return true;
  }

  if (fromStatus === FinancialPeriodStatus.CLOSED && toStatus === FinancialPeriodStatus.OPEN) {
    return true;
  }

  return false;
}

function assertValidTransition(params: {
  fromStatus: FinancialPeriodStatus;
  toStatus: FinancialPeriodStatus;
  reason: string | null;
}) {
  if (!isValidTransition(params.fromStatus, params.toStatus)) {
    throw new FinancialPeriodDomainError({
      code: FinancialPeriodDomainErrorCode.INVALID_TRANSITION,
      message: `Invalid period transition: ${params.fromStatus} -> ${params.toStatus}.`,
    });
  }

  if (params.fromStatus === FinancialPeriodStatus.CLOSED && params.toStatus === FinancialPeriodStatus.OPEN && !params.reason) {
    throw new FinancialPeriodDomainError({
      code: FinancialPeriodDomainErrorCode.REOPEN_REASON_REQUIRED,
      message: "A reason is required to reopen a closed financial period.",
    });
  }
}

function assertDraft(close: MonthEndCloseAggregate) {
  if (close.status !== "draft") {
    throw new Error("Only draft month-end close records can be edited.");
  }
}

function resolveVersionNumber(latest: MonthEndCloseAggregate | null): number {
  return latest ? latest.versionNumber + 1 : 1;
}

export class MonthEndCloseDomainService {
  constructor(private readonly repository: MonthEndCloseDomainRepository) {}

  async getAuthenticatedUserId(): Promise<string> {
    return this.repository.getAuthenticatedUserId();
  }

  async saveDraft(input: MonthEndCloseDraftUpsertInput): Promise<SaveMonthEndCloseDraftResult> {
    const userId = input.userId;
    validateActualBalances(input.items);
    const items = normalizePersistedItems(input.items);

    let close: MonthEndCloseAggregate | null = null;

    if (input.closeId) {
      close = await this.repository.getCloseById(userId, input.closeId);
      if (!close) {
        throw new Error("Month-end close record not found.");
      }
      assertDraft(close);
    } else {
      close = await this.repository.getDraftForMonth(userId, input.closeYear, input.closeMonth);
    }

    if (!close) {
      const latestVersion = await this.repository.getLatestVersionForMonth(userId, input.closeYear, input.closeMonth);
      close = await this.repository.createClose({
        userId,
        closeMonth: input.closeMonth,
        closeYear: input.closeYear,
        versionNumber: resolveVersionNumber(latestVersion),
        status: "draft",
        supersedesCloseId: null,
        closedAt: null,
      });
    }

    await this.repository.replaceItems(close.id, userId, items);
    const persistedItems = await this.repository.listItems(close.id);

    return {
      close,
      items: persistedItems,
    };
  }

  async closeMonth(input: MonthEndCloseDraftUpsertInput): Promise<SaveMonthEndCloseDraftResult> {
    const result = await this.saveDraft(input);
    const transition = await this.transitionPeriodStatus({
      userId: input.userId,
      closeId: result.close.id,
      toStatus: FinancialPeriodStatus.CLOSED,
      reason: null,
    });

    return {
      close: transition.close,
      items: result.items,
    };
  }

  async getCloseById(userId: string, closeId: string): Promise<SaveMonthEndCloseDraftResult | null> {
    const close = await this.repository.getCloseById(userId, closeId);
    if (!close) {
      return null;
    }

    const items = await this.repository.listItems(close.id);
    return {
      close,
      items,
    };
  }

  async getDraftForMonth(userId: string, closeYear: number, closeMonth: number): Promise<SaveMonthEndCloseDraftResult | null> {
    const close = await this.repository.getDraftForMonth(userId, closeYear, closeMonth);
    if (!close) {
      return null;
    }

    const items = await this.repository.listItems(close.id);
    return {
      close,
      items,
    };
  }

  async changeStatus(input: { userId: string; closeId: string; status: MonthEndCloseStatus }): Promise<MonthEndCloseAggregate> {
    const toStatus = mapCloseStatusToFinancialPeriodStatus(input.status);
    const transitioned = await this.transitionPeriodStatus({
      userId: input.userId,
      closeId: input.closeId,
      toStatus,
      reason: null,
    });

    return transitioned.close;
  }

  async transitionPeriodStatus(input: FinancialPeriodTransitionRequest): Promise<{
    close: MonthEndCloseAggregate;
    audit: FinancialPeriodTransitionAuditEntry;
  }> {
    const existing = await this.repository.getCloseById(input.userId, input.closeId);
    if (!existing) {
      throw new FinancialPeriodDomainError({
        code: FinancialPeriodDomainErrorCode.PERIOD_NOT_FOUND,
        message: "Month-end close record not found.",
      });
    }

    const fromStatus = mapCloseStatusToFinancialPeriodStatus(existing.status);
    const reason = normalizeReason(input.reason);

    assertValidTransition({
      fromStatus,
      toStatus: input.toStatus,
      reason,
    });

    const transitionedAt = nowIso();
    const updatedClose = await this.repository.updateCloseStatus({
      id: existing.id,
      userId: input.userId,
      status: mapFinancialPeriodStatusToCloseStatus(input.toStatus),
      closedAt: input.toStatus === FinancialPeriodStatus.CLOSED ? transitionedAt : null,
    });

    await this.repository.appendTransitionAudit({
      closeId: existing.id,
      userId: input.userId,
      fromStatus,
      toStatus: input.toStatus,
      reason,
      transitionedAt,
    });

    const audit = (await this.repository.listTransitionAudit(existing.id)).at(-1);
    if (!audit) {
      throw new Error("Failed to persist transition audit entry.");
    }

    return {
      close: updatedClose,
      audit,
    };
  }

  async listTransitionAudit(userId: string, closeId: string): Promise<FinancialPeriodTransitionAuditEntry[]> {
    const existing = await this.repository.getCloseById(userId, closeId);
    if (!existing) {
      throw new FinancialPeriodDomainError({
        code: FinancialPeriodDomainErrorCode.PERIOD_NOT_FOUND,
        message: "Month-end close record not found.",
      });
    }

    return this.repository.listTransitionAudit(closeId);
  }

  async reopenMonth(userId: string, closeId: string, reason: string): Promise<{
    close: MonthEndCloseAggregate;
    audit: FinancialPeriodTransitionAuditEntry;
  }> {
    const normalizedReason = normalizeReason(reason);
    if (!normalizedReason) {
      throw new FinancialPeriodDomainError({
        code: FinancialPeriodDomainErrorCode.REOPEN_REASON_REQUIRED,
        message: "A reason is required to reopen a closed financial period.",
      });
    }

    const latestClosed = await this.repository.getLatestClosed(userId);
    if (!latestClosed || latestClosed.id !== closeId) {
      throw new FinancialPeriodDomainError({
        code: FinancialPeriodDomainErrorCode.REOPEN_NOT_LATEST_CLOSED,
        message: "Only the latest closed month can be reopened.",
      });
    }

    return this.repository.reopenLatestClosedMonth({
      id: closeId,
      userId,
      reason: normalizedReason,
    });
  }
}
