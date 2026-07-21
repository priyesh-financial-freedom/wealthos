export type FinancialEventSourceType =
  | "CONTRIBUTION_POLICY"
  | "INCOME_POLICY"
  | "EXPENSE_POLICY"
  | "LOAN_POLICY"
  | "INSURANCE_POLICY"
  | "MANUAL"
  | "SYSTEM";

export type FinancialEventCategory =
  | "INCOME"
  | "INVESTMENT"
  | "EXPENSE"
  | "LIABILITY"
  | "INSURANCE"
  | "GOAL"
  | "SNAPSHOT"
  | "SYSTEM";

export type FinancialEventType =
  | "SALARY"
  | "SIP"
  | "EMI"
  | "INSURANCE_PREMIUM"
  | "GOAL_FUNDING"
  | "SNAPSHOT"
  | "MANUAL_ADJUSTMENT"
  | "SYSTEM_RECONCILIATION";

export type FinancialEventPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type FinancialEventStatus = "PENDING" | "SCHEDULED" | "EXECUTED" | "FAILED";

export type FinancialEventFrequency = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "YEARLY";

export interface FinancialEvent {
  id: string;
  userId: string;
  sourceType: FinancialEventSourceType;
  sourceId: string;
  eventCategory: FinancialEventCategory;
  eventType: FinancialEventType;
  priority: FinancialEventPriority;
  scheduledAt: string;
  executedAt: string | null;
  amount: number;
  currency: string;
  status: FinancialEventStatus;
  correlationId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialEventExecution {
  id: string;
  eventId: string;
  executionStart: string;
  executionEnd: string;
  durationMs: number;
  result: Record<string, unknown>;
  warnings: string[];
  errorMessage: string | null;
  retryCount: number;
}

export interface FinancialEventCreateInput {
  sourceType: FinancialEventSourceType;
  sourceId: string;
  eventCategory: FinancialEventCategory;
  eventType: FinancialEventType;
  priority: FinancialEventPriority;
  scheduledAt: string;
  amount: number;
  currency?: string;
  status?: FinancialEventStatus;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

export interface FinancialEventUpdateInput {
  status?: FinancialEventStatus;
  executedAt?: string | null;
  metadata?: Record<string, unknown>;
  priority?: FinancialEventPriority;
  scheduledAt?: string;
}

export interface EventExecutionCreateInput {
  eventId: string;
  executionStart: string;
  executionEnd: string;
  durationMs: number;
  result: Record<string, unknown>;
  warnings?: string[];
  errorMessage?: string | null;
  retryCount?: number;
}

export interface FinancialEventSeed {
  sourceType: FinancialEventSourceType;
  sourceId: string;
  eventCategory: FinancialEventCategory;
  eventType: FinancialEventType;
  priority: FinancialEventPriority;
  frequency: FinancialEventFrequency;
  startDate: string;
  endDate?: string | null;
  amount: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface EventValidationIssue {
  code: string;
  message: string;
  field?: string;
  severity: "ERROR" | "WARNING";
}

export interface EventValidationResult {
  valid: boolean;
  errors: EventValidationIssue[];
  warnings: EventValidationIssue[];
  duplicateOfEventId: string | null;
}

export interface EventExecutionResult {
  success: boolean;
  result: Record<string, unknown>;
  warnings: string[];
  errorMessage: string | null;
  retryable: boolean;
  idempotent: boolean;
}

export interface FinancialEventFilters {
  status?: FinancialEventStatus | "ALL";
  category?: FinancialEventCategory | "ALL";
  sourceType?: FinancialEventSourceType | "ALL";
  dateFrom?: string;
  dateTo?: string;
}

export interface FinancialEventListOptions {
  page?: number;
  pageSize?: number;
}

export interface FinancialEventListResult {
  rows: FinancialEvent[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EventReplayRequest {
  dateFrom: string;
  dateTo: string;
  dryRun?: boolean;
  persistResults?: boolean;
  includeStatuses?: FinancialEventStatus[];
  onProgress?: (progress: { completed: number; total: number; eventId: string }) => void;
}

export interface EventReplayResult {
  dryRun: boolean;
  total: number;
  executed: number;
  failed: number;
  warnings: string[];
  executionLogs: FinancialEventExecution[];
}

export interface FinancialEventDashboardSummary {
  pendingEvents: number;
  executedToday: number;
  failedEvents: number;
  upcomingThisMonth: number;
}
