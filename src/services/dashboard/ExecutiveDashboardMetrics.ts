import type { GoalStatus, FinancialGoalWithProgress } from "@/types/financialGoal";

export type DashboardTrafficLight = "green" | "amber" | "red";

export interface FinancialHealthComponentRow {
  key: "savingsRate" | "retirementReadiness" | "debtRatio" | "goalReadiness" | "emergencyFund" | "insuranceCoverage";
  label: string;
  score: number | null;
  maxScore: number;
  status: DashboardTrafficLight;
  reason: string;
}

export interface FinancialHealthBreakdownInput {
  savingsRate: number | null;
  retirementReadinessPercent: number | null;
  debtRatio: number | null;
  goalReadinessPercent: number | null;
  emergencyFundScore: number | null;
  insuranceCoverageScore: number | null;
}

export type RetirementReadinessStatus = "On Track" | "Watch" | "At Risk";

export interface GoalHeatmapRow {
  id: string;
  name: string;
  targetDate: string;
  fundingPercent: number | null;
  gapOrSurplus: number | null;
  status: "Funded" | "On Track" | "Watch" | "At Risk";
}

export interface AllocationDriftRow {
  assetClass: "Equity" | "Debt" | "Cash" | "Real Estate" | "Retirement Accounts" | "Other";
  currentPercent: number | null;
  targetPercent: number | null;
  driftPercent: number | null;
  needsAction: boolean;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreFromPercent(percent: number | null, maxScore: number): number | null {
  if (percent === null || !Number.isFinite(percent)) {
    return null;
  }

  return Math.round((Math.max(0, Math.min(100, percent)) / 100) * maxScore);
}

function scoreFromDebtRatio(debtRatio: number | null, maxScore: number): number | null {
  if (debtRatio === null || !Number.isFinite(debtRatio)) {
    return null;
  }

  if (debtRatio <= 0.25) {
    return maxScore;
  }

  if (debtRatio >= 0.8) {
    return 0;
  }

  const normalized = (0.8 - debtRatio) / (0.8 - 0.25);
  return Math.round(Math.max(0, Math.min(1, normalized)) * maxScore);
}

function statusFromRatio(ratio: number | null): DashboardTrafficLight {
  if (ratio === null) {
    return "amber";
  }

  if (ratio >= 0.75) {
    return "green";
  }

  if (ratio >= 0.5) {
    return "amber";
  }

  return "red";
}

export function classifyRetirementReadinessStatus(readinessPercent: number | null): RetirementReadinessStatus {
  if (readinessPercent === null) {
    return "Watch";
  }

  if (readinessPercent >= 100) {
    return "On Track";
  }

  if (readinessPercent >= 80) {
    return "Watch";
  }

  return "At Risk";
}

export function classifyGoalFundingStatus(goalStatus: GoalStatus, progressPercent: number | null): GoalHeatmapRow["status"] {
  if (goalStatus === "COMPLETED" || (progressPercent !== null && progressPercent >= 100)) {
    return "Funded";
  }

  if (goalStatus === "ON_TRACK" || (progressPercent !== null && progressPercent >= 70)) {
    return "On Track";
  }

  if (goalStatus === "NEEDS_ATTENTION" || (progressPercent !== null && progressPercent >= 40)) {
    return "Watch";
  }

  return "At Risk";
}

export function buildGoalHeatmapRows(goals: FinancialGoalWithProgress[]): GoalHeatmapRow[] {
  return [...goals]
    .sort((left, right) => left.target_date.localeCompare(right.target_date))
    .map((goal) => {
      const targetAmount = Number(goal.progress?.target_amount ?? goal.target_amount ?? 0);
      const projectedAmount = Number(goal.progress?.projected_amount ?? 0);
      const fundingPercent = goal.progress ? clampPercent(Number(goal.progress.progress_percent ?? 0)) : null;

      return {
        id: goal.id,
        name: goal.name,
        targetDate: goal.target_date,
        fundingPercent,
        gapOrSurplus: goal.progress ? projectedAmount - targetAmount : null,
        status: classifyGoalFundingStatus(goal.status, fundingPercent),
      } satisfies GoalHeatmapRow;
    });
}

export function buildFinancialHealthBreakdown(input: FinancialHealthBreakdownInput): FinancialHealthComponentRow[] {
  const rows: FinancialHealthComponentRow[] = [];

  const savingsMax = 20;
  const retirementMax = 20;
  const debtMax = 20;
  const goalsMax = 20;
  const emergencyMax = 10;
  const insuranceMax = 10;

  const savingsPercent = input.savingsRate === null ? null : Math.max(0, Math.min(100, input.savingsRate * 200));
  const savingsScore = scoreFromPercent(savingsPercent, savingsMax);
  rows.push({
    key: "savingsRate",
    label: "Savings Rate",
    score: savingsScore,
    maxScore: savingsMax,
    status: statusFromRatio(savingsScore === null ? null : savingsScore / savingsMax),
    reason: savingsScore === null
      ? "Data required"
      : savingsPercent !== null && savingsPercent < 50
        ? "Savings rate is below target threshold."
        : "Savings rate is supporting long-term planning.",
  });

  const retirementScore = scoreFromPercent(input.retirementReadinessPercent, retirementMax);
  rows.push({
    key: "retirementReadiness",
    label: "Retirement Readiness",
    score: retirementScore,
    maxScore: retirementMax,
    status: statusFromRatio(retirementScore === null ? null : retirementScore / retirementMax),
    reason: retirementScore === null
      ? "Set assumptions to calculate this metric"
      : (input.retirementReadinessPercent ?? 0) < 80
        ? "Retirement corpus is below planned requirement."
        : "Retirement corpus is aligned with current plan.",
  });

  const debtScore = scoreFromDebtRatio(input.debtRatio, debtMax);
  rows.push({
    key: "debtRatio",
    label: "Debt Ratio",
    score: debtScore,
    maxScore: debtMax,
    status: statusFromRatio(debtScore === null ? null : debtScore / debtMax),
    reason: debtScore === null
      ? "Data required"
      : (input.debtRatio ?? 0) > 0.35
        ? "Debt load is elevated versus target policy."
        : "Debt ratio remains within tolerance.",
  });

  const goalScore = scoreFromPercent(input.goalReadinessPercent, goalsMax);
  rows.push({
    key: "goalReadiness",
    label: "Goal Readiness",
    score: goalScore,
    maxScore: goalsMax,
    status: statusFromRatio(goalScore === null ? null : goalScore / goalsMax),
    reason: goalScore === null
      ? "Data required"
      : (input.goalReadinessPercent ?? 0) < 70
        ? "One or more goals need contribution or timeline adjustments."
        : "Goal funding progress is healthy.",
  });

  const emergencyScore = input.emergencyFundScore === null ? null : Math.round((Math.max(0, Math.min(100, input.emergencyFundScore)) / 100) * emergencyMax);
  rows.push({
    key: "emergencyFund",
    label: "Emergency Fund",
    score: emergencyScore,
    maxScore: emergencyMax,
    status: statusFromRatio(emergencyScore === null ? null : emergencyScore / emergencyMax),
    reason: emergencyScore === null
      ? "Data required"
      : emergencyScore < 6
        ? "Emergency reserve coverage needs strengthening."
        : "Emergency reserve coverage is adequate.",
  });

  const insuranceScore = input.insuranceCoverageScore === null ? null : Math.round((Math.max(0, Math.min(100, input.insuranceCoverageScore)) / 100) * insuranceMax);
  rows.push({
    key: "insuranceCoverage",
    label: "Insurance Coverage",
    score: insuranceScore,
    maxScore: insuranceMax,
    status: statusFromRatio(insuranceScore === null ? null : insuranceScore / insuranceMax),
    reason: insuranceScore === null ? "Data required" : "Insurance coverage evaluated from policy data.",
  });

  return rows;
}

export function buildAllocationDriftRows(input: {
  currentByClass: Record<AllocationDriftRow["assetClass"], number>;
  targetByClass: Partial<Record<AllocationDriftRow["assetClass"], number>> | null;
  driftThresholdPercent?: number;
}): AllocationDriftRow[] {
  const totalCurrent = Object.values(input.currentByClass).reduce((sum, value) => sum + Number(value ?? 0), 0);
  const threshold = Number.isFinite(input.driftThresholdPercent) ? Number(input.driftThresholdPercent) : 5;

  return (Object.keys(input.currentByClass) as AllocationDriftRow["assetClass"][]).map((assetClass) => {
    const currentValue = Number(input.currentByClass[assetClass] ?? 0);
    const currentPercent = totalCurrent > 0 ? (currentValue / totalCurrent) * 100 : null;
    const targetPercent = input.targetByClass?.[assetClass] ?? null;
    const driftPercent = currentPercent === null || targetPercent === null ? null : currentPercent - targetPercent;

    return {
      assetClass,
      currentPercent: currentPercent === null ? null : Math.round(currentPercent * 10) / 10,
      targetPercent,
      driftPercent: driftPercent === null ? null : Math.round(driftPercent * 10) / 10,
      needsAction: driftPercent !== null ? Math.abs(driftPercent) > threshold : false,
    } satisfies AllocationDriftRow;
  });
}
