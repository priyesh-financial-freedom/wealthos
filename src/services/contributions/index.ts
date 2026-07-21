import { ContributionHistoryService } from "@/services/contributions/ContributionHistoryService";
import { ContributionPolicyHealthService } from "@/services/contributions/ContributionPolicyHealthService";
import { ContributionPreviewService } from "@/services/contributions/ContributionPreviewService";
import { ContributionRecommendationService } from "@/services/contributions/ContributionRecommendationService";
import { ContributionRepository } from "@/services/contributions/ContributionRepository";
import { ContributionService } from "@/services/contributions/ContributionService";
import { ContributionTemplateRepository } from "@/services/contributions/ContributionTemplateRepository";
import { ContributionValidationService } from "@/services/contributions/ContributionValidationService";

const contributionRepository = new ContributionRepository();
const contributionValidationService = new ContributionValidationService();
const contributionPreviewService = new ContributionPreviewService();
const contributionHistoryService = new ContributionHistoryService(contributionRepository);
const contributionHealthService = new ContributionPolicyHealthService(contributionValidationService, contributionPreviewService);
const contributionRecommendationService = new ContributionRecommendationService(contributionHealthService);
const contributionTemplateRepository = new ContributionTemplateRepository();

export const contributionService = new ContributionService({
  repository: contributionRepository,
  validationService: contributionValidationService,
  previewService: contributionPreviewService,
  historyService: contributionHistoryService,
  healthService: contributionHealthService,
  recommendationService: contributionRecommendationService,
  templateRepository: contributionTemplateRepository,
});

export {
  ContributionRepository,
  ContributionService,
  ContributionValidationService,
  ContributionPreviewService,
  ContributionHistoryService,
  ContributionPolicyHealthService,
  ContributionRecommendationService,
  ContributionTemplateRepository,
};

export type {
  ContributionEvent,
  ContributionEventType,
  ContributionFrequency,
  ContributionGrowthStrategy,
  ContributionHistory,
  ContributionPolicy,
  ContributionPolicyCreateInput,
  ContributionPolicyFilter,
  ContributionPolicyGroup,
  ContributionPolicyGroupCreateInput,
  ContributionPolicyHealth,
  ContributionPolicyHealthBreakdown,
  ContributionPolicyAnalysis,
  ContributionRecommendation,
  ContributionPolicyStatus,
  ContributionPolicyUpdateInput,
  ContributionPreview,
  ContributionPreviewItem,
  ContributionTemplate,
} from "@/types/contributionPolicy";
