import { ContributionHistoryService } from "@/services/contributions/ContributionHistoryService";
import { ContributionPolicyHealthService } from "@/services/contributions/ContributionPolicyHealthService";
import { ContributionPreviewService, type ContributionPreviewInput } from "@/services/contributions/ContributionPreviewService";
import { ContributionRecommendationService } from "@/services/contributions/ContributionRecommendationService";
import { ContributionRepository } from "@/services/contributions/ContributionRepository";
import { ContributionTemplateRepository } from "@/services/contributions/ContributionTemplateRepository";
import { ContributionValidationService } from "@/services/contributions/ContributionValidationService";
import type {
  ContributionHistory,
  ContributionPolicyAnalysis,
  ContributionPolicy,
  ContributionPolicyCreateInput,
  ContributionPolicyFilter,
  ContributionPolicyGroup,
  ContributionPolicyGroupCreateInput,
  ContributionPolicyUpdateInput,
  ContributionPreview,
  ContributionTemplate,
} from "@/types/contributionPolicy";

interface ContributionServiceDependencies {
  repository?: ContributionRepository;
  validationService?: ContributionValidationService;
  previewService?: ContributionPreviewService;
  historyService?: ContributionHistoryService;
  healthService?: ContributionPolicyHealthService;
  recommendationService?: ContributionRecommendationService;
  templateRepository?: ContributionTemplateRepository;
}

export class ContributionService {
  private readonly repository: ContributionRepository;
  private readonly validationService: ContributionValidationService;
  private readonly previewService: ContributionPreviewService;
  private readonly historyService: ContributionHistoryService;
  private readonly healthService: ContributionPolicyHealthService;
  private readonly recommendationService: ContributionRecommendationService;
  private readonly templateRepository: ContributionTemplateRepository;

  constructor(dependencies: ContributionServiceDependencies = {}) {
    this.repository = dependencies.repository ?? new ContributionRepository();
    this.validationService = dependencies.validationService ?? new ContributionValidationService();
    this.previewService = dependencies.previewService ?? new ContributionPreviewService();
    this.historyService = dependencies.historyService ?? new ContributionHistoryService(this.repository);
    this.healthService = dependencies.healthService ?? new ContributionPolicyHealthService(this.validationService, this.previewService);
    this.recommendationService = dependencies.recommendationService ?? new ContributionRecommendationService(this.healthService);
    this.templateRepository = dependencies.templateRepository ?? new ContributionTemplateRepository();
  }

  async listPolicies(filter: ContributionPolicyFilter = {}): Promise<ContributionPolicy[]> {
    const policies = await this.repository.listPolicies();
    const query = filter.query?.trim().toLowerCase() ?? "";

    return policies.filter((policy) => {
      const statusPass = !filter.status || filter.status === "ALL" || policy.status === filter.status;
      const frequencyPass = !filter.frequency || filter.frequency === "ALL" || policy.frequency === filter.frequency;
      const groupPass = !filter.policyGroupId || filter.policyGroupId === "ALL" || policy.policyGroupId === filter.policyGroupId;
      const queryPass =
        !query ||
        `${policy.name} ${policy.description ?? ""} ${policy.targetAccount ?? ""} ${policy.frequency} ${policy.status}`
          .toLowerCase()
          .includes(query);

      return statusPass && frequencyPass && groupPass && queryPass;
    });
  }

  async listPolicyGroups(): Promise<ContributionPolicyGroup[]> {
    return this.repository.listPolicyGroups();
  }

  async createPolicyGroup(input: ContributionPolicyGroupCreateInput): Promise<ContributionPolicyGroup> {
    if (!input.name.trim()) {
      throw new Error("Policy group name is required.");
    }

    return this.repository.createPolicyGroup({
      name: input.name.trim(),
      description: input.description ?? null,
    });
  }

  async getPolicy(policyId: string): Promise<ContributionPolicy> {
    const policy = await this.repository.getPolicy(policyId);
    if (!policy) {
      throw new Error("Contribution policy not found.");
    }

    return policy;
  }

  async createPolicy(input: ContributionPolicyCreateInput): Promise<ContributionPolicy> {
    const validation = this.validationService.validateCreate(input);
    if (!validation.isValid) {
      throw new Error(validation.issues.join(" "));
    }

    const policy = await this.repository.createPolicy(input);
    await this.historyService.recordEvent({ policyId: policy.id, eventType: "POLICY_CREATED", payload: { source: "service" } });
    await this.historyService.recordHistory({ policy, changeType: "POLICY_CREATED", notes: "Policy created" });
    return policy;
  }

  async updatePolicy(input: ContributionPolicyUpdateInput): Promise<ContributionPolicy> {
    const current = await this.getPolicy(input.id);
    const validation = this.validationService.validateUpdate(current, input);

    if (!validation.isValid) {
      throw new Error(validation.issues.join(" "));
    }

    const policy = await this.repository.updatePolicy(input);
    await this.historyService.recordEvent({
      policyId: policy.id,
      eventType: "POLICY_UPDATED",
      payload: { updatedFields: Object.keys(input).filter((key) => key !== "id") },
    });
    await this.historyService.recordHistory({ policy, changeType: "POLICY_UPDATED", notes: "Policy updated" });
    return policy;
  }

  async duplicatePolicy(policyId: string, name?: string): Promise<ContributionPolicy> {
    const source = await this.getPolicy(policyId);
    const duplicated = await this.createPolicy({
      name: name?.trim() || `${source.name} Copy`,
      description: source.description,
      targetAccount: source.targetAccount,
      amount: source.amount,
      currency: source.currency,
      frequency: source.frequency,
      startDate: source.startDate,
      endDate: source.endDate,
      growthStrategy: source.growthStrategy,
      growthRate: source.growthRate,
      growthAmount: source.growthAmount,
    });

    await this.historyService.recordEvent({
      policyId: duplicated.id,
      eventType: "POLICY_DUPLICATED",
      payload: { sourcePolicyId: source.id },
    });
    await this.historyService.recordHistory({
      policy: duplicated,
      changeType: "POLICY_DUPLICATED",
      notes: `Duplicated from ${source.name}`,
    });

    return duplicated;
  }

  async pausePolicy(policyId: string, reason?: string): Promise<ContributionPolicy> {
    const policy = await this.repository.updatePolicyStatus(policyId, "PAUSED");
    await this.historyService.recordEvent({
      policyId,
      eventType: "POLICY_PAUSED",
      payload: { reason: reason ?? null },
    });
    await this.historyService.recordHistory({ policy, changeType: "POLICY_PAUSED", notes: reason ?? "Policy paused" });
    return policy;
  }

  async resumePolicy(policyId: string): Promise<ContributionPolicy> {
    const policy = await this.repository.updatePolicyStatus(policyId, "ACTIVE");
    await this.historyService.recordEvent({ policyId, eventType: "POLICY_RESUMED" });
    await this.historyService.recordHistory({ policy, changeType: "POLICY_RESUMED", notes: "Policy resumed" });
    return policy;
  }

  async generatePreview(policyId: string, input: ContributionPreviewInput = {}): Promise<ContributionPreview> {
    const policy = await this.getPolicy(policyId);
    const preview = this.previewService.generate(policy, input);
    await this.historyService.recordEvent({
      policyId,
      eventType: "PREVIEW_GENERATED",
      payload: { horizonMonths: preview.horizonMonths, scheduleEntries: preview.schedule.length },
    });
    return preview;
  }

  async listPolicyEvents(policyId?: string) {
    return this.historyService.listEvents(policyId);
  }

  async listPolicyHistory(policyId?: string): Promise<ContributionHistory[]> {
    return this.historyService.listHistory(policyId);
  }

  async calculatePolicyHealthScore(policyId: string) {
    const policy = await this.getPolicy(policyId);
    return this.healthService.calculateHealthScore(policy);
  }

  async analysePolicy(policyId: string): Promise<ContributionPolicyAnalysis> {
    const policy = await this.getPolicy(policyId);
    return this.recommendationService.analysePolicy(policy);
  }

  async listTemplates(): Promise<ContributionTemplate[]> {
    return this.templateRepository.listTemplates();
  }
}
