import type { EventExecutionResult, EventValidationResult, FinancialEvent, FinancialEventType } from "@/types/financialEvent";

export interface EventHandler {
  supports(eventType: string): boolean;
  validate(event: FinancialEvent): EventValidationResult;
  execute(event: FinancialEvent): Promise<EventExecutionResult>;
}

function validResult(): EventValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
    duplicateOfEventId: null,
  };
}

function successResult(event: FinancialEvent, code: string): EventExecutionResult {
  return {
    success: true,
    result: {
      code,
      eventId: event.id,
      amount: event.amount,
      executedAt: new Date().toISOString(),
    },
    warnings: [],
    errorMessage: null,
    retryable: false,
    idempotent: false,
  };
}

class SalaryEventHandler implements EventHandler {
  supports(eventType: string): boolean {
    return eventType === "SALARY";
  }

  validate(event: FinancialEvent): EventValidationResult {
    void event;
    return validResult();
  }

  async execute(event: FinancialEvent): Promise<EventExecutionResult> {
    return successResult(event, "SALARY_CREDITED");
  }
}

class SipEventHandler implements EventHandler {
  supports(eventType: string): boolean {
    return eventType === "SIP";
  }

  validate(event: FinancialEvent): EventValidationResult {
    void event;
    return validResult();
  }

  async execute(event: FinancialEvent): Promise<EventExecutionResult> {
    return successResult(event, "SIP_EXECUTED");
  }
}

class EmiEventHandler implements EventHandler {
  supports(eventType: string): boolean {
    return eventType === "EMI";
  }

  validate(event: FinancialEvent): EventValidationResult {
    void event;
    return validResult();
  }

  async execute(event: FinancialEvent): Promise<EventExecutionResult> {
    return successResult(event, "EMI_DEBITED");
  }
}

class InsuranceEventHandler implements EventHandler {
  supports(eventType: string): boolean {
    return eventType === "INSURANCE_PREMIUM";
  }

  validate(event: FinancialEvent): EventValidationResult {
    void event;
    return validResult();
  }

  async execute(event: FinancialEvent): Promise<EventExecutionResult> {
    return successResult(event, "INSURANCE_PREMIUM_PAID");
  }
}

class GoalFundingEventHandler implements EventHandler {
  supports(eventType: string): boolean {
    return eventType === "GOAL_FUNDING";
  }

  validate(event: FinancialEvent): EventValidationResult {
    void event;
    return validResult();
  }

  async execute(event: FinancialEvent): Promise<EventExecutionResult> {
    return successResult(event, "GOAL_FUNDED");
  }
}

class SnapshotEventHandler implements EventHandler {
  supports(eventType: string): boolean {
    return eventType === "SNAPSHOT";
  }

  validate(event: FinancialEvent): EventValidationResult {
    void event;
    return validResult();
  }

  async execute(event: FinancialEvent): Promise<EventExecutionResult> {
    return successResult(event, "SNAPSHOT_CAPTURED");
  }
}

class FutureReadyStubHandler implements EventHandler {
  supports(eventType: string): boolean {
    void eventType;
    return true;
  }

  validate(event: FinancialEvent): EventValidationResult {
    void event;
    return validResult();
  }

  async execute(event: FinancialEvent): Promise<EventExecutionResult> {
    return {
      success: true,
      result: {
        code: "FUTURE_HANDLER_STUB_EXECUTED",
        eventType: event.eventType,
      },
      warnings: [`Event type ${event.eventType} is handled by the default stub handler.`],
      errorMessage: null,
      retryable: false,
      idempotent: false,
    };
  }
}

export class EventExecutor {
  private readonly handlers: EventHandler[];

  constructor(handlers?: EventHandler[]) {
    this.handlers = handlers ?? [
      new SalaryEventHandler(),
      new SipEventHandler(),
      new EmiEventHandler(),
      new InsuranceEventHandler(),
      new GoalFundingEventHandler(),
      new SnapshotEventHandler(),
      new FutureReadyStubHandler(),
    ];
  }

  resolveHandler(eventType: FinancialEventType): EventHandler {
    const found = this.handlers.find((handler) => handler.supports(eventType));
    if (!found) {
      throw new Error(`No handler registered for event type ${eventType}.`);
    }
    return found;
  }

  async execute(event: FinancialEvent): Promise<EventExecutionResult> {
    if (event.status === "EXECUTED") {
      return {
        success: true,
        result: {
          code: "IDEMPOTENT_SKIP",
          eventId: event.id,
        },
        warnings: ["Event already executed. Idempotent skip applied."],
        errorMessage: null,
        retryable: false,
        idempotent: true,
      };
    }

    const handler = this.resolveHandler(event.eventType);
    const validation = handler.validate(event);
    if (!validation.valid) {
      return {
        success: false,
        result: {
          code: "HANDLER_VALIDATION_FAILED",
          issues: validation.errors,
        },
        warnings: validation.warnings.map((warning) => warning.message),
        errorMessage: validation.errors[0]?.message ?? "Validation failed.",
        retryable: false,
        idempotent: false,
      };
    }

    return handler.execute(event);
  }
}
