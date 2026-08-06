import { describe, expect, it, vi } from "vitest";

import type { BalanceSheetData } from "@/services/balanceSheet";
import type { Investment, InvestmentCategory } from "@/types/investment";
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

function buildInvestment(partial: {
  id: string;
  category: InvestmentCategory;
  name: string;
  currentValue: number;
  exposure?: "equity" | "debt";
}): Investment {
  return {
    id: partial.id,
    user_id: "user-1",
    owner: null,
    institution: null,
    investment_name: partial.name,
    investment_type: partial.category,
    category: partial.category,
    acquisition_date: null,
    cost_value: 0,
    status: "active",
    notes: null,
    documents_placeholder: null,
    monthly_change: 0,
    current_month_value: null,
    previous_month_value: null,
    cost_basis: 0,
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
    current_value: partial.currentValue,
    gain_loss: 0,
    cagr: null,
    xirr: null,
    exposure: partial.exposure ?? "debt",
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
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
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

  it("removes draft investment rows when the investment no longer exists in live holdings", async () => {
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
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
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
    const removed = workspace.items.find((item) => item.entityType === "investment" && item.entityId === "22222222-2222-2222-2222-222222222222");

    expect(removed).toBeUndefined();
    expect(repository.deleteCloseItemsByIds).toHaveBeenCalledWith(["deleted-investment-item"]);
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
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
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

  it("reconciles draft items on load and removes deleted draft rows", async () => {
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
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
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

    expect(workspace.items.map((item) => item.entityId).sort()).toEqual(["active-account", "new-account"]);
    expect(workspace.items.find((item) => item.entityId === "active-account")?.actualValue).toBe(98765);
    expect(workspace.items.find((item) => item.entityId === "new-account")?.actualValue).toBe(222222);
    expect(workspace.items.find((item) => item.entityId === "deleted-account")).toBeUndefined();

    expect(repository.deleteCloseItemsByIds).toHaveBeenCalledWith(["stale-1"]);
    expect(repository.upsertCloseItems).toHaveBeenCalledTimes(1);

    const upsertPayload = repository.upsertCloseItems.mock.calls[0][0] as Array<{ close_id: string; entity_id: string }>;
    expect(upsertPayload.every((row) => row.close_id === draft.id)).toBe(true);
    expect(upsertPayload.map((row) => row.entity_id).sort()).toEqual(["active-account", "new-account"]);
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
      getNearestPriorClosedMonthEndClose: vi.fn(async () => latestClosed),
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
      getNearestPriorClosedMonthEndClose: vi.fn(async () => latestClosed),
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

  it("includes retirement and precious metal keys in workspace items", async () => {
    const draft = buildClose({ id: "draft-aug", status: "draft", close_month: 8, close_year: 2026 });
    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const balanceSheetData: BalanceSheetData = {
      ...buildEmptyBalanceSheetData(),
      retirementAccounts: [
        {
          id: "epf-1",
          user_id: "user-1",
          account_type: "EPF",
          owner: "Self",
          institution: "EPFO",
          current_balance: 100000,
          account_number: null,
          opening_date: null,
          interest_rate: null,
          nominee: null,
          notes: null,
          contribution_frequency: "Monthly",
          contribution_amount: 5000,
          contribution_day: null,
          contribution_month: null,
          employer: null,
          uan: null,
          employee_contribution: null,
          employer_contribution: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "ppf-1",
          user_id: "user-1",
          account_type: "PPF",
          owner: "Self",
          institution: "SBI",
          current_balance: 200000,
          account_number: null,
          opening_date: null,
          interest_rate: null,
          nominee: null,
          notes: null,
          contribution_frequency: "Monthly",
          contribution_amount: 3000,
          contribution_day: null,
          contribution_month: null,
          maturity_date: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
        {
          id: "nps-1",
          user_id: "user-1",
          account_type: "NPS",
          owner: "Self",
          institution: "NPS Trust",
          current_balance: 300000,
          account_number: null,
          opening_date: null,
          interest_rate: null,
          nominee: null,
          notes: null,
          contribution_frequency: "Monthly",
          contribution_amount: 4000,
          contribution_day: null,
          contribution_month: null,
          pran: null,
          pop: null,
          equity_percent: null,
          corporate_debt_percent: null,
          government_securities_percent: null,
          alternative_assets_percent: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ],
      goldHoldings: [
        {
          id: "gold-1",
          user_id: "user-1",
          holding_type: "Physical Gold",
          description: "Gold Coins",
          quantity: 10,
          unit: "grams",
          purity: null,
          purchase_date: null,
          cost_basis: 400000,
          current_value: 450000,
          custodian: null,
          institution: null,
          owner: null,
          nominee: null,
          notes: null,
          documents_placeholder: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ],
      silverHoldings: [
        {
          id: "silver-1",
          user_id: "user-1",
          holding_type: "Physical Silver",
          description: "Silver Bars",
          quantity: 15,
          unit: "grams",
          purity: null,
          purchase_date: null,
          cost_basis: 50000,
          current_value: 65000,
          custodian: null,
          institution: null,
          owner: null,
          nominee: null,
          notes: null,
          documents_placeholder: null,
          created_at: "2026-08-01T00:00:00.000Z",
          updated_at: "2026-08-01T00:00:00.000Z",
        },
      ],
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => balanceSheetData,
    });

    const workspace = await service.getWorkspace();
    const keySet = new Set(workspace.items.map((item) => item.key));

    expect(keySet.has("epf")).toBe(true);
    expect(keySet.has("ppf")).toBe(true);
    expect(keySet.has("nps")).toBe(true);
    expect(keySet.has("gold")).toBe(true);
    expect(keySet.has("silver")).toBe(true);
  });

  it("uses nearest prior closed month for MoM baseline, not latest closed globally", async () => {
    const pendingDraft = buildClose({ id: "draft-aug", status: "draft", close_year: 2026, close_month: 8 });
    const latestClosedGlobal = buildClose({ id: "closed-sep", status: "closed", close_year: 2026, close_month: 9 });
    const nearestPriorClosed = buildClose({ id: "closed-jul", status: "closed", close_year: 2026, close_month: 7 });

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => pendingDraft),
      getLatestClosedMonthEndClose: vi.fn(async () => latestClosedGlobal),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => nearestPriorClosed),
      getDraftForMonth: vi.fn(async () => pendingDraft),
      getCloseItems: vi.fn(async (closeId: string) => {
        if (closeId === nearestPriorClosed.id) {
          return [
            buildCloseItem({
              close_id: nearestPriorClosed.id,
              entity_id: "bank-1",
              entity_type: "bank-account",
              entity_name: "Cash",
              item_key: "bank_accounts",
              actual_value: 100,
            }),
          ];
        }

        return [];
      }),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        bankAccounts: [
          {
            id: "bank-1",
            user_id: "user-1",
            account_name: "Cash",
            account_type: "Savings",
            bank: "HDFC",
            nickname: null,
            account_number: "1234",
            masked_account_number: "***1234",
            current_balance: 130,
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
      }),
    });

    const workspace = await service.getWorkspace();

    expect(workspace.dashboard.currentClosedMonth?.monthKey).toBe("2026-07");
    expect(workspace.dashboard.monthOverMonthChange).toBe(30);
  });

  it("returns null MoM when no prior closed month baseline exists", async () => {
    const pendingDraft = buildClose({ id: "draft-aug", status: "draft", close_year: 2026, close_month: 8 });
    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => pendingDraft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => pendingDraft),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => buildEmptyBalanceSheetData(),
    });

    const workspace = await service.getWorkspace();
    expect(workspace.dashboard.currentClosedMonth).toBeNull();
    expect(workspace.dashboard.monthOverMonthChange).toBeNull();
    expect(workspace.dashboard.monthOverMonthChange).not.toBe(workspace.dashboard.netWorth);
  });

  it("ignores EPF/PPF/NPS investments when dedicated retirement accounts exist", async () => {
    const draft = buildClose({ id: "draft-dedupe", status: "draft", close_month: 8, close_year: 2026 });
    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        investments: [
          buildInvestment({ id: "inv-epf", category: "EPF", name: "EPF Inv", currentValue: 100 }),
          buildInvestment({ id: "inv-ppf", category: "PPF", name: "PPF Inv", currentValue: 200 }),
          buildInvestment({ id: "inv-nps", category: "NPS", name: "NPS Inv", currentValue: 300 }),
        ],
        retirementAccounts: [
          { id: "epf-1", user_id: "user-1", account_type: "EPF", owner: "Self", institution: "EPFO", current_balance: 100, account_number: null, opening_date: null, interest_rate: null, nominee: null, notes: null, contribution_frequency: "Monthly", contribution_amount: 0, contribution_day: null, contribution_month: null, employer: null, uan: null, employee_contribution: null, employer_contribution: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
          { id: "ppf-1", user_id: "user-1", account_type: "PPF", owner: "Self", institution: "SBI", current_balance: 200, account_number: null, opening_date: null, interest_rate: null, nominee: null, notes: null, contribution_frequency: "Monthly", contribution_amount: 0, contribution_day: null, contribution_month: null, maturity_date: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
          { id: "nps-1", user_id: "user-1", account_type: "NPS", owner: "Self", institution: "NPS", current_balance: 300, account_number: null, opening_date: null, interest_rate: null, nominee: null, notes: null, contribution_frequency: "Monthly", contribution_amount: 0, contribution_day: null, contribution_month: null, pran: null, pop: null, equity_percent: null, corporate_debt_percent: null, government_securities_percent: null, alternative_assets_percent: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
        ],
      }),
    });

    const workspace = await service.getWorkspace();
    expect(workspace.items.filter((item) => item.entityType === "investment" && (item.key === "epf" || item.key === "ppf" || item.key === "nps")).length).toBe(0);
    expect(workspace.dashboard.totalAssets).toBe(600);
  });

  it("prevents real estate duplication when dedicated real_estate_properties exist", async () => {
    const draft = buildClose({ id: "draft-re", status: "draft", close_month: 8, close_year: 2026 });
    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        assets: [
          { id: "asset-re", user_id: "user-1", asset_type: "real_estate", asset_name: "Legacy RE", institution: null, current_value: 1000, purchase_value: null, purchase_date: null, owner: null, notes: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
        ],
        realEstateProperties: [
          { id: "prop-1", user_id: "user-1", property_name: "Apartment", property_type: "Apartment", owner: "Self", purchase_date: null, purchase_price: 0, current_market_value: 1200, address: null, city: "Mumbai", state: "MH", pin_code: null, occupancy_status: "self_occupied", monthly_rent: null, linked_home_loan_id: null, notes: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
        ],
      }),
    });

    const workspace = await service.getWorkspace();
    expect(workspace.items.filter((item) => item.entityType === "asset" && item.key === "real_estate").length).toBe(0);
    expect(workspace.items.filter((item) => item.entityType === "real-estate-property" && item.key === "real_estate").length).toBe(1);
    expect(workspace.dashboard.netWorth).toBe(1200);
  });

  it("ignores sovereign gold bond investments when dedicated gold holdings exist", async () => {
    const draft = buildClose({ id: "draft-gold-dedupe", status: "draft", close_month: 8, close_year: 2026 });
    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        investments: [
          buildInvestment({ id: "inv-sgb", category: "Sovereign Gold Bonds", name: "SGB 2032", currentValue: 250 }),
        ],
        goldHoldings: [
          {
            id: "gold-1",
            user_id: "user-1",
            holding_type: "Physical Gold",
            description: "Coins",
            quantity: 1,
            unit: "grams",
            purity: null,
            purchase_date: null,
            cost_basis: 0,
            current_value: 300,
            custodian: null,
            institution: null,
            owner: null,
            nominee: null,
            notes: null,
            documents_placeholder: null,
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    });

    const workspace = await service.getWorkspace();

    expect(workspace.items.filter((item) => item.entityType === "investment" && item.key === "gold").length).toBe(0);
    expect(workspace.items.filter((item) => item.entityType === "gold-holding" && item.key === "gold").length).toBe(1);
    expect(workspace.dashboard.totalAssets).toBe(300);
  });

  it("ignores silver investments when dedicated silver holdings exist", async () => {
    const draft = buildClose({ id: "draft-silver-dedupe", status: "draft", close_month: 8, close_year: 2026 });
    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        investments: [
          buildInvestment({ id: "inv-silver", category: "Silver", name: "Silver ETF", currentValue: 250 }),
        ],
        silverHoldings: [
          {
            id: "silver-1",
            user_id: "user-1",
            holding_type: "Physical Silver",
            description: "Bars",
            quantity: 1,
            unit: "grams",
            purity: null,
            purchase_date: null,
            cost_basis: 0,
            current_value: 300,
            custodian: null,
            institution: null,
            owner: null,
            nominee: null,
            notes: null,
            documents_placeholder: null,
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    });

    const workspace = await service.getWorkspace();

    expect(workspace.items.filter((item) => item.entityType === "investment" && item.key === "silver").length).toBe(0);
    expect(workspace.items.filter((item) => item.entityType === "silver-holding" && item.key === "silver").length).toBe(1);
    expect(workspace.dashboard.totalAssets).toBe(300);
  });

  it("maps bonds into fixed_deposits bucket", async () => {
    const draft = buildClose({ id: "draft-bonds", status: "draft", close_month: 8, close_year: 2026 });
    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getEarliestOpenMonthEndClose: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getDraftForMonth: vi.fn(async () => draft),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        investments: [
          buildInvestment({ id: "inv-bond", category: "Bonds", name: "Gov Bond", currentValue: 450 }),
        ],
      }),
    });

    const workspace = await service.getWorkspace();
    expect(workspace.items.find((item) => item.entityType === "investment" && item.entityId === "inv-bond")?.key).toBe("fixed_deposits");
    expect(workspace.dashboard.totalAssets).toBe(450);
  });
});

describe("MonthEndCloseService closeMonth", () => {
  it("upserts draft items before marking the close as closed", async () => {
    const draft = buildClose({
      id: "draft-aug",
      status: "draft",
      close_month: 8,
      close_year: 2026,
    });

    const executionOrder: string[] = [];

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getCloseById: vi.fn(async () => draft),
      getDraftForMonth: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getLatestVersionForMonth: vi.fn(async () => draft),
      createMonthEndClose: vi.fn(async () => draft),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => {
        executionOrder.push("upsert");
      }),
      updateMonthEndCloseStatus: vi.fn(async () => {
        executionOrder.push("close");
        return buildClose({
          ...draft,
          status: "closed",
          closed_at: "2026-08-31T00:00:00.000Z",
        });
      }),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        bankAccounts: [
          {
            id: "bank-1",
            user_id: "user-1",
            account_name: "Primary",
            account_type: "Savings",
            bank: "HDFC",
            nickname: null,
            account_number: "1234",
            masked_account_number: "***1234",
            current_balance: 1250,
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
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    });

    vi.spyOn(service, "getWorkspace").mockResolvedValue({
      close: draft,
      latestClose: null,
      month: { month: 8, year: 2026, monthKey: "2026-08", label: "August 2026" },
      status: "closed",
      items: [],
      dashboard: {
        currentClosedMonth: null,
        pendingMonth: { month: 8, year: 2026, monthKey: "2026-08", label: "August 2026" },
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        monthOverMonthChange: null,
        projectionVariance: 0,
        largestPositiveVariance: null,
        largestNegativeVariance: null,
      },
    });

    await service.closeMonth({
      closeId: draft.id,
      closeMonth: 8,
      closeYear: 2026,
      items: [
        {
          entityId: "bank-1",
          entityType: "bank-account",
          entityName: "Primary • HDFC",
          key: "bank_accounts",
          label: "Primary • HDFC",
          itemType: "asset",
          sortOrder: 1000,
          openingValue: 1200,
          projectedValue: 1300,
          actualValue: 1250,
        },
      ],
    });

    expect(repository.upsertCloseItems).toHaveBeenCalledTimes(1);
    expect(repository.updateMonthEndCloseStatus).toHaveBeenCalledTimes(1);
    expect(executionOrder).toEqual(["upsert", "close"]);
  });

  it("blocks close when closeId points to an already closed record", async () => {
    const closed = buildClose({
      id: "closed-aug",
      status: "closed",
      close_month: 8,
      close_year: 2026,
      closed_at: "2026-08-31T00:00:00.000Z",
    });

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getCloseById: vi.fn(async () => closed),
      getDraftForMonth: vi.fn(async () => null),
      getLatestClosedMonthEndClose: vi.fn(async () => closed),
      getLatestVersionForMonth: vi.fn(async () => closed),
      createMonthEndClose: vi.fn(async () => closed),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
      updateMonthEndCloseStatus: vi.fn(async () => closed),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => buildEmptyBalanceSheetData(),
    });

    await expect(
      service.closeMonth({
        closeId: closed.id,
        closeMonth: 8,
        closeYear: 2026,
        items: [],
      }),
    ).rejects.toThrow("This month is already closed. Reopen it before making corrections or closing again.");

    expect(repository.upsertCloseItems).not.toHaveBeenCalled();
    expect(repository.updateMonthEndCloseStatus).not.toHaveBeenCalled();
  });

  it("does not surface immutable item error when closing a valid draft", async () => {
    const draft = buildClose({ id: "draft-sep", status: "draft", close_month: 9, close_year: 2026 });
    let isClosed = false;

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getCloseById: vi.fn(async () => draft),
      getDraftForMonth: vi.fn(async () => draft),
      getLatestClosedMonthEndClose: vi.fn(async () => null),
      getLatestVersionForMonth: vi.fn(async () => draft),
      createMonthEndClose: vi.fn(async () => draft),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => {
        if (isClosed) {
          throw new Error("Closed month-end items are immutable. Create a new version instead.");
        }
      }),
      updateMonthEndCloseStatus: vi.fn(async () => {
        isClosed = true;
        return buildClose({ ...draft, status: "closed", closed_at: "2026-09-30T00:00:00.000Z" });
      }),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        bankAccounts: [
          {
            id: "bank-9",
            user_id: "user-1",
            account_name: "Primary",
            account_type: "Savings",
            bank: "HDFC",
            nickname: null,
            account_number: "9999",
            masked_account_number: "***9999",
            current_balance: 900,
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
            created_at: "2026-09-01T00:00:00.000Z",
            updated_at: "2026-09-01T00:00:00.000Z",
          },
        ],
      }),
    });

    vi.spyOn(service, "getWorkspace").mockResolvedValue({
      close: draft,
      latestClose: null,
      month: { month: 9, year: 2026, monthKey: "2026-09", label: "September 2026" },
      status: "closed",
      items: [],
      dashboard: {
        currentClosedMonth: null,
        pendingMonth: { month: 9, year: 2026, monthKey: "2026-09", label: "September 2026" },
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        monthOverMonthChange: null,
        projectionVariance: 0,
        largestPositiveVariance: null,
        largestNegativeVariance: null,
      },
    });

    await expect(
      service.closeMonth({
        closeId: draft.id,
        closeMonth: 9,
        closeYear: 2026,
        items: [
          {
            entityId: "bank-9",
            entityType: "bank-account",
            entityName: "Primary • HDFC",
            key: "bank_accounts",
            label: "Primary • HDFC",
            itemType: "asset",
            sortOrder: 1000,
            openingValue: 900,
            projectedValue: 900,
            actualValue: 900,
          },
        ],
      }),
    ).resolves.toBeDefined();
  });
});

describe("MonthEndCloseService rebuildDraftCloseItemsFromCanonicalSources", () => {
  function toPersistedItemsFromUpsertRows(
    closeId: string,
    rows: Array<{
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
    }>,
  ): MonthEndCloseItem[] {
    return rows.map((row, index) =>
      buildCloseItem({
        id: `rebuilt-${index + 1}`,
        close_id: closeId,
        entity_id: row.entity_id,
        entity_type: row.entity_type,
        entity_name: row.entity_name,
        item_key: row.item_key,
        item_label: row.item_label,
        item_type: row.item_type,
        sort_order: row.sort_order,
        opening_value: row.opening_value,
        projected_value: row.projected_value,
        actual_value: row.actual_value,
        absolute_variance: row.absolute_variance,
        percentage_variance: row.percentage_variance,
      }),
    );
  }

  it("rebuilding draft removes duplicate bank account rows", async () => {
    const draft = buildClose({ id: "draft-aug-dup-banks", close_year: 2026, close_month: 8, status: "draft" });
    let persistedItems: MonthEndCloseItem[] = [
      buildCloseItem({ id: "old-bank", close_id: draft.id, entity_id: "old-bank-id", entity_type: "bank-account", entity_name: "Primary • Bank", item_key: "bank_accounts", actual_value: 500000 }),
      buildCloseItem({ id: "new-bank", close_id: draft.id, entity_id: "new-bank-id", entity_type: "bank-account", entity_name: "Primary • Bank", item_key: "bank_accounts", actual_value: 500000 }),
    ];

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getCloseById: vi.fn(async () => draft),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getCloseItems: vi.fn(async () => persistedItems),
      deleteCloseItemsByIds: vi.fn(async () => {
        persistedItems = [];
      }),
      upsertCloseItems: vi.fn(async (rows: Array<any>) => {
        persistedItems = toPersistedItemsFromUpsertRows(draft.id, rows);
      }),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        bankAccounts: [
          {
            id: "new-bank-id",
            user_id: "user-1",
            account_name: "Primary",
            account_type: "Savings",
            bank: "Bank",
            nickname: null,
            account_number: "1234",
            masked_account_number: "***1234",
            current_balance: 500000,
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
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    });

    await service.rebuildDraftCloseItemsFromCanonicalSources(draft.id);

    const bankRows = persistedItems.filter((item) => item.item_key === "bank_accounts");
    expect(bankRows.length).toBe(1);
    expect(bankRows[0]?.entity_id).toBe("new-bank-id");
  });

  it("rebuilding draft removes duplicate EPF/PPF/NPS rows and uses dedicated retirement accounts", async () => {
    const draft = buildClose({ id: "draft-aug-ret", close_year: 2026, close_month: 8, status: "draft" });
    let persistedItems: MonthEndCloseItem[] = [
      buildCloseItem({ id: "epf-old", close_id: draft.id, entity_id: "epf-old", entity_type: "investment", entity_name: "EPF Legacy", item_key: "epf", actual_value: 18800000 }),
      buildCloseItem({ id: "epf-new", close_id: draft.id, entity_id: "epf-new", entity_type: "retirement-account", entity_name: "EPF New", item_key: "epf", actual_value: 18800000 }),
      buildCloseItem({ id: "ppf-old", close_id: draft.id, entity_id: "ppf-old", entity_type: "investment", entity_name: "PPF Legacy", item_key: "ppf", actual_value: 2023000 }),
      buildCloseItem({ id: "nps-old", close_id: draft.id, entity_id: "nps-old", entity_type: "investment", entity_name: "NPS Legacy", item_key: "nps", actual_value: 525000 }),
    ];

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getCloseById: vi.fn(async () => draft),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getCloseItems: vi.fn(async () => persistedItems),
      deleteCloseItemsByIds: vi.fn(async () => {
        persistedItems = [];
      }),
      upsertCloseItems: vi.fn(async (rows: Array<any>) => {
        persistedItems = toPersistedItemsFromUpsertRows(draft.id, rows);
      }),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        investments: [
          buildInvestment({ id: "inv-epf", category: "EPF", name: "EPF Investment", currentValue: 1 }),
          buildInvestment({ id: "inv-ppf", category: "PPF", name: "PPF Investment", currentValue: 1 }),
          buildInvestment({ id: "inv-nps", category: "NPS", name: "NPS Investment", currentValue: 1 }),
        ],
        retirementAccounts: [
          { id: "epf-live", user_id: "user-1", account_type: "EPF", owner: "Self", institution: "EPFO", current_balance: 18800000, account_number: null, opening_date: null, interest_rate: null, nominee: null, notes: null, contribution_frequency: "Monthly", contribution_amount: 0, contribution_day: null, contribution_month: null, employer: null, uan: null, employee_contribution: null, employer_contribution: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
          { id: "ppf-live", user_id: "user-1", account_type: "PPF", owner: "Self", institution: "SBI", current_balance: 2023000, account_number: null, opening_date: null, interest_rate: null, nominee: null, notes: null, contribution_frequency: "Monthly", contribution_amount: 0, contribution_day: null, contribution_month: null, maturity_date: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
          { id: "nps-live", user_id: "user-1", account_type: "NPS", owner: "Self", institution: "NPS", current_balance: 525000, account_number: null, opening_date: null, interest_rate: null, nominee: null, notes: null, contribution_frequency: "Monthly", contribution_amount: 0, contribution_day: null, contribution_month: null, pran: null, pop: null, equity_percent: null, corporate_debt_percent: null, government_securities_percent: null, alternative_assets_percent: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
        ],
      }),
    });

    await service.rebuildDraftCloseItemsFromCanonicalSources(draft.id);

    const epfRows = persistedItems.filter((item) => item.item_key === "epf");
    const ppfRows = persistedItems.filter((item) => item.item_key === "ppf");
    const npsRows = persistedItems.filter((item) => item.item_key === "nps");

    expect(epfRows.length).toBe(1);
    expect(ppfRows.length).toBe(1);
    expect(npsRows.length).toBe(1);
    expect(epfRows[0]?.entity_type).toBe("retirement-account");
    expect(ppfRows[0]?.entity_type).toBe("retirement-account");
    expect(npsRows[0]?.entity_type).toBe("retirement-account");
  });

  it("rebuilding draft applies real estate canonical precedence", async () => {
    const draft = buildClose({ id: "draft-aug-re", close_year: 2026, close_month: 8, status: "draft" });
    let persistedItems: MonthEndCloseItem[] = [
      buildCloseItem({ id: "legacy-re", close_id: draft.id, entity_id: "asset-re", entity_type: "asset", entity_name: "Legacy RE", item_key: "real_estate", actual_value: 31000000 }),
      buildCloseItem({ id: "new-re", close_id: draft.id, entity_id: "prop-re", entity_type: "real-estate-property", entity_name: "Current RE", item_key: "real_estate", actual_value: 31000000 }),
    ];

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getCloseById: vi.fn(async () => draft),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getCloseItems: vi.fn(async () => persistedItems),
      deleteCloseItemsByIds: vi.fn(async () => {
        persistedItems = [];
      }),
      upsertCloseItems: vi.fn(async (rows: Array<any>) => {
        persistedItems = toPersistedItemsFromUpsertRows(draft.id, rows);
      }),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        assets: [
          { id: "asset-re", user_id: "user-1", asset_type: "real_estate", asset_name: "Legacy RE", institution: null, current_value: 31000000, purchase_value: null, purchase_date: null, owner: null, notes: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
        ],
        realEstateProperties: [
          { id: "prop-re", user_id: "user-1", property_name: "Current RE", property_type: "Apartment", owner: "Self", purchase_date: null, purchase_price: 0, current_market_value: 31000000, address: null, city: "Mumbai", state: "MH", pin_code: null, occupancy_status: "self_occupied", monthly_rent: null, linked_home_loan_id: null, notes: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" },
        ],
      }),
    });

    await service.rebuildDraftCloseItemsFromCanonicalSources(draft.id);

    const realEstateRows = persistedItems.filter((item) => item.item_key === "real_estate");
    expect(realEstateRows.length).toBe(1);
    expect(realEstateRows[0]?.entity_type).toBe("real-estate-property");
  });

  it("rebuilding draft applies liability canonical precedence", async () => {
    const draft = buildClose({ id: "draft-aug-liability", close_year: 2026, close_month: 8, status: "draft" });
    let persistedItems: MonthEndCloseItem[] = [
      buildCloseItem({ id: "home-old", close_id: draft.id, entity_id: "loan-dup-1", entity_type: "liability", entity_name: "Home Loan Dup 1", item_key: "home_loans", actual_value: 9175000 }),
      buildCloseItem({ id: "home-old-2", close_id: draft.id, entity_id: "loan-dup-2", entity_type: "liability", entity_name: "Home Loan Dup 2", item_key: "home_loans", actual_value: 9175000 }),
    ];

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getCloseById: vi.fn(async () => draft),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getCloseItems: vi.fn(async () => persistedItems),
      deleteCloseItemsByIds: vi.fn(async () => {
        persistedItems = [];
      }),
      upsertCloseItems: vi.fn(async (rows: Array<any>) => {
        persistedItems = toPersistedItemsFromUpsertRows(draft.id, rows);
      }),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        liabilities: [
          {
            id: "loan-live-home",
            user_id: "user-1",
            liability_type: "Home Loan",
            lender: "Bank",
            account_name: "Home Loan",
            outstanding_amount: 9175000,
            original_amount: null,
            interest_rate: null,
            emi: null,
            start_date: null,
            end_date: null,
            due_day: null,
            due_date: null,
            tenure_months: null,
            credit_limit: null,
            sanction_limit: null,
            owner: null,
            primary_borrower: null,
            co_borrower: null,
            prepayment_allowed: null,
            prepayment_done_till_date: null,
            future_prepayment_plan: null,
            estimated_interest_saved: null,
            revised_closure_date: null,
            review_date: null,
            status: "active",
            notes: null,
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    });

    await service.rebuildDraftCloseItemsFromCanonicalSources(draft.id);

    const homeLoanRows = persistedItems.filter((item) => item.item_key === "home_loans");
    expect(homeLoanRows.length).toBe(1);
    expect(homeLoanRows[0]?.entity_id).toBe("loan-live-home");
  });

  it("refuses rebuild for closed close", async () => {
    const closed = buildClose({ id: "closed-aug", close_year: 2026, close_month: 8, status: "closed", closed_at: "2026-08-31T00:00:00.000Z" });
    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getCloseById: vi.fn(async () => closed),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getCloseItems: vi.fn(async () => []),
      deleteCloseItemsByIds: vi.fn(async () => undefined),
      upsertCloseItems: vi.fn(async () => undefined),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => buildEmptyBalanceSheetData(),
    });

    await expect(service.rebuildDraftCloseItemsFromCanonicalSources(closed.id)).rejects.toThrow(
      "Only draft month-end closes can be rebuilt from canonical sources.",
    );
    expect(repository.deleteCloseItemsByIds).not.toHaveBeenCalled();
    expect(repository.upsertCloseItems).not.toHaveBeenCalled();
  });

  it("returns net worth consistent with canonical assets minus liabilities after rebuild", async () => {
    const draft = buildClose({ id: "draft-aug-networth", close_year: 2026, close_month: 8, status: "draft" });
    let persistedItems: MonthEndCloseItem[] = [
      buildCloseItem({ id: "dup-1", close_id: draft.id, entity_id: "dup", entity_type: "bank-account", item_key: "bank_accounts", actual_value: 1000 }),
      buildCloseItem({ id: "dup-2", close_id: draft.id, entity_id: "dup", entity_type: "bank-account", item_key: "bank_accounts", actual_value: 1000 }),
    ];

    const repository = {
      getAuthenticatedUserId: vi.fn(async () => "user-1"),
      getCloseById: vi.fn(async () => draft),
      getNearestPriorClosedMonthEndClose: vi.fn(async () => null),
      getCloseItems: vi.fn(async () => persistedItems),
      deleteCloseItemsByIds: vi.fn(async () => {
        persistedItems = [];
      }),
      upsertCloseItems: vi.fn(async (rows: Array<any>) => {
        persistedItems = toPersistedItemsFromUpsertRows(draft.id, rows);
      }),
    };

    const service = new MonthEndCloseService({
      repository: repository as never,
      balanceSheetLoader: async () => ({
        ...buildEmptyBalanceSheetData(),
        bankAccounts: [
          {
            id: "bank-live",
            user_id: "user-1",
            account_name: "Primary",
            account_type: "Savings",
            bank: "Bank",
            nickname: null,
            account_number: "1234",
            masked_account_number: "***1234",
            current_balance: 500000,
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
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
        ],
        liabilities: [
          {
            id: "loan-live",
            user_id: "user-1",
            liability_type: "Home Loan",
            lender: "Bank",
            account_name: "Home Loan",
            outstanding_amount: 9175000,
            original_amount: null,
            interest_rate: null,
            emi: null,
            start_date: null,
            end_date: null,
            due_day: null,
            due_date: null,
            tenure_months: null,
            credit_limit: null,
            sanction_limit: null,
            owner: null,
            primary_borrower: null,
            co_borrower: null,
            prepayment_allowed: null,
            prepayment_done_till_date: null,
            future_prepayment_plan: null,
            estimated_interest_saved: null,
            revised_closure_date: null,
            review_date: null,
            status: "active",
            notes: null,
            created_at: "2026-08-01T00:00:00.000Z",
            updated_at: "2026-08-01T00:00:00.000Z",
          },
        ],
      }),
    });

    const result = await service.rebuildDraftCloseItemsFromCanonicalSources(draft.id);
    expect(result.afterTotals.netWorth).toBe(result.afterTotals.totalAssets - result.afterTotals.totalLiabilities);
  });
});