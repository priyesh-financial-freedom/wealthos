import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Investment } from "@/types/investment";

const runtime = vi.hoisted(() => {
  return {
    createInvestment: vi.fn(),
    updateInvestment: vi.fn(),
    getInvestments: vi.fn(),
    deleteInvestment: vi.fn(),
  };
});

vi.mock("@/services/investments", () => ({
  createInvestment: runtime.createInvestment,
  updateInvestment: runtime.updateInvestment,
  getInvestments: runtime.getInvestments,
  deleteInvestment: runtime.deleteInvestment,
}));

import { createStartupInvestment, updateStartupInvestment } from "./startupInvestments";

function buildInvestment(partial?: Partial<Investment>): Investment {
  return {
    id: partial?.id ?? "inv-1",
    user_id: partial?.user_id ?? "user-1",
    owner: partial?.owner ?? "Owner",
    institution: partial?.institution ?? "Acme",
    investment_name: partial?.investment_name ?? "Acme",
    investment_type: partial?.investment_type ?? "Startup Investments",
    category: partial?.category ?? "Startup Investments",
    acquisition_date: partial?.acquisition_date ?? "2026-01-01",
    cost_value: partial?.cost_value ?? 100000,
    current_value: partial?.current_value ?? 500000,
    status: partial?.status ?? "active",
    notes: partial?.notes ?? null,
    created_at: partial?.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: partial?.updated_at ?? "2026-01-01T00:00:00.000Z",
    gain_loss: partial?.gain_loss ?? 400000,
    cagr: partial?.cagr ?? null,
    xirr: partial?.xirr ?? null,
    exposure: partial?.exposure ?? {
      debtPct: 0,
      equityPct: 0,
      intlPct: 0,
      retirementPct: 0,
      goldPct: 0,
      fixedDepositPct: 0,
      preciousMetalsPct: 0,
    },
    startup_funding_round: partial?.startup_funding_round ?? "Seed",
    startup_ownership_percent: partial?.startup_ownership_percent ?? 2,
  };
}

describe("startupInvestments service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps create payload with the exact current estimated value", async () => {
    runtime.createInvestment.mockResolvedValue(buildInvestment());

    await createStartupInvestment({
      startup_name: "Acme Labs",
      funding_round: "Series A",
      investment_date: "2026-03-15",
      amount_invested: 500000,
      ownership_percent: 3.2,
      current_estimated_value: 3200000,
      owner: "Priyesh",
      status: "active",
      notes: null,
    });

    expect(runtime.createInvestment).toHaveBeenCalledTimes(1);
    expect(runtime.createInvestment).toHaveBeenCalledWith(expect.objectContaining({
      category: "Startup Investments",
      investment_type: "Startup Investments",
      cost_value: 500000,
      cost_basis: 500000,
      current_value: 3200000,
      units: 0,
      nav_price: 0,
    }));
  });

  it("preserves and updates current estimated value in edit flow", async () => {
    runtime.getInvestments.mockResolvedValue([
      buildInvestment({ id: "inv-1", cost_value: 800000, current_value: 2500000 }),
    ]);
    runtime.updateInvestment.mockResolvedValue(buildInvestment({ id: "inv-1", current_value: 3000000 }));

    await updateStartupInvestment({
      id: "inv-1",
      current_estimated_value: 3000000,
    });

    expect(runtime.updateInvestment).toHaveBeenCalledTimes(1);
    expect(runtime.updateInvestment).toHaveBeenCalledWith(expect.objectContaining({
      id: "inv-1",
      current_value: 3000000,
      units: 0,
      nav_price: 0,
    }));
  });
});
