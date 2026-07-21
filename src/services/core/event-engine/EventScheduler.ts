import type { FinancialEvent, FinancialEventCreateInput, FinancialEventSeed } from "@/types/financialEvent";

import { compareByDeterministicOrder, expandDates } from "./dateUtils";

function generateId() {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class EventScheduler {
  expandRecurringEvents(seeds: FinancialEventSeed[]): FinancialEventCreateInput[] {
    return seeds.flatMap((seed) => {
      const endDate = seed.endDate ?? seed.startDate;
      const schedule = expandDates({
        startDate: seed.startDate,
        endDate,
        frequency: seed.frequency,
      });

      return schedule.map((scheduledAt) => ({
        sourceType: seed.sourceType,
        sourceId: seed.sourceId,
        eventCategory: seed.eventCategory,
        eventType: seed.eventType,
        priority: seed.priority,
        scheduledAt,
        amount: seed.amount,
        currency: seed.currency ?? "INR",
        status: "SCHEDULED",
        correlationId: `${seed.sourceType}:${seed.sourceId}:${seed.eventType}:${scheduledAt}`,
        metadata: {
          ...(seed.metadata ?? {}),
          recurrenceFrequency: seed.frequency,
        },
      }));
    });
  }

  queueFutureEvents(events: FinancialEvent[], asOf = new Date()): FinancialEvent[] {
    const asOfTime = asOf.getTime();

    return [...events]
      .filter((event) => {
        const scheduledAt = new Date(event.scheduledAt).getTime();
        return scheduledAt >= asOfTime;
      })
      .sort(compareByDeterministicOrder);
  }

  deterministicOrder(events: FinancialEvent[]): FinancialEvent[] {
    return [...events].sort(compareByDeterministicOrder);
  }

  toTransientEvent(input: FinancialEventCreateInput, userId: string): FinancialEvent {
    const nowIso = new Date().toISOString();

    return {
      id: `transient-${generateId()}`,
      userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      eventCategory: input.eventCategory,
      eventType: input.eventType,
      priority: input.priority,
      scheduledAt: input.scheduledAt,
      executedAt: null,
      amount: input.amount,
      currency: input.currency ?? "INR",
      status: input.status ?? "PENDING",
      correlationId: input.correlationId,
      metadata: input.metadata ?? {},
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }
}
