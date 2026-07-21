export type ContributionFrequency = "MONTHLY" | "QUARTERLY" | "ANNUALLY";

export type ContributionGrowthStrategy = "FIXED" | "STEP_UP_PERCENTAGE" | "STEP_UP_AMOUNT";

export type ContributionPolicyStatus = "ACTIVE" | "PAUSED";

export interface ContributionPolicyGroup {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionPolicyGroupCreateInput {
  name: string;
  description?: string | null;
}

export type ContributionEventType =
  | "POLICY_CREATED"
  | "POLICY_UPDATED"
  | "POLICY_DUPLICATED"
  | "POLICY_PAUSED"
  | "POLICY_RESUMED"
  | "PREVIEW_GENERATED";

export interface ContributionPolicy {
  id: string;
  userId: string;
  policyGroupId: string | null;
  name: string;
  description: string | null;
  targetAccount: string | null;
  amount: number;
  currency: string;
  frequency: ContributionFrequency;
  startDate: string;
  endDate: string | null;
  growthStrategy: ContributionGrowthStrategy;
  growthRate: number | null;
  growthAmount: number | null;
  minLimitAmount: number | null;
  maxLimitAmount: number | null;
  cashProtectionEnabled: boolean;
  goalReference: string | null;
  formulaExpression: string | null;
  formulaVariables: Record<string, unknown> | null;
  status: ContributionPolicyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionPolicyCreateInput {
  policyGroupId?: string | null;
  name: string;
  description?: string | null;
  targetAccount?: string | null;
  amount: number;
  currency?: string;
  frequency: ContributionFrequency;
  startDate: string;
  endDate?: string | null;
  growthStrategy: ContributionGrowthStrategy;
  growthRate?: number | null;
  growthAmount?: number | null;
  minLimitAmount?: number | null;
  maxLimitAmount?: number | null;
  cashProtectionEnabled?: boolean;
  goalReference?: string | null;
  formulaExpression?: string | null;
  formulaVariables?: Record<string, unknown> | null;
}

export interface ContributionPolicyUpdateInput extends Partial<ContributionPolicyCreateInput> {
  id: string;
}

export interface ContributionEvent {
  id: string;
  userId: string;
  policyId: string;
  eventType: ContributionEventType;
  eventPayload: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionHistory {
  id: string;
  userId: string;
  policyId: string;
  changeType: Exclude<ContributionEventType, "PREVIEW_GENERATED">;
  snapshot: Record<string, unknown>;
  notes: string | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionPreviewItem {
  index: number;
  contributionDate: string;
  baseAmount: number;
  growthAmount: number;
  totalAmount: number;
}

export interface ContributionPreview {
  policyId: string;
  policyName: string;
  generatedAt: string;
  horizonMonths: number;
  projectedTotal: number;
  schedule: ContributionPreviewItem[];
}

export interface ContributionPolicyFilter {
  query?: string;
  status?: ContributionPolicyStatus | "ALL";
  frequency?: ContributionFrequency | "ALL";
  policyGroupId?: string | "ALL";
}

export interface ContributionPolicyHealthBreakdown {
  scheduleDefined: boolean;
  growthConfigured: boolean;
  limitsConfigured: boolean;
  cashProtectionEnabled: boolean;
  isActive: boolean;
  validationSuccessful: boolean;
  goalLinked: boolean;
  previewGenerationSuccessful: boolean;
}

export interface ContributionPolicyHealth {
  score: number;
  breakdown: ContributionPolicyHealthBreakdown;
}

export interface ContributionRecommendation {
  code: "INCREASE" | "PAUSE" | "ENABLE_CASH_PROTECTION" | "LINK_GOAL" | "NO_ACTION";
  message: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
}

export interface ContributionPolicyAnalysis {
  policyId: string;
  health: ContributionPolicyHealth;
  improvements: string[];
  recommendations: ContributionRecommendation[];
}

export interface ContributionTemplate {
  id: string;
  name: "Young Professional" | "High Income Executive" | "Early Retirement" | "Conservative Investor";
  description: string;
  policies: Array<{
    name: string;
    description: string;
    targetAccount: string;
    amount: number;
    frequency: ContributionFrequency;
    growthStrategy: ContributionGrowthStrategy;
    growthRate?: number | null;
    growthAmount?: number | null;
    cashProtectionEnabled?: boolean;
  }>;
}
