import { describe, expect, it, vi } from "vitest";

import type { ProjectionScenario } from "@/types/projection";

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
        effectiveTaxRate: 0,
        surchargeRate: 0,
        cessRate: 0,
        note: "",
      },
    })),
    getEffectiveAssumptions: vi.fn(async () => ({
      currentAge: 35,
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

vi.mock("@/services/planning/assumptions", () => ({
  planningAssumptionService: {
    getFamilyProfile: vi.fn(async () => ({
      primaryDateOfBirth: "1990-01-01",
      spouseDateOfBirth: null,
      primaryCurrentAge: 35,
      spouseCurrentAge: null,
      updatedAt: null,
    })),
  },
}));

import { ProjectionInputService } from "./ProjectionInputService";
import { getAssets } from "@/services/assets";
import { getBankAccounts } from "@/services/bankAccounts";
import { getFixedDeposits } from "@/services/fixedDeposits";
import { getGoldHoldings } from "@/services/goldHoldings";
import { getInvestments } from "@/services/investments";
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
    expect(context.currentState.projectionEntities).toHaveLength(1);
    expect(context.currentState.projectionEntities?.[0].id).toBe("entity:investments:aggregate");
    expect(context.currentState.projectionEntities?.[0].openingBalance).toBe(0);
    expect(context.currentState.projectionEntities?.reduce((sum, entity) => sum + entity.openingBalance, 0)).toBe(0);
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
    expect(context.currentState.projectionEntities).toHaveLength(4);
    expect(context.currentState.projectionEntities?.map((entity) => entity.id).sort()).toEqual([
      "entity:cash:aggregate",
      "entity:investments:aggregate",
      "entity:real-estate:aggregate",
      "entity:retirement:aggregate",
    ]);
    expect(context.currentState.projectionEntities?.find((entity) => entity.id === "entity:investments:aggregate")?.openingBalance).toBe(200);
    expect(context.currentState.projectionEntities?.find((entity) => entity.id === "entity:investments:aggregate")?.closingBalance).toBe(200);
    expect(context.currentState.projectionEntities?.reduce((sum, entity) => sum + entity.openingBalance, 0)).toBe(1000);
  });

  it("seeds one projection entity per live financial object while preserving aggregate opening balances", async () => {
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
    expect(context.currentState.projectionEntities?.length).toBe(9);
    expect(context.currentState.projectionEntities?.map((entity) => entity.id).sort()).toEqual([
      "entity:cash-asset:asset-cash-1",
      "entity:cash:bank-1",
      "entity:fixed-deposit:fd-1",
      "entity:gold:gold-1",
      "entity:investment:inv-mf-1",
      "entity:investment:inv-stock-1",
      "entity:real-estate:re-1",
      "entity:retirement:ret-ppf-1",
      "entity:silver:silver-1",
    ]);

    const totalEntityOpening = context.currentState.projectionEntities?.reduce((sum, entity) => sum + entity.openingBalance, 0) ?? 0;
    expect(totalEntityOpening).toBe(12000);
  });
});
