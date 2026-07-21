import type { DecisionEngineContext, DecisionRuleResult } from "./DecisionTypes";

interface RuleDefinition {
  id: string;
  evaluate: (context: DecisionEngineContext) => DecisionRuleResult[];
}

function parseEmergencyCoverageMonths(detail: string): number | null {
  const match = detail.match(/Emergency coverage is\s+([0-9]+(?:\.[0-9]+)?)\s+months/i);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function emergencyFundRule(context: DecisionEngineContext): DecisionRuleResult[] {
  const emergency = context.healthScore.components.find((component) => component.key === "emergencyFund");
  if (!emergency) {
    return [];
  }

  const coverageMonths = parseEmergencyCoverageMonths(emergency.detail);
  const isTriggered = (coverageMonths !== null && coverageMonths < 6) || emergency.score < 75;

  if (!isTriggered) {
    return [];
  }

  return [
    {
      ruleId: "rule-emergency-fund",
      id: "decision-emergency-fund",
      title: "Build Emergency Fund Coverage",
      category: "Liquidity",
      priority: coverageMonths !== null && coverageMonths < 3 ? "Critical" : "High",
      severity: coverageMonths !== null && coverageMonths < 3 ? "Red" : "Amber",
      reason: coverageMonths === null
        ? "Emergency reserve score indicates insufficient coverage for monthly commitments."
        : `Emergency reserve coverage is ${coverageMonths.toFixed(1)} months, below the six-month threshold.`,
      recommendedAction: "Increase liquid savings contributions until emergency reserves reach at least six months.",
      expectedBenefit: "Improves resilience to income disruptions and unplanned expenses.",
      confidence: coverageMonths === null ? 0.82 : 0.9,
    },
  ];
}

function retirementScoreRule(context: DecisionEngineContext): DecisionRuleResult[] {
  const retirement = context.healthScore.components.find((component) => component.key === "retirement");
  if (!retirement || retirement.score >= 75) {
    return [];
  }

  return [
    {
      ruleId: "rule-retirement-score",
      id: "decision-retirement-score",
      title: "Increase Retirement Contributions",
      category: "Retirement",
      priority: retirement.score < 60 ? "High" : "Medium",
      severity: retirement.score < 60 ? "Red" : "Amber",
      reason: `Retirement score is ${retirement.score}, below the target score of 75.`,
      recommendedAction: "Increase monthly retirement contributions and review long-term assumptions.",
      expectedBenefit: "Raises long-term retirement readiness and compounding potential.",
      confidence: 0.88,
    },
  ];
}

function debtRatioRule(context: DecisionEngineContext): DecisionRuleResult[] {
  const debtRatio = Number(context.balanceSheetSummary.debtRatio ?? 0);
  if (debtRatio <= 0.35) {
    return [];
  }

  return [
    {
      ruleId: "rule-debt-ratio",
      id: "decision-debt-ratio",
      title: "Prioritize Loan Prepayment",
      category: "Debt",
      priority: debtRatio > 0.5 ? "Critical" : "High",
      severity: debtRatio > 0.5 ? "Red" : "Amber",
      reason: `Debt ratio is ${(debtRatio * 100).toFixed(1)}%, above the 35% threshold.`,
      recommendedAction: "Allocate surplus cash to high-interest debt prepayment and evaluate refinance opportunities.",
      expectedBenefit: "Reduces leverage risk and improves monthly cash flexibility.",
      confidence: 0.92,
    },
  ];
}

function goalProgressRule(context: DecisionEngineContext): DecisionRuleResult[] {
  return context.goals
    .filter((goal) => Number(goal.progress?.progress_percent ?? 0) < 70)
    .map((goal) => {
      const progress = Number(goal.progress?.progress_percent ?? 0);

      return {
        ruleId: "rule-goal-progress",
        id: `decision-goal-progress-${goal.id}`,
        title: `Accelerate Goal Funding: ${goal.name}`,
        category: "Goals",
        priority: progress < 40 ? "High" : "Medium",
        severity: progress < 40 ? "Red" : "Amber",
        reason: `Goal progress is ${progress.toFixed(1)}%, below the 70% threshold.`,
        recommendedAction: "Increase monthly investment allocation or adjust the goal timeline/scenario.",
        expectedBenefit: "Improves probability of reaching target amount by target date.",
        confidence: 0.86,
      };
    });
}

function portfolioRebalanceRule(context: DecisionEngineContext): DecisionRuleResult[] {
  const diversification = context.healthScore.components.find((component) => component.key === "diversification");
  if (!diversification || diversification.score >= 70) {
    return [];
  }

  return [
    {
      ruleId: "rule-portfolio-rebalance",
      id: "decision-portfolio-rebalance",
      title: "Rebalance Portfolio Allocation",
      category: "Portfolio",
      priority: diversification.score < 50 ? "High" : "Medium",
      severity: diversification.score < 50 ? "Red" : "Amber",
      reason: `Diversification score is ${diversification.score}, indicating concentration above target tolerance.`,
      recommendedAction: "Rebalance exposure across diversified asset classes to reduce concentration risk.",
      expectedBenefit: "Lowers concentration risk and improves downside protection.",
      confidence: 0.84,
    },
  ];
}

function cashFlowRule(context: DecisionEngineContext): DecisionRuleResult[] {
  const cashFlowPoints = context.activeScenarioSimulation?.cashFlowForecast.points ?? context.baselineSimulation.cashFlowForecast.points;
  const lastPoint = cashFlowPoints.at(-1);

  if (!lastPoint || Number(lastPoint.delta ?? 0) >= 0) {
    return [];
  }

  return [
    {
      ruleId: "rule-cashflow-pressure",
      id: "decision-cashflow-pressure",
      title: "Address Cash Flow Pressure",
      category: "Cash Flow",
      priority: Number(lastPoint.delta) < -50000 ? "High" : "Medium",
      severity: Number(lastPoint.delta) < -50000 ? "Red" : "Amber",
      reason: `Latest projected cash-flow delta is ${Number(lastPoint.delta).toLocaleString("en-IN")}, indicating a negative trend.`,
      recommendedAction: "Reduce discretionary outflows or increase monthly inflows in the active planning scenario.",
      expectedBenefit: "Improves near-term liquidity and reduces dependence on debt.",
      confidence: 0.8,
    },
  ];
}

const RULES: RuleDefinition[] = [
  { id: "rule-emergency-fund", evaluate: emergencyFundRule },
  { id: "rule-retirement-score", evaluate: retirementScoreRule },
  { id: "rule-debt-ratio", evaluate: debtRatioRule },
  { id: "rule-goal-progress", evaluate: goalProgressRule },
  { id: "rule-portfolio-rebalance", evaluate: portfolioRebalanceRule },
  { id: "rule-cashflow-pressure", evaluate: cashFlowRule },
];

export function evaluateDecisionRules(context: DecisionEngineContext): DecisionRuleResult[] {
  return RULES.flatMap((rule) => rule.evaluate(context));
}
