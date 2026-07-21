import { ContributionPolicyHealthService } from "@/services/contributions/ContributionPolicyHealthService";
import type { ContributionPolicy, ContributionPolicyAnalysis, ContributionRecommendation } from "@/types/contributionPolicy";

export class ContributionRecommendationService {
  constructor(private readonly healthService = new ContributionPolicyHealthService()) {}

  analysePolicy(policy: ContributionPolicy): ContributionPolicyAnalysis {
    const health = this.healthService.calculateHealthScore(policy);
    const improvements = this.identifyImprovement(policy);

    const recommendations: ContributionRecommendation[] = [];
    const increase = this.recommendIncrease(policy);
    if (increase) {
      recommendations.push(increase);
    }

    const pause = this.recommendPause(policy);
    if (pause) {
      recommendations.push(pause);
    }

    const cashProtection = this.recommendCashProtection(policy);
    if (cashProtection) {
      recommendations.push(cashProtection);
    }

    const goalLink = this.recommendGoalLink(policy);
    if (goalLink) {
      recommendations.push(goalLink);
    }

    if (recommendations.length === 0) {
      recommendations.push({
        code: "NO_ACTION",
        message: "Policy is healthy. No immediate recommendation.",
        priority: "LOW",
      });
    }

    return {
      policyId: policy.id,
      health,
      improvements,
      recommendations,
    };
  }

  identifyImprovement(policy: ContributionPolicy): string[] {
    const items: string[] = [];

    if (!policy.cashProtectionEnabled) {
      items.push("Enable cash protection for safer recurring execution.");
    }

    if (policy.minLimitAmount === null && policy.maxLimitAmount === null) {
      items.push("Define contribution limits to enforce safer contribution boundaries.");
    }

    if (!policy.goalReference) {
      items.push("Link this policy to a goal for better planning alignment.");
    }

    if (policy.growthStrategy === "FIXED") {
      items.push("Consider a step-up strategy to improve long-term contribution compounding.");
    }

    return items;
  }

  recommendIncrease(policy: ContributionPolicy): ContributionRecommendation | null {
    if (policy.status !== "ACTIVE") {
      return null;
    }

    if (policy.growthStrategy !== "FIXED") {
      return null;
    }

    return {
      code: "INCREASE",
      message: "Consider a structured annual step-up for this active fixed contribution policy.",
      priority: "MEDIUM",
    };
  }

  recommendPause(policy: ContributionPolicy): ContributionRecommendation | null {
    if (policy.status === "PAUSED") {
      return null;
    }

    if (policy.endDate && new Date(policy.endDate) < new Date()) {
      return {
        code: "PAUSE",
        message: "Policy end date has passed. Pause the policy to avoid stale executions.",
        priority: "HIGH",
      };
    }

    return null;
  }

  recommendCashProtection(policy: ContributionPolicy): ContributionRecommendation | null {
    if (policy.cashProtectionEnabled) {
      return null;
    }

    return {
      code: "ENABLE_CASH_PROTECTION",
      message: "Enable cash protection to reduce liquidity stress risk for recurring contributions.",
      priority: "HIGH",
    };
  }

  recommendGoalLink(policy: ContributionPolicy): ContributionRecommendation | null {
    if (policy.goalReference) {
      return null;
    }

    return {
      code: "LINK_GOAL",
      message: "Link this contribution policy to a goal to improve measurable outcome tracking.",
      priority: "MEDIUM",
    };
  }
}
