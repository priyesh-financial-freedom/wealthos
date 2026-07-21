import { ContributionRepository } from "@/services/contributions/ContributionRepository";
import type { ContributionPolicy } from "@/types/contributionPolicy";
import type { FinancialEventFrequency, FinancialEventSeed } from "@/types/financialEvent";

interface EventGeneratorDependencies {
  contributionRepository?: Pick<ContributionRepository, "listPolicies">;
  now?: () => Date;
}

function mapContributionFrequency(frequency: ContributionPolicy["frequency"]): FinancialEventFrequency {
  switch (frequency) {
    case "MONTHLY":
      return "MONTHLY";
    case "QUARTERLY":
      return "QUARTERLY";
    case "ANNUALLY":
      return "YEARLY";
    default:
      return "MONTHLY";
  }
}

function eventPriorityForContribution(policy: ContributionPolicy): FinancialEventSeed["priority"] {
  if (policy.amount >= 100000) {
    return "HIGH";
  }

  if (policy.amount <= 10000) {
    return "LOW";
  }

  return "MEDIUM";
}

function normalizeDateRange(dateFrom?: string, dateTo?: string, now = new Date()): { startDate: string; endDate: string } {
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 6, 0, 23, 59, 59, 999).toISOString();

  return {
    startDate: dateFrom ? new Date(dateFrom).toISOString() : defaultStart,
    endDate: dateTo ? new Date(dateTo).toISOString() : defaultEnd,
  };
}

export class EventGenerator {
  constructor(private readonly dependencies: EventGeneratorDependencies = {}) {}

  private get contributionRepository() {
    return this.dependencies.contributionRepository ?? new ContributionRepository();
  }

  private get now() {
    return this.dependencies.now ?? (() => new Date());
  }

  async generate(params: { dateFrom?: string; dateTo?: string } = {}): Promise<FinancialEventSeed[]> {
    const range = normalizeDateRange(params.dateFrom, params.dateTo, this.now());
    const [contributionSeeds, incomeSeeds, expenseSeeds, loanSeeds, insuranceSeeds, manualSeeds, systemSeeds] = await Promise.all([
      this.generateFromContributionPolicies(range),
      this.generateFromIncomePolicies(range),
      this.generateFromExpensePolicies(range),
      this.generateFromLoanPolicies(range),
      this.generateFromInsurancePolicies(range),
      this.generateFromManualActions(range),
      this.generateFromSystemActions(range),
    ]);

    return [
      ...contributionSeeds,
      ...incomeSeeds,
      ...expenseSeeds,
      ...loanSeeds,
      ...insuranceSeeds,
      ...manualSeeds,
      ...systemSeeds,
    ];
  }

  async generateFromContributionPolicies(range: { startDate: string; endDate: string }): Promise<FinancialEventSeed[]> {
    const policies = await this.contributionRepository.listPolicies();
    return policies
      .filter((policy) => policy.status === "ACTIVE")
      .map((policy) => ({
        sourceType: "CONTRIBUTION_POLICY" as const,
        sourceId: policy.id,
        eventCategory: "INVESTMENT" as const,
        eventType: "SIP" as const,
        priority: eventPriorityForContribution(policy),
        frequency: mapContributionFrequency(policy.frequency),
        startDate: new Date(Math.max(new Date(policy.startDate).getTime(), new Date(range.startDate).getTime())).toISOString(),
        endDate: policy.endDate ? new Date(Math.min(new Date(policy.endDate).getTime(), new Date(range.endDate).getTime())).toISOString() : range.endDate,
        amount: Number(policy.amount),
        currency: policy.currency,
        metadata: {
          policyName: policy.name,
          growthStrategy: policy.growthStrategy,
          targetAccount: policy.targetAccount,
        },
      }))
      .filter((seed) => new Date(seed.startDate).getTime() <= new Date(seed.endDate ?? seed.startDate).getTime());
  }

  async generateFromIncomePolicies(range: { startDate: string; endDate: string }): Promise<FinancialEventSeed[]> {
    void range;
    return [];
  }

  async generateFromExpensePolicies(range: { startDate: string; endDate: string }): Promise<FinancialEventSeed[]> {
    void range;
    return [];
  }

  async generateFromLoanPolicies(range: { startDate: string; endDate: string }): Promise<FinancialEventSeed[]> {
    void range;
    return [];
  }

  async generateFromInsurancePolicies(range: { startDate: string; endDate: string }): Promise<FinancialEventSeed[]> {
    void range;
    return [];
  }

  async generateFromManualActions(range: { startDate: string; endDate: string }): Promise<FinancialEventSeed[]> {
    void range;
    return [];
  }

  async generateFromSystemActions(range: { startDate: string; endDate: string }): Promise<FinancialEventSeed[]> {
    return [
      {
        sourceType: "SYSTEM",
        sourceId: "wealthos-snapshot-system",
        eventCategory: "SNAPSHOT",
        eventType: "SNAPSHOT",
        priority: "MEDIUM",
        frequency: "MONTHLY",
        startDate: range.startDate,
        endDate: range.endDate,
        amount: 0,
        currency: "INR",
        metadata: { reason: "monthly_projection_checkpoint" },
      },
    ];
  }
}
