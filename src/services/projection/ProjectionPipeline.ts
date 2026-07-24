import type { MonthlyLedger, ProjectionCurvePoint, ProjectionGoalFundingSummary, ProjectionRetirementReadiness, ProjectionRunResult } from "@/types/projection";

import type { ProjectionContext } from "./ProjectionContext";
import type { ProjectionStep } from "./steps/ProjectionStep";

export class ProjectionPipeline {
  constructor(private readonly steps: ReadonlyArray<ProjectionStep>) {}

  async execute(context: ProjectionContext): Promise<ProjectionContext> {
    let currentContext = context;

    for (const step of this.steps) {
      currentContext = await step.execute(currentContext);
    }

    return currentContext;
  }
}

function toCurve(ledger: MonthlyLedger, selector: (record: MonthlyLedger[number]) => number): ProjectionCurvePoint[] {
  return ledger.map((record) => ({
    month: record.month,
    value: selector(record),
  }));
}

function buildGoalFundingSummary(ledger: MonthlyLedger, goalCount: number): ProjectionGoalFundingSummary {
  const totalGoalFunding = ledger.reduce((sum, record) => sum + Number(record.goalFunding ?? 0), 0);

  return {
    totalGoals: goalCount,
    fundedGoals: 0,
    totalGoalFunding,
    remainingGoalFunding: 0,
    items: [],
  };
}

function buildRetirementReadiness(): ProjectionRetirementReadiness {
  return {
    status: "not-evaluated",
    message: "Retirement readiness evaluation will be introduced by future planning modules.",
  };
}

export function buildProjectionRunResult(ledger: MonthlyLedger, goalCount: number): ProjectionRunResult {
  return {
    monthlyLedger: ledger,
    netWorthCurve: toCurve(ledger, (record) => record.closingNetWorth),
    investmentCurve: toCurve(ledger, (record) => record.closingInvestments + record.retirementCorpus),
    cashCurve: toCurve(ledger, (record) => record.closingCash),
    loanCurve: toCurve(ledger, (record) => record.closingLiabilities),
    goalFundingSummary: buildGoalFundingSummary(ledger, goalCount),
    retirementReadiness: buildRetirementReadiness(),
  };
}