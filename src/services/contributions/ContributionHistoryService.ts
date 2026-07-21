import { ContributionRepository } from "@/services/contributions/ContributionRepository";
import type { ContributionEvent, ContributionEventType, ContributionHistory, ContributionPolicy } from "@/types/contributionPolicy";

export class ContributionHistoryService {
  constructor(private readonly repository: ContributionRepository) {}

  async recordEvent(input: {
    policyId: string;
    eventType: ContributionEventType;
    payload?: Record<string, unknown>;
  }): Promise<ContributionEvent> {
    return this.repository.createEvent({
      policyId: input.policyId,
      eventType: input.eventType,
      payload: input.payload,
    });
  }

  async recordHistory(input: {
    policy: ContributionPolicy;
    changeType: ContributionHistory["changeType"];
    notes?: string | null;
  }): Promise<ContributionHistory> {
    return this.repository.createHistory({
      policyId: input.policy.id,
      changeType: input.changeType,
      notes: input.notes,
      snapshot: {
        id: input.policy.id,
        policyGroupId: input.policy.policyGroupId,
        name: input.policy.name,
        description: input.policy.description,
        targetAccount: input.policy.targetAccount,
        amount: input.policy.amount,
        currency: input.policy.currency,
        frequency: input.policy.frequency,
        startDate: input.policy.startDate,
        endDate: input.policy.endDate,
        growthStrategy: input.policy.growthStrategy,
        growthRate: input.policy.growthRate,
        growthAmount: input.policy.growthAmount,
        minLimitAmount: input.policy.minLimitAmount,
        maxLimitAmount: input.policy.maxLimitAmount,
        cashProtectionEnabled: input.policy.cashProtectionEnabled,
        goalReference: input.policy.goalReference,
        formulaExpression: input.policy.formulaExpression,
        formulaVariables: input.policy.formulaVariables,
        status: input.policy.status,
        updatedAt: input.policy.updatedAt,
      },
    });
  }

  async listEvents(policyId?: string): Promise<ContributionEvent[]> {
    return this.repository.listEvents(policyId);
  }

  async listHistory(policyId?: string): Promise<ContributionHistory[]> {
    return this.repository.listHistory(policyId);
  }
}
