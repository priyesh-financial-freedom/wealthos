import { ContributionPreviewService } from "@/services/contributions/ContributionPreviewService";
import { ContributionValidationService } from "@/services/contributions/ContributionValidationService";
import type { ContributionPolicy, ContributionPolicyHealth } from "@/types/contributionPolicy";

export class ContributionPolicyHealthService {
  constructor(
    private readonly validationService = new ContributionValidationService(),
    private readonly previewService = new ContributionPreviewService(),
  ) {}

  calculateHealthScore(policy: ContributionPolicy): ContributionPolicyHealth {
    const validation = this.validationService.validateUpdate(policy, { id: policy.id });

    const scheduleDefined = Boolean(policy.startDate && policy.frequency);
    const growthConfigured =
      policy.growthStrategy === "FIXED" ||
      (policy.growthStrategy === "STEP_UP_PERCENTAGE" && policy.growthRate !== null) ||
      (policy.growthStrategy === "STEP_UP_AMOUNT" && policy.growthAmount !== null);
    const limitsConfigured = policy.minLimitAmount !== null || policy.maxLimitAmount !== null;
    const cashProtectionEnabled = policy.cashProtectionEnabled;
    const isActive = policy.status === "ACTIVE";
    const validationSuccessful = validation.isValid;
    const goalLinked = Boolean(policy.goalReference);

    let previewGenerationSuccessful = false;
    try {
      const preview = this.previewService.generate(policy, { horizonMonths: 12 });
      previewGenerationSuccessful = preview.schedule.length > 0;
    } catch {
      previewGenerationSuccessful = false;
    }

    let score = 0;
    if (scheduleDefined) {
      score += 15;
    }
    if (growthConfigured) {
      score += 15;
    }
    if (limitsConfigured) {
      score += 10;
    }
    if (cashProtectionEnabled) {
      score += 15;
    }
    if (isActive) {
      score += 15;
    }
    if (validationSuccessful) {
      score += 15;
    }
    if (goalLinked) {
      score += 5;
    }
    if (previewGenerationSuccessful) {
      score += 10;
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      breakdown: {
        scheduleDefined,
        growthConfigured,
        limitsConfigured,
        cashProtectionEnabled,
        isActive,
        validationSuccessful,
        goalLinked,
        previewGenerationSuccessful,
      },
    };
  }
}
