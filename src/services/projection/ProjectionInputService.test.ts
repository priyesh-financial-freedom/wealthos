import { describe, expect, it, vi } from "vitest";

import type { ProjectionScenario } from "@/types/projection";

const supabaseMock = vi.hoisted(() => {
  const state = {
    userId: "user-1",
    closeRows: [] as Array<{ id: string; close_month: number; close_year: number; version_number: number; user_id: string; status: string }>,
    closeItemsByCloseId: {} as Record<string, Array<{ item_key: string; actual_value: number | string | null }>>,
  };

  const authGetUser = vi.fn(async () => ({
    data: { user: { id: state.userId } },
    error: null,
  }));

  const buildQuery = (table: string) => {
    const filters: Record<string, unknown> = {};

    function response() {
      if (table === "month_end_closes") {
        let rows = [...state.closeRows];
        if (filters.user_id !== undefined) {
          rows = rows.filter((row) => row.user_id === filters.user_id);
        }
        if (filters.status !== undefined) {
          rows = rows.filter((row) => row.status === filters.status);
        }
        if (filters.id !== undefined) {
          rows = rows.filter((row) => row.id === filters.id);
        }
        rows.sort((left, right) => right.close_year - left.close_year || right.close_month - left.close_month || right.version_number - left.version_number);
        return { data: rows.slice(0, 1), error: null };
      }

      if (table === "month_end_close_items") {
        const closeId = String(filters.close_id ?? "");
        return {
          data: [...(state.closeItemsByCloseId[closeId] ?? [])],
          error: null,
        };
      }

      return { data: [], error: null };
    }

    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => {
        filters[key] = value;
        return query;
      }),
      order: vi.fn(() => query),
      limit: vi.fn(async () => response()),
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) =>
        Promise.resolve(response()).then(resolve, reject),
    };

    return query;
  };

  return {
    state,
    client: {
      auth: {
        getUser: authGetUser,
      },
      from: vi.fn((table: string) => buildQuery(table)),
    },
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: supabaseMock.client,
}));

vi.mock("@/services/assumptions", () => ({
  DEFAULT_SCENARIO_KEY: "default",
  assumptionsService: {
    getAssumptionsBundle: vi.fn(async () => ({
      planning: {
        startMonth: "2026-07",
        endYear: 2035,
        endMonth: 12,
      },
      tax: {
        regime: "new",
        effectiveTaxRate: 12,
        surchargeRate: 0,
        cessRate: 0,
        note: "Derived from Planning Assumptions 2.0 defaults.",
      },
    })),
    getEffectiveAssumptions: vi.fn(async () => ({
      currentAge: 35,
      incomeTaxRate: 12,
    })),
  },
}));

vi.mock("@/services/assets", () => ({ getAssets: vi.fn(async () => []) }));
vi.mock("@/services/liabilities", () => ({ getLiabilities: vi.fn(async () => []) }));
vi.mock("@/services/bankAccounts", () => ({ getBankAccounts: vi.fn(async () => []) }));
vi.mock("@/services/investments", () => ({ getInvestments: vi.fn(async () => []) }));
vi.mock("@/services/realEstateProperties", () => ({ getRealEstateProperties: vi.fn(async () => []) }));
vi.mock("@/services/retirement", () => ({ getRetirementAccounts: vi.fn(async () => []) }));
vi.mock("@/services/fixedDeposits", () => ({ getFixedDeposits: vi.fn(async () => []) }));
vi.mock("@/services/goldHoldings", () => ({ getGoldHoldings: vi.fn(async () => []) }));
vi.mock("@/services/silverHoldings", () => ({ getSilverHoldings: vi.fn(async () => []) }));
vi.mock("@/services/accounts", () => ({ getAccounts: vi.fn(async () => []) }));

vi.mock("@/services/planning/goals/GoalService", () => ({
  goalService: {
    listGoals: vi.fn(async () => []),
  },
}));

vi.mock("@/services/projection/events", () => ({
  projectionEventsService: {
    listEvents: vi.fn(async () => []),
  },
}));

vi.mock("@/services/planning/assumptions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/planning/assumptions")>();

  return {
    ...actual,
    planningAssumptionService: {
      ...actual.planningAssumptionService,
      getFamilyProfile: vi.fn(async () => ({
        primaryDateOfBirth: "1990-01-01",
        spouseDateOfBirth: null,
        primaryCurrentAge: 35,
        spouseCurrentAge: null,
        updatedAt: null,
      })),
    },
  };
});

import { ProjectionInputService } from "./ProjectionInputService";
import { getAssets } from "@/services/assets";
import { getBankAccounts } from "@/services/bankAccounts";
import { getFixedDeposits } from "@/services/fixedDeposits";
import { getGoldHoldings } from "@/services/goldHoldings";
import { getInvestments } from "@/services/investments";
import { getLiabilities } from "@/services/liabilities";
import { getRealEstateProperties } from "@/services/realEstateProperties";
import { getRetirementAccounts } from "@/services/retirement";
import { getSilverHoldings } from "@/services/silverHoldings";

describe("ProjectionInputService", () => {
  it("uses live balance sheet as default start source and returns zero opening assets when data is empty", async () => {
    const service = new ProjectionInputService();
    const scenario: ProjectionScenario = {
      id: "default",
      name: "Default projection",
      description: "test",
      startMonth: "",
      planningHorizonYear: 2030,
      assumptions: [],
      events: [],
      isDefault: true,
    };

    const context = await service.buildContext({ scenario });

    expect(context.openingSource.kind).toBe("live-balance-sheet");
    expect(context.currentRecord.openingAssets).toBe(0);
    expect(context.currentRecord.openingCash).toBe(0);
    expect(context.currentRecord.openingInvestments).toBe(0);
    expect(context.currentRecord.openingLiabilities).toBe(0);
    expect(context.currentState.projectionEntities).toBeDefined();
    expect(context.currentState.projectionEntities).toHaveLength(0);
    expect(context.taxes).toEqual({
      regime: "new",
      effectiveTaxRate: 12,
      surchargeRate: 0,
      cessRate: 0,
      note: "Derived from Planning Assumptions 2.0 defaults.",
    });
  });

  it("supports manual opening balances start source", async () => {
    const service = new ProjectionInputService();
    const scenario: ProjectionScenario = {
      id: "default",
      name: "Default projection",
      description: "test",
      startMonth: "2026-07",
      planningHorizonYear: 2030,
      assumptions: [],
      events: [],
      isDefault: true,
    };

    const context = await service.buildContext({
      scenario,
      startSource: {
        kind: "manual-opening-balances",
        balances: {
          cash: 100,
          investments: 200,
          assets: 300,
          liabilities: 50,
          retirementCorpus: 400,
        },
        startMonth: "2026-08",
      },
    });

    expect(context.openingSource.kind).toBe("manual-opening-balances");
    expect(context.projectionStartDate).toBe("2026-08");
    expect(context.currentRecord.openingAssets).toBe(300);
    expect(context.currentRecord.openingCash).toBe(100);
    expect(context.currentRecord.openingInvestments).toBe(200);
    expect(context.currentRecord.openingLiabilities).toBe(50);
    expect(context.currentState.projectionEntities).toBeDefined();
    expect(context.currentState.projectionEntities).toHaveLength(5);
    expect(context.currentState.projectionEntities?.map((entity) => entity.id)).toEqual(
      expect.arrayContaining([
        "entity:assets:aggregate",
        "entity:cash:aggregate",
        "entity:investments:aggregate",
        "entity:liabilities:aggregate",
        "entity:retirement:aggregate",
      ]),
    );
    expect(context.currentState.projectionEntities?.find((entity) => entity.id === "entity:investments:aggregate")?.openingBalance).toBe(200);
    expect(context.currentState.projectionEntities?.find((entity) => entity.id === "entity:investments:aggregate")?.closingBalance).toBe(200);
    expect(context.currentState.projectionEntities?.find((entity) => entity.id === "entity:liabilities:aggregate")?.openingBalance).toBe(50);
    expect(context.currentState.projectionEntities?.find((entity) => entity.id === "entity:liabilities:aggregate")?.closingBalance).toBe(50);
    expect(context.currentState.projectionEntities?.reduce((sum, entity) => sum + entity.openingBalance, 0)).toBe(1050);
  });

  it("maps live liabilities into first-class planning entities", async () => {
    vi.mocked(getLiabilities).mockResolvedValueOnce([
      {
        id: "home-1",
        user_id: "user-1",
        liability_type: "Home Loan",
        lender: "Bank A",
        account_name: "Home Loan",
        outstanding_amount: 1000,
        original_amount: 2000,
        interest_rate: 8,
        emi: 0,
        start_date: null,
        end_date: null,
        due_day: null,
        due_date: null,
        tenure_months: null,
        credit_limit: null,
        sanction_limit: null,
        status: "active",
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "card-1",
        user_id: "user-1",
        liability_type: "Credit Card",
        lender: "Bank B",
        account_name: "Card",
        outstanding_amount: 250,
        original_amount: 0,
        interest_rate: 0,
        emi: 0,
        start_date: null,
        end_date: null,
        due_day: null,
        due_date: null,
        tenure_months: null,
        credit_limit: 0,
        sanction_limit: 0,
        status: "active",
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "other-1",
        user_id: "user-1",
        liability_type: "Other Liability",
        lender: "Bank C",
        account_name: "Other Liability",
        outstanding_amount: 75,
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
        status: "active",
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const service = new ProjectionInputService();
    const scenario: ProjectionScenario = {
      id: "default",
      name: "Default projection",
      description: "test",
      startMonth: "2026-07",
      planningHorizonYear: 2030,
      assumptions: [],
      events: [],
      isDefault: true,
    };

    const context = await service.buildContext({ scenario });

    expect(context.currentState.projectionEntities?.map((entity) => entity.id)).toEqual(
      expect.arrayContaining([
        "entity:home-loan:aggregate",
        "entity:credit-cards:aggregate",
        "entity:other-liabilities:aggregate",
      ]),
    );
    expect(context.currentState.projectionEntities?.find((entity) => entity.id === "entity:home-loan:aggregate")?.entityType).toBe("HomeLoan");
    expect(context.currentState.projectionEntities?.find((entity) => entity.id === "entity:credit-cards:aggregate")?.entityType).toBe("CreditCard");
    expect(context.currentState.projectionEntities?.find((entity) => entity.id === "entity:other-liabilities:aggregate")?.entityType).toBe("OtherLiability");
  });

  it("aggregates live holdings into planning buckets", async () => {
    vi.mocked(getAssets).mockResolvedValueOnce([
      {
        id: "asset-cash-1",
        user_id: "user-1",
        asset_type: "cash",
        asset_name: "Home cash",
        institution: null,
        current_value: 400,
        purchase_value: null,
        purchase_date: null,
        owner: null,
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(getBankAccounts).mockResolvedValueOnce([
      {
        id: "bank-1",
        user_id: "user-1",
        account_type: "Savings",
        bank: "Test Bank",
        account_name: "Primary",
        nickname: null,
        account_number: "1234",
        masked_account_number: "xx1234",
        ifsc: null,
        currency: "INR",
        current_balance: 600,
        opening_balance: 0,
        interest_rate: 4,
        owner: null,
        nominee: null,
        joint_holder: null,
        notes: null,
        documents_placeholder: null,
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(getInvestments).mockResolvedValueOnce([
      {
        id: "inv-mf-1",
        user_id: "user-1",
        investment_name: "MF 1",
        category: "Mutual Funds",
        units: 0,
        nav_price: 0,
        cost_basis: 0,
        today_gain_loss: 0,
        sector: null,
        amc: null,
        region: "Domestic",
        purchase_date: null,
        owner: null,
        folio_number: null,
        amfi_scheme_code: null,
        sip_amount: null,
        sip_date: null,
        investment_mode: null,
        option_type: null,
        broker_platform: null,
        nominee: null,
        notes: null,
        broker: null,
        exchange: null,
        isin: null,
        average_purchase_price: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        current_value: 1000,
        gain_loss: 0,
        cagr: null,
        xirr: null,
        exposure: "equity",
      },
      {
        id: "inv-stock-1",
        user_id: "user-1",
        investment_name: "Stock 1",
        category: "Stocks",
        units: 0,
        nav_price: 0,
        cost_basis: 0,
        today_gain_loss: 0,
        sector: null,
        amc: null,
        region: "Domestic",
        purchase_date: null,
        owner: null,
        folio_number: null,
        amfi_scheme_code: null,
        sip_amount: null,
        sip_date: null,
        investment_mode: null,
        option_type: null,
        broker_platform: null,
        nominee: null,
        notes: null,
        broker: null,
        exchange: null,
        isin: null,
        average_purchase_price: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        current_value: 500,
        gain_loss: 0,
        cagr: null,
        xirr: null,
        exposure: "equity",
      },
    ]);
    vi.mocked(getFixedDeposits).mockResolvedValueOnce([
      {
        id: "fd-1",
        user_id: "user-1",
        deposit_type: "FD",
        institution: "Test FD",
        branch: null,
        account_number: "fd-123",
        holder: "Primary",
        principal: 1500,
        interest_rate: 7,
        compounding_frequency: "yearly",
        current_value: 1500,
        opening_date: null,
        maturity_date: null,
        auto_renew: false,
        owner: null,
        nominee: null,
        notes: null,
        documents_placeholder: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(getGoldHoldings).mockResolvedValueOnce([
      {
        id: "gold-1",
        user_id: "user-1",
        holding_type: "Physical Gold",
        description: "Gold 1",
        quantity: 0,
        unit: "g",
        purity: null,
        purchase_date: null,
        cost_basis: 700,
        current_value: 700,
        custodian: null,
        institution: null,
        owner: null,
        nominee: null,
        notes: null,
        documents_placeholder: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(getSilverHoldings).mockResolvedValueOnce([
      {
        id: "silver-1",
        user_id: "user-1",
        holding_type: "Physical Silver",
        description: "Silver 1",
        quantity: 0,
        unit: "g",
        purity: null,
        purchase_date: null,
        cost_basis: 300,
        current_value: 300,
        custodian: null,
        institution: null,
        owner: null,
        nominee: null,
        notes: null,
        documents_placeholder: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(getRetirementAccounts).mockResolvedValueOnce([
      {
        id: "ret-ppf-1",
        user_id: "user-1",
        account_type: "PPF",
        owner: "Primary",
        institution: "PPF Bank",
        current_balance: 2000,
        account_number: null,
        opening_date: null,
        interest_rate: 7.1,
        nominee: null,
        notes: null,
        contribution_frequency: "Monthly",
        contribution_amount: 0,
        contribution_day: null,
        contribution_month: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        maturity_date: null,
      },
    ]);
    vi.mocked(getRealEstateProperties).mockResolvedValueOnce([
      {
        id: "re-1",
        user_id: "user-1",
        property_name: "Apartment",
        property_type: "Apartment",
        owner: "Primary",
        purchase_date: null,
        purchase_price: 0,
        current_market_value: 5000,
        address: null,
        city: "City",
        state: "State",
        pin_code: null,
        occupancy_status: "self_occupied",
        monthly_rent: null,
        linked_home_loan_id: null,
        notes: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);

    const service = new ProjectionInputService();
    const scenario: ProjectionScenario = {
      id: "default",
      name: "Default projection",
      description: "test",
      startMonth: "2026-07",
      planningHorizonYear: 2030,
      assumptions: [],
      events: [],
      isDefault: true,
    };

    const context = await service.buildContext({ scenario });

    expect(context.currentRecord.openingCash).toBe(1000);
    expect(context.currentRecord.openingInvestments).toBe(4000);
    expect(context.currentRecord.openingAssets).toBe(5000);
    expect(context.currentRecord.openingLiabilities).toBe(0);

    expect(context.currentState.projectionEntities).toBeDefined();
    expect(context.currentState.projectionEntities?.length).toBe(8);
    expect(context.currentState.projectionEntities?.map((entity) => entity.id)).toEqual(
      expect.arrayContaining([
        "entity:cash:aggregate",
        "entity:fixed-deposits:aggregate",
        "entity:gold:aggregate",
        "entity:mutual-funds:aggregate",
        "entity:ppf:aggregate",
        "entity:real-estate:aggregate",
        "entity:silver:aggregate",
        "entity:stocks:aggregate",
      ]),
    );

    const totalEntityOpening = context.currentState.projectionEntities?.reduce((sum, entity) => sum + entity.openingBalance, 0) ?? 0;
    expect(totalEntityOpening).toBe(12000);
  });

  it("sums repeated month-end close item keys when seeding latest-closed-month-end start source", async () => {
    supabaseMock.state.closeRows = [
      {
        id: "close-2026-07-v1",
        close_month: 7,
        close_year: 2026,
        version_number: 1,
        user_id: "user-1",
        status: "closed",
      },
    ];
    supabaseMock.state.closeItemsByCloseId = {
      "close-2026-07-v1": [
        { item_key: "bank_accounts", actual_value: 100000 },
        { item_key: "bank_accounts", actual_value: 55555 },
        { item_key: "mutual_funds", actual_value: 400000 },
        { item_key: "mutual_funds", actual_value: 97285 },
        { item_key: "stocks", actual_value: 300000 },
        { item_key: "stocks", actual_value: 35600 },
        { item_key: "ppf", actual_value: 900000 },
        { item_key: "ppf", actual_value: 161689 },
        { item_key: "home_loans", actual_value: 9000000 },
        { item_key: "car_loans", actual_value: 250000 },
        { item_key: "other_liabilities", actual_value: 127700 },
      ],
    };

    const service = new ProjectionInputService();
    const scenario: ProjectionScenario = {
      id: "default",
      name: "Default projection",
      description: "test",
      startMonth: "2026-07",
      planningHorizonYear: 2030,
      assumptions: [],
      events: [],
      isDefault: true,
    };

    const context = await service.buildContext({
      scenario,
      startSource: { kind: "latest-closed-month-end" },
    });

    expect(context.openingSource.kind).toBe("month-end-close");
    expect(context.openingSource.asOfMonth).toBe("2026-07");
    expect(context.projectionStartDate).toBe("2026-08");

    const entityBalances = new Map((context.currentState.projectionEntities ?? []).map((entity) => [entity.id, entity.openingBalance]));
    expect(entityBalances.get("entity:cash:aggregate")).toBe(155555);
    expect(entityBalances.get("entity:mutual-funds:aggregate")).toBe(497285);
    expect(entityBalances.get("entity:stocks:aggregate")).toBe(335600);
    expect(entityBalances.get("entity:ppf:aggregate")).toBe(1061689);
    expect(entityBalances.get("entity:home-loans:aggregate")).toBe(9000000);
    expect(entityBalances.get("entity:car-loans:aggregate")).toBe(250000);
    expect(entityBalances.get("entity:other-liabilities:aggregate")).toBe(127700);

    expect(context.currentRecord.openingCash).toBe(155555);
    expect(context.currentRecord.openingInvestments).toBe(832885);
    expect(context.currentRecord.openingLiabilities).toBe(9377700);
  });
});
