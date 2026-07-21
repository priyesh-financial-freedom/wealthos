import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FinancialGoal, FinancialGoalInsert, FinancialGoalUpdate, GoalStatus } from "@/types/financialGoal";
import type { SimulationOutcome, SimulationResult } from "@/services/simulation";

const runtime = vi.hoisted(() => {
  const authUser = { id: "user-1" };
  const supabaseClient = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: authUser }, error: null })),
    },
  };

  const simulationResult: SimulationResult = {
    summary: {
      snapshotId: "snapshot-1",
      projectionStart: "2026-01",
      projectionEnd: "2032-12",
      snapshotCount: 84,
      openingNetWorth: 100000,
      finalNetWorth: 500000,
      netWorthChange: 400000,
    },
    monthlySnapshots: [],
    goalReadiness: { status: "not-evaluated", message: "Goal readiness is not yet evaluated." },
    cashFlowForecast: { points: [] },
    netWorthProjection: {
      points: [
        { month: "2028-12", value: 120000, delta: 0 },
        { month: "2030-06", value: 250000, delta: 0 },
        { month: "2032-12", value: 450000, delta: 0 },
      ],
    },
    assetProjection: { points: [] },
    liabilityProjection: { points: [] },
    metadata: {
      snapshotId: "snapshot-1",
      projectionStart: "2026-01",
      projectionEnd: "2032-12",
      scenarioOverridesApplied: false,
      assumptionCount: 0,
      eventCount: 0,
      timelineMonths: 84,
    },
    executionTime: 1,
    simulationVersion: "test",
  };

  return {
    authUser,
    supabaseClient,
    simulationResult,
  };
});

vi.mock("@/lib/supabase/client", () => ({
  supabase: runtime.supabaseClient,
}));

import { GoalService } from "./GoalService";

interface StoreState {
  goals: FinancialGoal[];
  scenarioNames: Map<string, string>;
  scenarioIds: Set<string>;
}

function buildGoal(partial?: Partial<FinancialGoal>): FinancialGoal {
  return {
    id: partial?.id ?? "goal-1",
    user_id: runtime.authUser.id,
    name: partial?.name ?? "Retirement corpus",
    goal_type: partial?.goal_type ?? "RETIREMENT",
    target_amount: partial?.target_amount ?? 300000,
    target_date: partial?.target_date ?? "2030-06-30",
    priority: partial?.priority ?? "HIGH",
    status: partial?.status ?? "NOT_STARTED",
    funding_source: partial?.funding_source ?? "Investments",
    linked_scenario_id: partial?.linked_scenario_id ?? null,
    notes: partial?.notes ?? null,
    is_completed: partial?.is_completed ?? false,
    created_at: partial?.created_at ?? "2026-07-21T00:00:00.000Z",
    updated_at: partial?.updated_at ?? "2026-07-21T00:00:00.000Z",
  };
}

function createStore(state?: Partial<StoreState>) {
  const local: StoreState = {
    goals: state?.goals ?? [],
    scenarioNames: state?.scenarioNames ?? new Map<string, string>(),
    scenarioIds: state?.scenarioIds ?? new Set<string>(),
  };

  return {
    listGoals: vi.fn(async () => [...local.goals]),
    getGoal: vi.fn(async (_userId: string, goalId: string) => local.goals.find((goal) => goal.id === goalId) ?? null),
    createGoal: vi.fn(async (_userId: string, input: FinancialGoalInsert) => {
      const created = buildGoal({
        id: `goal-${local.goals.length + 1}`,
        name: input.name,
        goal_type: input.goal_type,
        target_amount: input.target_amount,
        target_date: input.target_date,
        priority: input.priority,
        funding_source: input.funding_source ?? null,
        linked_scenario_id: input.linked_scenario_id ?? null,
        notes: input.notes ?? null,
      });
      local.goals.unshift(created);
      return created;
    }),
    updateGoal: vi.fn(async (_userId: string, input: FinancialGoalUpdate) => {
      const existing = local.goals.find((goal) => goal.id === input.id);
      if (!existing) {
        throw new Error("Goal not found.");
      }

      Object.assign(existing, input, { updated_at: "2026-07-21T10:00:00.000Z" });
      return { ...existing };
    }),
    deleteGoal: vi.fn(async (_userId: string, goalId: string) => {
      local.goals = local.goals.filter((goal) => goal.id !== goalId);
    }),
    listScenarioNames: vi.fn(async () => new Map(local.scenarioNames)),
    hasScenario: vi.fn(async (_userId: string, scenarioId: string) => local.scenarioIds.has(scenarioId)),
  };
}

describe("GoalService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a goal with defaults and calculated progress", async () => {
    const store = createStore();
    const run = vi.fn(async (): Promise<SimulationOutcome> => ({ ok: true, result: runtime.simulationResult }));
    const service = new GoalService({
      store: store as never,
      simulationEngine: { run } as never,
      now: () => new Date("2026-07-21T00:00:00.000Z"),
    });

    const created = await service.createGoal({
      name: "Emergency corpus",
      goal_type: "CUSTOM",
      target_amount: 200000,
      target_date: "2030-06-15",
      priority: "MEDIUM",
      funding_source: "Savings",
      notes: "Core safety net",
    });

    expect(store.createGoal).toHaveBeenCalled();
    expect(created.status).toBe("ON_TRACK");
    expect(created.progress?.progress_percent).toBe(100);
  });

  it("links a goal to a planning scenario", async () => {
    const store = createStore({
      goals: [buildGoal({ id: "goal-1" })],
      scenarioIds: new Set(["scenario-1"]),
      scenarioNames: new Map([["scenario-1", "Aggressive Growth"]]),
    });
    const service = new GoalService({
      store: store as never,
      simulationEngine: { run: vi.fn(async () => ({ ok: true, result: runtime.simulationResult })) } as never,
      scenarioSimulation: vi.fn(async () => runtime.simulationResult),
      now: () => new Date("2026-07-21T00:00:00.000Z"),
    });

    const linked = await service.linkScenario("goal-1", "scenario-1");

    expect(store.updateGoal).toHaveBeenCalledWith(runtime.authUser.id, expect.objectContaining({ id: "goal-1", linked_scenario_id: "scenario-1" }));
    expect(linked.linked_scenario_id).toBe("scenario-1");
    expect(linked.linked_scenario_name).toBe("Aggressive Growth");
  });

  it("calculates goal progress using the FinancialSimulationEngine", async () => {
    const store = createStore({ goals: [buildGoal({ id: "goal-1", target_amount: 500000, target_date: "2032-12-31" })] });
    const run = vi.fn(async (): Promise<SimulationOutcome> => ({ ok: true, result: runtime.simulationResult }));
    const service = new GoalService({
      store: store as never,
      simulationEngine: { run } as never,
      now: () => new Date("2026-07-21T00:00:00.000Z"),
    });

    const progress = await service.calculateGoalProgress("goal-1");

    expect(run).toHaveBeenCalledTimes(1);
    expect(progress.projected_amount).toBe(450000);
    expect(progress.progress_percent).toBe(90);
    expect(progress.status).toBe("ON_TRACK");
  });

  it("marks a goal completed", async () => {
    const store = createStore({ goals: [buildGoal({ id: "goal-1", status: "ON_TRACK" })] });
    const service = new GoalService({
      store: store as never,
      simulationEngine: { run: vi.fn(async () => ({ ok: true, result: runtime.simulationResult })) } as never,
      now: () => new Date("2026-07-21T00:00:00.000Z"),
    });

    const completed = await service.markCompleted("goal-1");

    expect(store.updateGoal).toHaveBeenCalledWith(runtime.authUser.id, expect.objectContaining({ id: "goal-1", is_completed: true, status: "COMPLETED" }));
    expect(completed.status).toBe("COMPLETED");
    expect(completed.is_completed).toBe(true);
  });

  it("applies status transitions based on projected progress and due date", async () => {
    const goals = [
      buildGoal({ id: "g-not-started", target_amount: 300000, target_date: "2027-01-01", status: "NOT_STARTED" }),
      buildGoal({ id: "g-needs-attention", target_amount: 500000, target_date: "2030-01-01", status: "NOT_STARTED" }),
      buildGoal({ id: "g-at-risk", target_amount: 900000, target_date: "2025-01-01", status: "NOT_STARTED" }),
      buildGoal({ id: "g-completed", target_amount: 200000, target_date: "2030-01-01", status: "COMPLETED", is_completed: true }),
    ];
    const store = createStore({ goals });

    const simulationByGoal: Record<string, SimulationResult> = {
      "g-not-started": {
        ...runtime.simulationResult,
        netWorthProjection: { points: [{ month: "2027-01", value: 0, delta: 0 }] },
      },
      "g-needs-attention": {
        ...runtime.simulationResult,
        netWorthProjection: { points: [{ month: "2030-01", value: 260000, delta: 0 }] },
      },
      "g-at-risk": {
        ...runtime.simulationResult,
        netWorthProjection: { points: [{ month: "2025-01", value: 100000, delta: 0 }] },
      },
      "g-completed": {
        ...runtime.simulationResult,
        netWorthProjection: { points: [{ month: "2030-01", value: 210000, delta: 0 }] },
      },
    };

    const run = vi.fn(async (request: { snapshotId: string }): Promise<SimulationOutcome> => ({
      ok: true,
      result: simulationByGoal[request.snapshotId],
    }));

    const service = new GoalService({
      store: store as never,
      simulationEngine: { run } as never,
      now: () => new Date("2026-07-21T00:00:00.000Z"),
    });

    const all = await service.listGoals({ includeProgress: true });
    const statusById = new Map<string, GoalStatus>(all.map((goal) => [goal.id, goal.status]));

    expect(statusById.get("g-not-started")).toBe("NOT_STARTED");
    expect(statusById.get("g-needs-attention")).toBe("NEEDS_ATTENTION");
    expect(statusById.get("g-at-risk")).toBe("AT_RISK");
    expect(statusById.get("g-completed")).toBe("COMPLETED");
  });
});
