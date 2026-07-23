import { getBalanceSheetData } from "@/services/balanceSheet";
import { healthScoreService } from "@/services/health";
import { goalService } from "@/services/planning/goals";
import { planningScenarioService, createPlanningScenarioSimulationEngine } from "@/services/planning/scenarios";
import { monthlyReviewService } from "@/services/projection";
import type { MonthlyReviewWorkspace } from "@/services/projection";
import type { SimulationResult } from "@/services/simulation";

import { decisionRepository, DecisionRepository } from "./DecisionRepository";
import { evaluateDecisionRules } from "./DecisionRules";
import type { DecisionEngineContext, DecisionPriority, DecisionRecommendation } from "./DecisionTypes";

interface DecisionEngineDependencies {
  repository?: DecisionRepository;
  balanceSheetLoader?: typeof getBalanceSheetData;
  healthScoreLoader?: typeof healthScoreService.calculateHealthScore;
  goalsLoader?: typeof goalService.listGoals;
  scenarioLoader?: typeof planningScenarioService.listScenarios;
  scenarioSimulationLoader?: typeof planningScenarioService.runSimulation;
  monthlyReviewLoader?: (selectedCloseId?: string) => Promise<MonthlyReviewWorkspace | null>;
  baselineSimulationLoader?: () => Promise<SimulationResult>;
  now?: () => Date;
}

const PRIORITY_WEIGHT: Record<DecisionPriority, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

export class DecisionEngine {
  private readonly baselineSimulationEngine = createPlanningScenarioSimulationEngine();

  constructor(private readonly dependencies: DecisionEngineDependencies = {}) {}

  private get repository(): DecisionRepository {
    return this.dependencies.repository ?? decisionRepository;
  }

  private get now() {
    return this.dependencies.now ?? (() => new Date());
  }

  async generateRecommendations(): Promise<DecisionRecommendation[]> {
    const context = await this.buildContext();
    const generated = evaluateDecisionRules(context).map((rule) => ({
      id: rule.id,
      title: rule.title,
      category: rule.category,
      priority: rule.priority,
      severity: rule.severity,
      reason: rule.reason,
      recommendedAction: rule.recommendedAction,
      expectedBenefit: rule.expectedBenefit,
      confidence: rule.confidence,
      status: "Open" as const,
      createdAt: this.now().toISOString(),
    }));

    const persisted = await this.repository.listRecommendations().catch(() => []);
    const dismissedById = new Map(persisted.filter((item) => item.status === "Dismissed").map((item) => [item.id, item]));

    return this.prioritizeRecommendations(
      generated.map((recommendation) => {
        const dismissed = dismissedById.get(recommendation.id);
        if (!dismissed) {
          return recommendation;
        }

        return {
          ...recommendation,
          status: "Dismissed" as const,
          createdAt: dismissed.createdAt,
        };
      }),
    );
  }

  prioritizeRecommendations(recommendations: DecisionRecommendation[]): DecisionRecommendation[] {
    return [...recommendations].sort((left, right) => {
      const priorityDiff = PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority];
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const confidenceDiff = right.confidence - left.confidence;
      if (confidenceDiff !== 0) {
        return confidenceDiff;
      }

      return left.title.localeCompare(right.title);
    });
  }

  async dismissRecommendation(id: string): Promise<void> {
    await this.repository.updateStatus(id, "Dismissed");
  }

  async refreshRecommendations(): Promise<DecisionRecommendation[]> {
    const recommendations = await this.generateRecommendations();
    await this.repository.upsertRecommendations(recommendations);
    return recommendations;
  }

  private async buildContext(): Promise<DecisionEngineContext> {
    const [balanceSheet, goals, scenarios, monthlyReview, baselineSimulation] = await Promise.all([
      this.loadBalanceSheet(),
      this.loadGoals(),
      this.loadScenarios(),
      this.loadMonthlyReview(),
      this.loadBaselineSimulation(),
    ]);

    const activeScenario = scenarios.find((scenario) => scenario.is_active) ?? scenarios.find((scenario) => scenario.is_default) ?? null;
    const activeScenarioSimulation = activeScenario ? await this.loadScenarioSimulation(activeScenario.id).catch(() => null) : null;
    const healthScore = await this.loadHealthScore();

    return {
      healthScore,
      goals,
      scenarios,
      balanceSheetSummary: balanceSheet.summary,
      monthlyReview,
      activeScenarioSimulation,
      baselineSimulation,
    };
  }

  private async loadBalanceSheet() {
    return (this.dependencies.balanceSheetLoader ?? getBalanceSheetData)();
  }

  private async loadHealthScore() {
    return (this.dependencies.healthScoreLoader ?? healthScoreService.calculateHealthScore.bind(healthScoreService))();
  }

  private async loadGoals() {
    return (this.dependencies.goalsLoader ?? goalService.listGoals.bind(goalService))({ includeProgress: true });
  }

  private async loadScenarios() {
    return (this.dependencies.scenarioLoader ?? planningScenarioService.listScenarios.bind(planningScenarioService))();
  }

  private async loadScenarioSimulation(scenarioId: string) {
    return (this.dependencies.scenarioSimulationLoader ?? planningScenarioService.runSimulation.bind(planningScenarioService))(scenarioId);
  }

  private async loadMonthlyReview() {
    return (this.dependencies.monthlyReviewLoader ?? monthlyReviewService.getMonthlyReviewWorkspace.bind(monthlyReviewService))().catch(() => null);
  }

  private async loadBaselineSimulation() {
    if (this.dependencies.baselineSimulationLoader) {
      return this.dependencies.baselineSimulationLoader();
    }

    const outcome = await this.baselineSimulationEngine.run({ snapshotId: "decision-center" });
    if (!outcome.ok) {
      throw new Error(outcome.error.message);
    }

    return outcome.result;
  }
}

export const decisionEngine = new DecisionEngine();
