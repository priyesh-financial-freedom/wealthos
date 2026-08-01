import { describe, expect, it } from "vitest";

import {
  buildAllocationDriftRows,
  buildFinancialHealthBreakdown,
  buildGoalHeatmapRows,
  classifyGoalFundingStatus,
  classifyRetirementReadinessStatus,
} from "./ExecutiveDashboardMetrics";

describe("ExecutiveDashboardMetrics", () => {
  it("classifies retirement readiness status", () => {
    expect(classifyRetirementReadinessStatus(102)).toBe("On Track");
    expect(classifyRetirementReadinessStatus(84)).toBe("Watch");
    expect(classifyRetirementReadinessStatus(62)).toBe("At Risk");
  });

  it("classifies goal status by business rules", () => {
    expect(classifyGoalFundingStatus("COMPLETED", 100)).toBe("Funded");
    expect(classifyGoalFundingStatus("ON_TRACK", 75)).toBe("On Track");
    expect(classifyGoalFundingStatus("NEEDS_ATTENTION", 55)).toBe("Watch");
    expect(classifyGoalFundingStatus("AT_RISK", 20)).toBe("At Risk");
  });

  it("builds financial health component rows with data-required handling", () => {
    const rows = buildFinancialHealthBreakdown({
      savingsRate: 0.12,
      retirementReadinessPercent: 78,
      debtRatio: 0.48,
      goalReadinessPercent: 66,
      emergencyFundScore: 58,
      insuranceCoverageScore: null,
    });

    expect(rows).toHaveLength(6);
    expect(rows.find((row) => row.key === "insuranceCoverage")?.reason).toBe("Data required");
    expect(rows.find((row) => row.key === "debtRatio")?.status).toBe("amber");
  });

  it("builds goal heatmap rows and drift rows", () => {
    const goals = [
      {
        id: "goal-1",
        user_id: "user-1",
        name: "Retirement",
        goal_type: "RETIREMENT",
        custom_goal_type: null,
        target_amount: 1000000,
        target_date: "2035-12-31",
        priority: "HIGH",
        status: "ON_TRACK",
        funding_source: null,
        linked_scenario_id: null,
        notes: null,
        is_completed: false,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        linked_scenario_name: null,
        progress: {
          goal_id: "goal-1",
          target_amount: 1000000,
          projected_amount: 850000,
          progress_percent: 85,
          status: "ON_TRACK",
          projection_month: "2035-12",
        },
      },
    ] as never;

    const heatmapRows = buildGoalHeatmapRows(goals);
    expect(heatmapRows[0].status).toBe("On Track");

    const driftRows = buildAllocationDriftRows({
      currentByClass: {
        Equity: 50,
        Debt: 10,
        Cash: 10,
        "Real Estate": 20,
        "Retirement Accounts": 5,
        Other: 5,
      },
      targetByClass: {
        Equity: 40,
        Debt: 20,
        Cash: 10,
        "Real Estate": 15,
        "Retirement Accounts": 10,
        Other: 5,
      },
      driftThresholdPercent: 5,
    });

    expect(driftRows.find((row) => row.assetClass === "Equity")?.needsAction).toBe(true);
  });

  it("returns empty heatmap rows when goal data is unavailable", () => {
    expect(buildGoalHeatmapRows([])).toEqual([]);
  });

  it("handles missing target allocation assumptions", () => {
    const driftRows = buildAllocationDriftRows({
      currentByClass: {
        Equity: 0,
        Debt: 0,
        Cash: 0,
        "Real Estate": 0,
        "Retirement Accounts": 0,
        Other: 0,
      },
      targetByClass: null,
      driftThresholdPercent: 5,
    });

    expect(driftRows.every((row) => row.targetPercent === null)).toBe(true);
    expect(driftRows.every((row) => row.driftPercent === null)).toBe(true);
  });

  it("maps surplus and gap values correctly in goal heatmap rows", () => {
    const goals = [
      {
        id: "goal-surplus",
        user_id: "user-1",
        name: "Corpus Surplus",
        goal_type: "CUSTOM",
        custom_goal_type: "Custom",
        target_amount: 100,
        target_date: "2030-12-31",
        priority: "MEDIUM",
        status: "ON_TRACK",
        funding_source: null,
        linked_scenario_id: null,
        notes: null,
        is_completed: false,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        linked_scenario_name: null,
        progress: {
          goal_id: "goal-surplus",
          target_amount: 100,
          projected_amount: 125,
          progress_percent: 100,
          status: "COMPLETED",
          projection_month: "2030-12",
        },
      },
      {
        id: "goal-gap",
        user_id: "user-1",
        name: "Corpus Gap",
        goal_type: "CUSTOM",
        custom_goal_type: "Custom",
        target_amount: 100,
        target_date: "2031-12-31",
        priority: "MEDIUM",
        status: "AT_RISK",
        funding_source: null,
        linked_scenario_id: null,
        notes: null,
        is_completed: false,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        linked_scenario_name: null,
        progress: {
          goal_id: "goal-gap",
          target_amount: 100,
          projected_amount: 60,
          progress_percent: 60,
          status: "AT_RISK",
          projection_month: "2031-12",
        },
      },
    ] as never;

    const rows = buildGoalHeatmapRows(goals);
    const surplus = rows.find((row) => row.id === "goal-surplus");
    const gap = rows.find((row) => row.id === "goal-gap");

    expect(surplus?.gapOrSurplus).toBeGreaterThan(0);
    expect(gap?.gapOrSurplus).toBeLessThan(0);
  });
});
