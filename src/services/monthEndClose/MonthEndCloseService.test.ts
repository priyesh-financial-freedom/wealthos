import { describe, expect, it, vi } from "vitest";

import type { BalanceSheetData } from "@/services/balanceSheet";
import type { MonthEndClose, MonthEndCloseItem } from "@/types/monthEndClose";

import { MonthEndCloseService } from "./MonthEndCloseService";

vi.mock("@/services/projection/ProjectionInputService", () => ({
  projectionInputService: {
    buildContext: vi.fn(async () => ({})),
  },
}));

vi.mock("@/services/projection/ProjectionEngine", () => ({
  projectionEngine: {
    run: vi.fn(async () => ({ snapshots: [{ month: "2026-07", projectedEntities: [] }] })),
  },
}));

function buildClose(partial?: Partial<MonthEndClose>): MonthEndClose {
  return {
    id: partial?.id ?? "close-draft-1",
    user_id: partial?.user_id ?? "user-1",
    close_month: partial?.close_month ?? 7,
    close_year: partial?.close_year ?? 2026,
    version_number: partial?.version_number ?? 1,
    status: partial?.status ?? "draft",
    supersedes_close_id: partial?.supersedes_close_id ?? null,
    closed_at: partial?.closed_at ?? null,
    created_at: partial?.created_at ?? "2026-07-01T00:00:00.000Z",
    updated_at: partial?.updated_at ?? "2026-07-01T00:00:00.000Z",
  };
}

function buildCloseItem(partial?: Partial<MonthEndCloseItem>): MonthEndCloseItem {
  return {
    id: partial?.id ?? "item-1",
    close_id: partial?.close_id ?? "close-draft-1",
    user_id: partial?.user_id ?? "user-1",
    entity_id: partial?.entity_id ?? "entity-1",
    entity_type: partial?.entity_type ?? "bank-account",
    entity_name: partial?.entity_name ?? "Entity",
    item_key: partial?.item_key ?? "bank_accounts",
    item_label: partial?.item_label ?? "Entity",
    item_type: partial?.item_type ?? "asset",
    sort_order: partial?.sort_order ?? 1000,
    opening_value: partial?.opening_value ?? 0,
    projected_value: partial?.projected_value ?? 0,
    actual_value: partial?.actual_value ?? 0,
    absolute_variance: partial?.absolute_variance ?? 0,
    percentage_variance: partial?.percentage_variance ?? 0,
    created_at: partial?.created_at ?? "2026-07-01T00:00:00.000Z",
    updated_at: partial?.updated_at ?? "2026-07-01T00:00:00.000Z",
  };
}

describe("MonthEndCloseService getWorkspace", () => {
  it("reconciles draft items on load using live balance sheet entities", async () => {
    const draft = buildClose({ id: "draft-1", status: "draft" });
    const staleDeletedItem = buildCloseItem({
      id: "stale-1",
      close_id: draft.id,
      entity_id: "deleted-account",
      entity_name: "Deleted Account",
      actual_value: 55000,
    });
    const survivingItem = buildCloseItem({
      id: "survive-1",
      close_id: draft.id,
      entity_id: "active-account",
      entity_name: "Savings",
      actual_value: 98765,
    });

    const getCloseItems = vi.fn(async (closeId: string) => {
      if (closeId === draft.id) {
        return [staleDeletedItem, survivingItem];
      }

      return [];
    });

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems,
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const balanceSheetData: BalanceSheetData = {
      assets: [],
      liabilities: [],
      investments: [],
      retirementAccounts: [],
      fixedDeposits: [],
      goldHoldings: [],
      silverHoldings: [],
      realEstateProperties: [],
      bankAccounts: [
        {
          id: "active-account",
          user_id: "user-1",
          account_name: "Savings",
          account_type: "Savings",
          bank: "HDFC",
          account_number: "1234",
          current_balance: 111111,
          currency: "INR",
          branch_name: null,
          ifsc_code: null,
          swift_code: null,
          account_holder_name: null,
          opening_balance: null,
          available_balance: null,
          interest_rate: 0,
          minimum_balance: null,
          overdraft_limit: null,
          linked_investment_account: null,
          status: "active",
          notes: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
          last_synced_at: null,
        },
        {
          id: "new-account",
          user_id: "user-1",
          account_name: "Salary",
          account_type: "Savings",
          bank: "ICICI",
          account_number: "5678",
          current_balance: 222222,
          currency: "INR",
          branch_name: null,
          ifsc_code: null,
          swift_code: null,
          account_holder_name: null,
          opening_balance: null,
          available_balance: null,
          interest_rate: 0,
          minimum_balance: null,
          overdraft_limit: null,
          linked_investment_account: null,
          status: "active",
          notes: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
          last_synced_at: null,
        },
      ],
      summary: {
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        monthlyChange: 0,
        assetBreakdown: {
          cashAndBank: 0,
          investments: 0,
          fixedDeposits: 0,
          gold: 0,
          silver: 0,
          realEstate: 0,
          otherAssets: 0,
          retirement: 0,
        },
        liabilityBreakdown: {
          homeLoans: 0,
          carLoans: 0,
          personalLoans: 0,
          creditCards: 0,
          otherLiabilities: 0,
        },
      },
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => balanceSheetData,
    });

    const workspace = await service.getWorkspace();

    expect(workspace.items.map((item) => item.entityId).sort()).toEqual(["active-account", "new-account"]);
    expect(workspace.items.find((item) => item.entityId === "active-account")?.actualValue).toBe(98765);
    expect(workspace.items.find((item) => item.entityId === "new-account")?.actualValue).toBe(222222);

    expect(repository.deleteCloseItemsByIds).toHaveBeenCalledWith(["stale-1"]);
    expect(repository.upsertCloseItems).toHaveBeenCalledTimes(1);

    const upsertPayload = repository.upsertCloseItems.mock.calls[0][0] as Array<{ close_id: string; entity_id: string }>;
    expect(upsertPayload.every((row) => row.close_id === draft.id)).toBe(true);
    expect(upsertPayload.map((row) => row.entity_id).sort()).toEqual(["active-account", "new-account"]);
  });
});