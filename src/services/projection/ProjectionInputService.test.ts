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
  });
});
