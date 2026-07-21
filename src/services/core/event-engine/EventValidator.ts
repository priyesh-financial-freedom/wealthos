import type { EventValidationIssue, EventValidationResult, FinancialEvent, FinancialEventCreateInput, FinancialEventStatus } from "@/types/financialEvent";

import { EventRepository } from "./EventRepository";

interface EventValidatorDependencies {
  repository?: Pick<EventRepository, "listEventsByDate" | "getAuthenticatedUser">;
}

const ALLOWED_STATUS_TRANSITIONS: Record<FinancialEventStatus, FinancialEventStatus[]> = {
  PENDING: ["SCHEDULED", "FAILED"],
  SCHEDULED: ["EXECUTED", "FAILED"],
  EXECUTED: [],
  FAILED: ["SCHEDULED"],
};

function pushIssue(list: EventValidationIssue[], issue: EventValidationIssue) {
  list.push(issue);
}

export class EventValidator {
  constructor(private readonly dependencies: EventValidatorDependencies = {}) {}

  private get repository(): Pick<EventRepository, "listEventsByDate" | "getAuthenticatedUser"> {
    return this.dependencies.repository ?? new EventRepository();
  }

  async validateCreateInput(input: FinancialEventCreateInput): Promise<EventValidationResult> {
    const errors: EventValidationIssue[] = [];
    const warnings: EventValidationIssue[] = [];

    this.validateRequiredFields(input, errors);
    this.validateBusinessRules(input, errors, warnings);
    this.validateDate(input.scheduledAt, "scheduledAt", errors);

    const duplicate = await this.detectDuplicate(input).catch(() => null);

    if (duplicate) {
      pushIssue(errors, {
        code: "DUPLICATE_EVENT",
        field: "correlationId",
        message: "An event with matching characteristics already exists for this scheduled date.",
        severity: "ERROR",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      duplicateOfEventId: duplicate?.id ?? null,
    };
  }

  validateStatusTransition(currentStatus: FinancialEventStatus, nextStatus: FinancialEventStatus): EventValidationResult {
    const errors: EventValidationIssue[] = [];
    const warnings: EventValidationIssue[] = [];

    if (!ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
      errors.push({
        code: "INVALID_STATUS_TRANSITION",
        field: "status",
        message: `Transition from ${currentStatus} to ${nextStatus} is not allowed.`,
        severity: "ERROR",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      duplicateOfEventId: null,
    };
  }

  async validateOwnership(event: FinancialEvent): Promise<EventValidationResult> {
    const errors: EventValidationIssue[] = [];
    const warnings: EventValidationIssue[] = [];

    const auth = await this.repository.getAuthenticatedUser();
    if (auth.user.id !== event.userId) {
      errors.push({
        code: "OWNERSHIP_MISMATCH",
        field: "userId",
        message: "Event does not belong to the authenticated user.",
        severity: "ERROR",
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      duplicateOfEventId: null,
    };
  }

  private validateRequiredFields(input: FinancialEventCreateInput, errors: EventValidationIssue[]) {
    if (!input.sourceType) {
      pushIssue(errors, { code: "REQUIRED", field: "sourceType", message: "sourceType is required.", severity: "ERROR" });
    }
    if (!input.sourceId) {
      pushIssue(errors, { code: "REQUIRED", field: "sourceId", message: "sourceId is required.", severity: "ERROR" });
    }
    if (!input.eventCategory) {
      pushIssue(errors, { code: "REQUIRED", field: "eventCategory", message: "eventCategory is required.", severity: "ERROR" });
    }
    if (!input.eventType) {
      pushIssue(errors, { code: "REQUIRED", field: "eventType", message: "eventType is required.", severity: "ERROR" });
    }
    if (!input.priority) {
      pushIssue(errors, { code: "REQUIRED", field: "priority", message: "priority is required.", severity: "ERROR" });
    }
    if (!input.scheduledAt) {
      pushIssue(errors, { code: "REQUIRED", field: "scheduledAt", message: "scheduledAt is required.", severity: "ERROR" });
    }
    if (!input.correlationId) {
      pushIssue(errors, { code: "REQUIRED", field: "correlationId", message: "correlationId is required.", severity: "ERROR" });
    }
  }

  private validateBusinessRules(input: FinancialEventCreateInput, errors: EventValidationIssue[], warnings: EventValidationIssue[]) {
    if (Number(input.amount) < 0) {
      pushIssue(errors, {
        code: "INVALID_AMOUNT",
        field: "amount",
        message: "amount cannot be negative.",
        severity: "ERROR",
      });
    }

    if (input.eventType === "SNAPSHOT" && Number(input.amount) !== 0) {
      pushIssue(warnings, {
        code: "SNAPSHOT_AMOUNT_NON_ZERO",
        field: "amount",
        message: "Snapshot events typically use a zero amount.",
        severity: "WARNING",
      });
    }

    if (!input.currency || input.currency.length < 3) {
      pushIssue(errors, {
        code: "INVALID_CURRENCY",
        field: "currency",
        message: "currency must be a valid ISO code.",
        severity: "ERROR",
      });
    }
  }

  private validateDate(value: string, field: string, errors: EventValidationIssue[]) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      pushIssue(errors, {
        code: "INVALID_DATE",
        field,
        message: `${field} must be a valid date.`,
        severity: "ERROR",
      });
      return;
    }

    if (parsed.getUTCFullYear() < 2000 || parsed.getUTCFullYear() > 2200) {
      pushIssue(errors, {
        code: "INVALID_DATE_RANGE",
        field,
        message: `${field} is outside the supported range.`,
        severity: "ERROR",
      });
    }
  }

  private async detectDuplicate(input: FinancialEventCreateInput): Promise<FinancialEvent | null> {
    const scheduled = new Date(input.scheduledAt);
    if (Number.isNaN(scheduled.getTime())) {
      return null;
    }

    const start = new Date(scheduled);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(scheduled);
    end.setUTCHours(23, 59, 59, 999);

    const sameDay = await this.repository.listEventsByDate(start.toISOString(), end.toISOString(), { limit: 2000 });
    return (
      sameDay.find((event) =>
        event.correlationId === input.correlationId ||
        (event.sourceType === input.sourceType &&
          event.sourceId === input.sourceId &&
          event.eventType === input.eventType &&
          event.scheduledAt === input.scheduledAt),
      ) ?? null
    );
  }
}
