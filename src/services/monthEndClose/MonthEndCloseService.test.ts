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

function buildEmptyBalanceSheetData(): BalanceSheetData {
  return {
    assets: [],
    liabilities: [],
    investments: [],
    retirementAccounts: [],
    fixedDeposits: [],
    goldHoldings: [],
    silverHoldings: [],
    realEstateProperties: [],
    bankAccounts: [],
    summary: {
      totalAssets: 0,
      totalInvestments: 0,
      totalLiabilities: 0,
      totalBalanceSheetAssets: 0,
      netWorth: 0,
      debtRatio: 0,
      monthlyEmi: 0,
      cashHoldings: 0,
      cashRatio: 0,
      liquidityRatio: null,
      investmentRatio: 0,
      retirementRatio: 0,
      realEstateRatio: 0,
      categoryTotals: {
        cashAndBank: 0,
        investments: 0,
        retirement: 0,
        fixedDeposits: 0,
        goldAndSilver: 0,
        realEstate: 0,
        vehicles: 0,
        otherAssets: 0,
        homeLoan: 0,
        carLoan: 0,
        creditCards: 0,
        personalLoan: 0,
        otherLiabilities: 0,
      },
      assetSections: [],
      liabilitySections: [],
      assetAllocation: [],
      liabilityAllocation: [],
      largestAsset: null,
      largestLiability: null,
    },
  };
}

describe("MonthEndCloseService getWorkspace", () => {
  it("preserves existing draft actual_value for unmapped investment category", async () => {
    const draft = buildClose({
      id: "draft-aug",
      status: "draft",
      close_month: 8,
      close_year: 2026,
    });

    const investmentId = "11111111-1111-1111-1111-111111111111";
    const draftInvestmentItem = buildCloseItem({
      id: "draft-item-esop",
      close_id: draft.id,
      entity_id: investmentId,
      entity_type: "investment",
      entity_name: "Acme ESOP Grant",
      item_key: "stocks",
      item_label: "Acme ESOP Grant",
      actual_value: 400000,
    });

    const getCloseItems = vi.fn(async (closeId: string) => {
      if (closeId === draft.id) {
        return [draftInvestmentItem];
      }

      return [];
    });

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems,
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const balanceSheetData: BalanceSheetData = {
      ...buildEmptyBalanceSheetData(),
      investments: [
        {
          id: investmentId,
          user_id: "user-1",
          owner: null,
          institution: null,
          investment_name: "Acme ESOP Grant",
          investment_type: "ESOPs",
          category: "ESOPs",
          acquisition_date: null,
          cost_value: 100000,
          status: "active",
          notes: null,
          documents_placeholder: null,
          monthly_change: 0,
          current_month_value: null,
          previous_month_value: null,
          cost_basis: 100000,
          purchase_date: null,
          units: 0,
          nav_price: 0,
          today_gain_loss: 0,
          sector: null,
          amc: null,
          region: "Domestic",
          folio_number: null,
          amfi_scheme_code: null,
          sip_amount: null,
          sip_date: null,
          investment_mode: null,
          option_type: null,
          broker_platform: null,
          nominee: null,
          broker: null,
          exchange: null,
          isin: null,
          average_purchase_price: null,
          demat_account_provider: null,
          demat_account_number: null,
          fd_number: null,
          interest_rate: null,
          compounding_frequency: null,
          payout_type: null,
          maturity_date: null,
          maturity_value: null,
          issuer: null,
          bond_name: null,
          bond_type: null,
          face_value: null,
          coupon_rate: null,
          coupon_frequency: null,
          purchase_price: null,
          current_market_price: null,
          gold_type: null,
          gold_unit: null,
          storage_location: null,
          esop_vested_shares: null,
          esop_current_share_price: null,
          esop_grant_status: null,
          startup_funding_round: null,
          startup_ownership_percent: null,
          alternative_category: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
          current_value: 450000,
          gain_loss: 350000,
          cagr: null,
          xirr: null,
          exposure: "equity",
        },
      ],
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => balanceSheetData,
    });

    const workspace = await service.getWorkspace();

    // Draft row remains in the workspace even if seed generation omits this category.
    const preserved = workspace.items.find((item) => item.entityType === "investment" && item.entityId === investmentId);
    expect(preserved).toBeDefined();
    expect(preserved?.actualValue).toBe(400000);

    expect(getCloseItems).toHaveBeenCalledWith(draft.id);
    expect(repository.deleteCloseItemsByIds).not.toHaveBeenCalledWith(["draft-item-esop"]);
  });

  it("preserves draft investment rows even when the investment is deleted from live holdings", async () => {
    const draft = buildClose({
      id: "draft-deleted-investment",
      status: "draft",
      close_month: 8,
      close_year: 2026,
    });

    const deletedInvestmentItem = buildCloseItem({
      id: "deleted-investment-item",
      close_id: draft.id,
      entity_id: "22222222-2222-2222-2222-222222222222",
      entity_type: "investment",
      entity_name: "Legacy Holding",
      item_key: "stocks",
      item_label: "Legacy Holding",
      opening_value: 175000,
      actual_value: 180000,
    });

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems: vi.fn(async (closeId: string) => (closeId === draft.id ? [deletedInvestmentItem] : [])),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        investments: [],
      }),
    });

    const workspace = await service.getWorkspace();
    const preserved = workspace.items.find((item) => item.entityType === "investment" && item.entityId === "22222222-2222-2222-2222-222222222222");

    expect(preserved).toBeDefined();
    expect(preserved?.actualValue).toBe(180000);
    expect(repository.deleteCloseItemsByIds).not.toHaveBeenCalledWith(["deleted-investment-item"]);
  });

  it("keeps draft actual_value when an investment is renamed but retains the same id", async () => {
    const draft = buildClose({
      id: "draft-renamed-investment",
      status: "draft",
      close_month: 8,
      close_year: 2026,
    });

    const investmentId = "33333333-3333-3333-3333-333333333333";
    const draftItem = buildCloseItem({
      id: "renamed-investment-item",
      close_id: draft.id,
      entity_id: investmentId,
      entity_type: "investment",
      entity_name: "Old Fund Name",
      item_key: "mutual_funds",
      item_label: "Old Fund Name",
      actual_value: 510000,
    });

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems: vi.fn(async (closeId: string) => (closeId === draft.id ? [draftItem] : [])),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const balanceSheetData: BalanceSheetData = {
      ...buildEmptyBalanceSheetData(),
      investments: [
        {
          id: investmentId,
          user_id: "user-1",
          owner: null,
          institution: null,
          investment_name: "New Fund Name",
          investment_type: "Mutual Funds",
          category: "Mutual Funds",
          acquisition_date: null,
          cost_value: 250000,
          status: "active",
          notes: null,
          documents_placeholder: null,
          monthly_change: 0,
          current_month_value: null,
          previous_month_value: null,
          cost_basis: 250000,
          purchase_date: null,
          units: 0,
          nav_price: 0,
          today_gain_loss: 0,
          sector: null,
          amc: null,
          region: "Domestic",
          folio_number: null,
          amfi_scheme_code: null,
          sip_amount: null,
          sip_date: null,
          investment_mode: null,
          option_type: null,
          broker_platform: null,
          nominee: null,
          broker: null,
          exchange: null,
          isin: null,
          average_purchase_price: null,
          demat_account_provider: null,
          demat_account_number: null,
          fd_number: null,
          interest_rate: null,
          compounding_frequency: null,
          payout_type: null,
          maturity_date: null,
          maturity_value: null,
          issuer: null,
          bond_name: null,
          bond_type: null,
          face_value: null,
          coupon_rate: null,
          coupon_frequency: null,
          purchase_price: null,
          current_market_price: null,
          gold_type: null,
          gold_unit: null,
          storage_location: null,
          esop_vested_shares: null,
          esop_current_share_price: null,
          esop_grant_status: null,
          startup_funding_round: null,
          startup_ownership_percent: null,
          alternative_category: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
          current_value: 560000,
          gain_loss: 0,
          cagr: null,
          xirr: null,
          exposure: "equity",
        },
      ],
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => balanceSheetData,
    });

    const workspace = await service.getWorkspace();
    const row = workspace.items.find((item) => item.entityType === "investment" && item.entityId === investmentId);

    expect(row).toBeDefined();
    expect(row?.actualValue).toBe(510000);
    expect(repository.deleteCloseItemsByIds).not.toHaveBeenCalledWith(["renamed-investment-item"]);
  });

  it("reconciles draft items on load while preserving existing draft rows", async () => {
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
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
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
          nickname: null,
          account_number: "1234",
          masked_account_number: "***1234",
          current_balance: 111111,
          ifsc: null,
          currency: "INR",
          opening_balance: 0,
          interest_rate: 0,
          owner: null,
          include_in_net_worth: true,
          include_in_cash_position: true,
          nominee: null,
          joint_holder: null,
          status: "active",
          notes: null,
          documents_placeholder: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
        {
          id: "new-account",
          user_id: "user-1",
          account_name: "Salary",
          account_type: "Savings",
          bank: "ICICI",
          nickname: null,
          account_number: "5678",
          masked_account_number: "***5678",
          current_balance: 222222,
          ifsc: null,
          currency: "INR",
          opening_balance: 0,
          interest_rate: 0,
          owner: null,
          include_in_net_worth: true,
          include_in_cash_position: true,
          nominee: null,
          joint_holder: null,
          status: "active",
          notes: null,
          documents_placeholder: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
        },
      ],
      summary: buildEmptyBalanceSheetData().summary,
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => balanceSheetData,
    });

    const workspace = await service.getWorkspace();

    expect(workspace.items.map((item) => item.entityId).sort()).toEqual(["active-account", "deleted-account", "new-account"]);
    expect(workspace.items.find((item) => item.entityId === "active-account")?.actualValue).toBe(98765);
    expect(workspace.items.find((item) => item.entityId === "new-account")?.actualValue).toBe(222222);
    expect(workspace.items.find((item) => item.entityId === "deleted-account")?.actualValue).toBe(55000);

    expect(repository.deleteCloseItemsByIds).not.toHaveBeenCalled();
    expect(repository.upsertCloseItems).toHaveBeenCalledTimes(1);

    const upsertPayload = repository.upsertCloseItems.mock.calls[0][0] as Array<{ close_id: string; entity_id: string }>;
    expect(upsertPayload.every((row) => row.close_id === draft.id)).toBe(true);
    expect(upsertPayload.map((row) => row.entity_id).sort()).toEqual(["active-account", "deleted-account", "new-account"]);
  });

  it("uses earliest open period as pending close period", async () => {
    const earliestOpen = buildClose({
      id: "draft-july",
      status: "draft",
      close_month: 7,
      close_year: 2026,
    });
    const latestClosed = buildClose({
      id: "closed-july",
      status: "closed",
      close_month: 7,
      close_year: 2026,
      closed_at: "2026-07-31T23:59:59.000Z",
    });

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => earliestOpen),
      getLatestClosedMonthEndClose: vi.fn(async () => latestClosed),
      getDraftForMonth: vi.fn(async () => null),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => buildEmptyBalanceSheetData(),
    });

    const workspace = await service.getWorkspace();

    expect(workspace.month.month).toBe(7);
    expect(workspace.month.year).toBe(2026);
    expect(workspace.month.label).toBe("July 2026");
    expect(repository.getDraftForMonth).not.toHaveBeenCalled();
  });

  it("falls back to next logical month after latest closed when no open period exists", async () => {
    const latestClosed = buildClose({
      id: "closed-july",
      status: "closed",
      close_month: 7,
      close_year: 2026,
      closed_at: "2026-07-31T23:59:59.000Z",
    });

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => null),
      getLatestClosedMonthEndClose: vi.fn(async () => latestClosed),
      getDraftForMonth: vi.fn(async () => null),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => buildEmptyBalanceSheetData(),
    });

    const workspace = await service.getWorkspace();

    expect(workspace.month.month).toBe(8);
    expect(workspace.month.year).toBe(2026);
    expect(workspace.month.label).toBe("August 2026");
    expect(repository.getDraftForMonth).toHaveBeenCalledWith("user-1", 2026, 8);
  });
});