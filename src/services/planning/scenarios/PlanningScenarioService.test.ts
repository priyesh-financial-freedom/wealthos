import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssumptionsBundle } from "@/types/assumptions";
import type { PlanningScenario, PlanningScenarioOverride, PlanningScenarioWithOverrides } from "@/types/planningScenario";
import type { SimulationOutcome, SimulationResult } from "@/services/simulation";

const runtime = vi.hoisted(() => {
  const authUser = { id: "user-1" };
  const supabaseClient = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: authUser }, error: null })),
    },
    from: vi.fn(),
  };

  const assumptionsBundle: AssumptionsBundle = {
    income: {
      monthlyIncome: 50000,
      annualIncrementRate: 5,
      salaryGrowthRate: 3,
      bonusAmount: 0,
      bonusMonth: 3,
      otherMonthlyIncome: 0,
      salaryStopMonth: 7,
      salaryStopYear: 2032,
    },
    investments: {
      monthlySipAmount: 1000,
      stockInvestmentAmount: 0,
      annualIncrementRate: 0,
      expectedReturnRate: 10,
      fixedDepositRate: 0,
      goldAppreciationRate: 0,
      realEstateAppreciationRate: 0,
    },
    inflation: {
      generalInflationRate: 6,
      educationInflationRate: 0,
      healthcareInflationRate: 0,
      retirementInflationRate: 0,
    },
    loans: {
      averageInterestRate: 0,
      emiIncrementRate: 0,
      annualPrepaymentAmount: 0,
      annualPrepaymentMonth: 3,
      useExtraCashForPrepayment: false,
    },
    retirement: {
      epfEmployeeContributionRate: 12,
      epfEmployerContributionRate: 12,
      npsContributionRate: 0,
      ppfMonthlyContribution: 0,
      retirementTargetAge: 60,
      salaryStopMonth: 7,
      salaryStopYear: 2032,
    },
    tax: {
      regime: "new",
      effectiveTaxRate: 0,
      surchargeRate: 0,
      cessRate: 0,
      note: "Test bundle",
    },
    planning: {
      startMonth: "2026-01",
      endYear: 2026,
      endMonth: 12,
    },
  };

  const simulationResult: SimulationResult = {
    summary: {
      snapshotId: "scenario-1",
      projectionStart: "2026-01",
      projectionEnd: "2026-12",
      snapshotCount: 12,
      openingNetWorth: 100000,
      finalNetWorth: 250000,
      netWorthChange: 150000,
    },
    monthlySnapshots: [],
    goalReadiness: { status: "not-evaluated", message: "Goal readiness summary" },
    cashFlowForecast: { points: [{ month: "2026-12", value: 12345, delta: 0 }] },
    netWorthProjection: { points: [] },
    assetProjection: { points: [] },
    liabilityProjection: { points: [] },
    metadata: {
      snapshotId: "scenario-1",
      projectionStart: "2026-01",
      projectionEnd: "2026-12",
      scenarioOverridesApplied: true,
      assumptionCount: 7,
      eventCount: 0,
      timelineMonths: 12,
    },
    executionTime: 1,
    simulationVersion: "test",
  };

  return {
    authUser,
    assumptionsBundle,
    simulationResult,
    supabaseClient,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: runtime.supabaseClient,
}));

vi.mock("@/services/assumptions", () => ({
  DEFAULT_SCENARIO_KEY: "default",
  assumptionsService: {
    getAssumptionsBundle: vi.fn(async () => runtime.assumptionsBundle),
  },
}));

vi.mock("@/services/projection", () => ({
  projectionEventsService: {
    listEvents: vi.fn(async () => []),
  },
}));

import { PlanningScenarioService } from "./PlanningScenarioService";
import type { PlanningScenarioEditableKey, PlanningScenarioInsert, PlanningScenarioOverrideInput } from "@/types/planningScenario";

type ScenarioState = PlanningScenarioWithOverrides[];

function buildScenario(id: string, overrides: PlanningScenarioOverride[] = []): PlanningScenarioWithOverrides {
  return {
    id,
    user_id: runtime.authUser.id,
    name: id,
    description: null,
    type: "CUSTOM",
    is_default: false,
    is_active: false,
    created_at: "2026-07-20T00:00:00.000Z",
    updated_at: "2026-07-20T00:00:00.000Z",
    overrides,
  };
}

function createStore(initial: ScenarioState = []) {
  const state = {
    scenarios: [...initial],
    overridesByScenario: new Map<string, PlanningScenarioOverride[]>(),
  };

  for (const scenario of initial) {
    state.overridesByScenario.set(scenario.id, [...scenario.overrides]);
  }

  const store = {
    listScenarios: vi.fn(async () => state.scenarios.map((scenario) => ({ ...scenario, overrides: [...(state.overridesByScenario.get(scenario.id) ?? [])] }))),
    getScenario: vi.fn(async (_userId: string, scenarioId: string) => {
      const scenario = state.scenarios.find((item) => item.id === scenarioId);
      if (!scenario) {
        return null;
      }

      return { ...scenario, overrides: [...(state.overridesByScenario.get(scenario.id) ?? [])] };
    }),
    createScenario: vi.fn(async (_userId: string, input: PlanningScenarioInsert) => {
      const created: PlanningScenario = {
        id: `scenario-${state.scenarios.length + 1}`,
        user_id: runtime.authUser.id,
        name: input.name,
        description: input.description ?? null,
        type: input.type ?? "CUSTOM",
        is_default: Boolean(input.is_default),
        is_active: Boolean(input.is_active),
        created_at: "2026-07-20T00:00:00.000Z",
        updated_at: "2026-07-20T00:00:00.000Z",
      };

      state.scenarios.push({ ...created, overrides: [] });
      state.overridesByScenario.set(created.id, []);
      return created;
    }),
    updateScenario: vi.fn(async (_userId: string, input: { id: string; name?: string; description?: string | null; type?: string }) => {
      const scenario = state.scenarios.find((item) => item.id === input.id);
      if (!scenario) {
        throw new Error("Scenario not found.");
      }

      scenario.name = input.name ?? scenario.name;
      scenario.description = input.description ?? scenario.description;
      scenario.type = (input.type as PlanningScenario["type"]) ?? scenario.type;
      if (typeof (input as { is_active?: boolean }).is_active === "boolean") {
        scenario.is_active = (input as { is_active?: boolean }).is_active as boolean;
      }
      if (typeof (input as { is_default?: boolean }).is_default === "boolean") {
        scenario.is_default = (input as { is_default?: boolean }).is_default as boolean;
      }
      scenario.updated_at = "2026-07-21T00:00:00.000Z";
      return { ...scenario };
    }),
    deleteScenario: vi.fn(async (_userId: string, scenarioId: string) => {
      state.scenarios = state.scenarios.filter((scenario) => scenario.id !== scenarioId);
      state.overridesByScenario.delete(scenarioId);
    }),
    saveOverrides: vi.fn(async (_userId: string, scenarioId: string, overrides: PlanningScenarioOverrideInput[]) => {
      state.overridesByScenario.set(
        scenarioId,
        overrides.map((override, index) => ({
          id: `${scenarioId}-override-${index + 1}`,
          user_id: runtime.authUser.id,
          scenario_id: scenarioId,
          assumption_key: override.assumption_key,
          override_value: override.override_value,
          created_at: "2026-07-20T00:00:00.000Z",
          updated_at: "2026-07-20T00:00:00.000Z",
        })),
      );
    }),
    loadOverrides: vi.fn(async (_userId: string, scenarioId: string) => state.overridesByScenario.get(scenarioId) ?? []),
  };

  return { state, store };
}

describe("PlanningScenarioService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the first scenario as the default active base scenario", async () => {
    const { store } = createStore();
    const service = new PlanningScenarioService({ store: store as never, simulationEngine: { run: vi.fn() } as never });

    const created = await service.createScenario({ name: "Retirement Plan", description: "Primary scenario" });

    expect(created.type).toBe("BASE");
    expect(created.is_default).toBe(true);
    expect(created.is_active).toBe(true);
    expect(store.createScenario).toHaveBeenCalledWith(runtime.authUser.id, expect.objectContaining({ name: "Retirement Plan", is_default: true, is_active: true }));
  });

  it("activates the selected scenario and deactivates the others", async () => {
    const scenarios = [buildScenario("scenario-1"), buildScenario("scenario-2")];
    const { store } = createStore(scenarios);

    const service = new PlanningScenarioService({ store: store as never, simulationEngine: { run: vi.fn() } as never });
    const activated = await service.activateScenario("scenario-2");

    expect(activated.id).toBe("scenario-2");
    expect(activated.is_active).toBe(true);
    expect(scenarios[0].is_active).toBe(false);
    expect(scenarios[1].is_active).toBe(true);
  });

  it("stores only editable overrides and replaces previous values", async () => {
    const { store } = createStore([buildScenario("scenario-1")]);
    const service = new PlanningScenarioService({ store: store as never, simulationEngine: { run: vi.fn() } as never });

    await service.saveOverrides("scenario-1", [
      { assumption_key: "salary_growth_rate", override_value: 9 },
      { assumption_key: "inflation_rate", override_value: 4 },
      { assumption_key: "not_editable" as PlanningScenarioEditableKey, override_value: 1 },
    ]);

    const overrides = await service.loadOverrides("scenario-1");
    expect(overrides).toHaveLength(2);
    expect(overrides.map((override) => override.assumption_key)).toEqual(["salary_growth_rate", "inflation_rate"]);
  });

  it("duplicates a scenario with a copy name and cloned overrides", async () => {
    const original = buildScenario("scenario-1", [
      {
        id: "override-1",
        user_id: runtime.authUser.id,
        scenario_id: "scenario-1",
        assumption_key: "salary_growth_rate",
        override_value: 12,
        created_at: "2026-07-20T00:00:00.000Z",
        updated_at: "2026-07-20T00:00:00.000Z",
      },
    ]);
    const { store } = createStore([original]);
    const service = new PlanningScenarioService({ store: store as never, simulationEngine: { run: vi.fn() } as never });

    const duplicate = await service.duplicateScenario("scenario-1");

    expect(duplicate.name).toBe("scenario-1 Copy");
    expect(duplicate.overrides).toHaveLength(1);
    expect(duplicate.overrides[0].assumption_key).toBe("salary_growth_rate");
    expect(store.saveOverrides).toHaveBeenCalled();
  });

  it("runs the simulation engine with the scenario overrides", async () => {
    const { store } = createStore([
      buildScenario("scenario-1", [
        {
          id: "override-1",
          user_id: runtime.authUser.id,
          scenario_id: "scenario-1",
          assumption_key: "salary_growth_rate",
          override_value: 11,
          created_at: "2026-07-20T00:00:00.000Z",
          updated_at: "2026-07-20T00:00:00.000Z",
        },
      ]),
    ]);

    const run = vi.fn(async (request: { snapshotId: string; scenarioOverrides?: { assumptions?: Record<string, unknown> } }): Promise<SimulationOutcome> => {
      expect(request.snapshotId).toBe("scenario-1");
      expect(request.scenarioOverrides?.assumptions?.income).toMatchObject({ salaryGrowthRate: 11 });
      return { ok: true, result: runtime.simulationResult };
    });

    const service = new PlanningScenarioService({ store: store as never, simulationEngine: { run } as never });
    const result = await service.runSimulation("scenario-1");

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.summary.finalNetWorth).toBe(250000);
  });
});