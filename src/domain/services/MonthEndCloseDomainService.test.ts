import { describe, expect, it } from "vitest";

import {
  FinancialPeriodDomainError,
  FinancialPeriodDomainErrorCode,
  FinancialPeriodStatus,
  MonthEndCloseBalanceDomainError,
  MonthEndCloseBalanceDomainErrorCode,
} from "@/types/monthEndCloseDomain";
import type { MonthEndCloseAggregate, MonthEndCloseLineItem, MonthEndCloseLineItemInput } from "@/types/monthEndCloseDomain";

import { MonthEndCloseDomainService } from "./MonthEndCloseDomainService";
import type { MonthEndCloseDomainRepository } from "./MonthEndCloseDomainRepository";

function cloneClose(close: MonthEndCloseAggregate): MonthEndCloseAggregate {
  return { ...close };
}

function cloneItem(item: MonthEndCloseLineItem): MonthEndCloseLineItem {
  return { ...item };
}

class InMemoryMonthEndCloseRepository implements MonthEndCloseDomainRepository {
  private closes: MonthEndCloseAggregate[] = [];
  private itemsByCloseId = new Map<string, MonthEndCloseLineItem[]>();
  private transitionAudit: Array<{
    id: string;
    closeId: string;
    userId: string;
    fromStatus: FinancialPeriodStatus;
    toStatus: FinancialPeriodStatus;
    reason: string | null;
    transitionedAt: string;
    createdAt: string;
  }> = [];
  private closeCounter = 0;
  private itemCounter = 0;
  private auditCounter = 0;

  async getAuthenticatedUserId(): Promise<string> {
    return "user-1";
  }

  async getCloseById(userId: string, closeId: string): Promise<MonthEndCloseAggregate | null> {
    const row = this.closes.find((item) => item.id === closeId && item.userId === userId) ?? null;
    return row ? cloneClose(row) : null;
  }

  async getDraftForMonth(userId: string, closeYear: number, closeMonth: number): Promise<MonthEndCloseAggregate | null> {
    const row =
      this.closes
        .filter((item) => item.userId === userId && item.closeYear === closeYear && item.closeMonth === closeMonth && item.status === "draft")
        .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;
    return row ? cloneClose(row) : null;
  }

  async getLatestVersionForMonth(userId: string, closeYear: number, closeMonth: number): Promise<MonthEndCloseAggregate | null> {
    const row =
      this.closes
        .filter((item) => item.userId === userId && item.closeYear === closeYear && item.closeMonth === closeMonth)
        .sort((left, right) => right.versionNumber - left.versionNumber)[0] ?? null;
    return row ? cloneClose(row) : null;
  }

  async createClose(input: {
    userId: string;
    closeMonth: number;
    closeYear: number;
    versionNumber: number;
    status: "draft" | "closed";
    supersedesCloseId: string | null;
    closedAt: string | null;
  }): Promise<MonthEndCloseAggregate> {
    this.closeCounter += 1;
    const now = new Date().toISOString();
    const row: MonthEndCloseAggregate = {
      id: `close-${this.closeCounter}`,
      userId: input.userId,
      closeMonth: input.closeMonth,
      closeYear: input.closeYear,
      versionNumber: input.versionNumber,
      status: input.status,
      supersedesCloseId: input.supersedesCloseId,
      closedAt: input.closedAt,
      createdAt: now,
      updatedAt: now,
    };
    this.closes.push(row);
    return cloneClose(row);
  }

  async updateCloseStatus(input: {
    id: string;
    userId: string;
    status: "draft" | "closed";
    closedAt: string | null;
  }): Promise<MonthEndCloseAggregate> {
    const index = this.closes.findIndex((item) => item.id === input.id && item.userId === input.userId);
    if (index < 0) {
      throw new Error("Month-end close record not found.");
    }

    const updated: MonthEndCloseAggregate = {
      ...this.closes[index],
      status: input.status,
      closedAt: input.closedAt,
      updatedAt: new Date().toISOString(),
    };
    this.closes[index] = updated;
    return cloneClose(updated);
  }

  async replaceItems(closeId: string, userId: string, items: MonthEndCloseLineItemInput[]): Promise<void> {
    const rows: MonthEndCloseLineItem[] = items.map((item) => {
      this.itemCounter += 1;
      const actualBalance =
        item.actualBalance === null || item.actualBalance === undefined
          ? null
          : Number(item.actualBalance);
      const actual = Number((actualBalance ?? item.actualValue) ?? 0);
      const projected = Number(item.projectedValue ?? 0);
      const absoluteVariance = actual - projected;

      return {
        id: `item-${this.itemCounter}`,
        closeId,
        userId,
        entityId: item.entityId,
        entityType: item.entityType,
        entityName: item.entityName,
        itemKey: item.itemKey,
        itemLabel: item.itemLabel,
        itemType: item.itemType,
        sortOrder: item.sortOrder,
        openingValue: Number(item.openingValue ?? 0),
        projectedValue: projected,
        actualValue: actual,
        actualBalance,
        isRequired: item.isRequired !== false,
        absoluteVariance,
        percentageVariance: projected === 0 ? null : (absoluteVariance / projected) * 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    this.itemsByCloseId.set(closeId, rows);
  }

  async listItems(closeId: string): Promise<MonthEndCloseLineItem[]> {
    return (this.itemsByCloseId.get(closeId) ?? []).map(cloneItem);
  }

  async appendTransitionAudit(input: {
    closeId: string;
    userId: string;
    fromStatus: FinancialPeriodStatus;
    toStatus: FinancialPeriodStatus;
    reason: string | null;
    transitionedAt: string;
  }): Promise<void> {
    this.auditCounter += 1;
    this.transitionAudit.push({
      id: `audit-${this.auditCounter}`,
      closeId: input.closeId,
      userId: input.userId,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      reason: input.reason,
      transitionedAt: input.transitionedAt,
      createdAt: input.transitionedAt,
    });
  }

  async listTransitionAudit(closeId: string) {
    return this.transitionAudit.filter((item) => item.closeId === closeId).map((item) => ({ ...item }));
  }
}

describe("MonthEndCloseDomainService", () => {
  it("creates a draft and persists canonical item values", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    const result = await service.saveDraft({
      userId: "user-1",
      closeMonth: 7,
      closeYear: 2026,
      items: [
        {
          entityId: "entity-1",
          entityType: "bank-account",
          entityName: "Emergency Savings",
          itemKey: "bank_accounts",
          itemLabel: "Emergency Savings",
          itemType: "asset",
          sortOrder: 10,
          openingValue: 1000,
          projectedValue: 1200,
          actualValue: 1300,
          actualBalance: 1300,
          isRequired: true,
        },
      ],
    });

    expect(result.close.status).toBe("draft");
    expect(result.close.versionNumber).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].actualBalance).toBe(1300);
    expect(result.items[0].isRequired).toBe(true);
    expect(result.items[0].absoluteVariance).toBe(100);
    expect(result.items[0].percentageVariance).toBeCloseTo(8.3333, 4);
  });

  it("allows optional line items without an actual balance", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    const result = await service.saveDraft({
      userId: "user-1",
      closeMonth: 7,
      closeYear: 2026,
      items: [
        {
          entityId: "entity-optional-1",
          entityType: "investment",
          entityName: "Optional Holding",
          itemKey: "other_assets",
          itemLabel: "Optional Holding",
          itemType: "asset",
          sortOrder: 15,
          isRequired: false,
          actualBalance: null,
        },
      ],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].isRequired).toBe(false);
    expect(result.items[0].actualBalance).toBeNull();
  });

  it("closes a draft and stamps closedAt", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    const closed = await service.closeMonth({
      userId: "user-1",
      closeMonth: 8,
      closeYear: 2026,
      items: [
        {
          entityId: "entity-2",
          entityType: "liability",
          entityName: "Mortgage",
          itemKey: "home_loans",
          itemLabel: "Mortgage",
          itemType: "liability",
          sortOrder: 120,
          openingValue: 50000,
          projectedValue: 48000,
          actualValue: 47500,
        },
      ],
    });

    expect(closed.close.status).toBe("closed");
    expect(typeof closed.close.closedAt).toBe("string");
    const audit = await service.listTransitionAudit("user-1", closed.close.id);
    expect(audit).toHaveLength(1);
    expect(audit[0].fromStatus).toBe(FinancialPeriodStatus.OPEN);
    expect(audit[0].toStatus).toBe(FinancialPeriodStatus.CLOSED);
    expect(audit[0].reason).toBeNull();
  });

  it("reopens a closed period when a reason is provided and records immutable audit", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    const closed = await service.closeMonth({
      userId: "user-1",
      closeMonth: 9,
      closeYear: 2026,
      items: [
        {
          entityId: "entity-3",
          entityType: "bank-account",
          entityName: "Cash",
          itemKey: "bank_accounts",
          itemLabel: "Cash",
          itemType: "asset",
          sortOrder: 1,
          openingValue: 100,
          projectedValue: 100,
          actualValue: 100,
        },
      ],
    });

    const reopened = await service.transitionPeriodStatus({
      userId: "user-1",
      closeId: closed.close.id,
      toStatus: FinancialPeriodStatus.OPEN,
      reason: "Actual bank statement was revised after close.",
    });

    expect(reopened.close.status).toBe("draft");
    expect(reopened.close.closedAt).toBeNull();
    expect(reopened.audit.fromStatus).toBe(FinancialPeriodStatus.CLOSED);
    expect(reopened.audit.toStatus).toBe(FinancialPeriodStatus.OPEN);
    expect(reopened.audit.reason).toBe("Actual bank statement was revised after close.");

    const auditTrail = await service.listTransitionAudit("user-1", closed.close.id);
    expect(auditTrail).toHaveLength(2);
    expect(auditTrail[0].toStatus).toBe(FinancialPeriodStatus.CLOSED);
    expect(auditTrail[1].toStatus).toBe(FinancialPeriodStatus.OPEN);
  });

  it("rejects invalid OPEN -> OPEN transition", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    const draft = await service.saveDraft({
      userId: "user-1",
      closeMonth: 10,
      closeYear: 2026,
      items: [],
    });

    await expect(
      service.transitionPeriodStatus({
        userId: "user-1",
        closeId: draft.close.id,
        toStatus: FinancialPeriodStatus.OPEN,
      }),
    ).rejects.toMatchObject<Partial<FinancialPeriodDomainError>>({
      code: FinancialPeriodDomainErrorCode.INVALID_TRANSITION,
    });
  });

  it("rejects invalid CLOSED -> CLOSED transition", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    const closed = await service.closeMonth({
      userId: "user-1",
      closeMonth: 11,
      closeYear: 2026,
      items: [],
    });

    await expect(
      service.transitionPeriodStatus({
        userId: "user-1",
        closeId: closed.close.id,
        toStatus: FinancialPeriodStatus.CLOSED,
      }),
    ).rejects.toMatchObject<Partial<FinancialPeriodDomainError>>({
      code: FinancialPeriodDomainErrorCode.INVALID_TRANSITION,
    });
  });

  it("requires a reason when reopening a closed period", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    const closed = await service.closeMonth({
      userId: "user-1",
      closeMonth: 12,
      closeYear: 2026,
      items: [],
    });

    await expect(
      service.transitionPeriodStatus({
        userId: "user-1",
        closeId: closed.close.id,
        toStatus: FinancialPeriodStatus.OPEN,
        reason: "   ",
      }),
    ).rejects.toMatchObject<Partial<FinancialPeriodDomainError>>({
      code: FinancialPeriodDomainErrorCode.REOPEN_REASON_REQUIRED,
    });
  });

  it("rejects transition for missing period with clear domain error", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    await expect(
      service.transitionPeriodStatus({
        userId: "user-1",
        closeId: "missing-close",
        toStatus: FinancialPeriodStatus.CLOSED,
      }),
    ).rejects.toMatchObject<Partial<FinancialPeriodDomainError>>({
      code: FinancialPeriodDomainErrorCode.PERIOD_NOT_FOUND,
    });
  });

  it("rejects required line items with missing actual balance", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    await expect(
      service.saveDraft({
        userId: "user-1",
        closeMonth: 1,
        closeYear: 2027,
        items: [
          {
            entityId: "entity-required-1",
            entityType: "bank-account",
            entityName: "Salary Account",
            itemKey: "bank_accounts",
            itemLabel: "Salary Account",
            itemType: "asset",
            sortOrder: 10,
            isRequired: true,
            actualBalance: null,
          },
        ],
      }),
    ).rejects.toMatchObject<Partial<MonthEndCloseBalanceDomainError>>({
      code: MonthEndCloseBalanceDomainErrorCode.REQUIRED_ACTUAL_BALANCE_MISSING,
    });
  });

  it("rejects negative actual balances", async () => {
    const repository = new InMemoryMonthEndCloseRepository();
    const service = new MonthEndCloseDomainService(repository);

    await expect(
      service.saveDraft({
        userId: "user-1",
        closeMonth: 2,
        closeYear: 2027,
        items: [
          {
            entityId: "entity-required-2",
            entityType: "liability",
            entityName: "Mortgage",
            itemKey: "home_loans",
            itemLabel: "Mortgage",
            itemType: "liability",
            sortOrder: 120,
            isRequired: true,
            actualBalance: -1,
          },
        ],
      }),
    ).rejects.toMatchObject<Partial<MonthEndCloseBalanceDomainError>>({
      code: MonthEndCloseBalanceDomainErrorCode.NEGATIVE_ACTUAL_BALANCE,
    });
  });
});
