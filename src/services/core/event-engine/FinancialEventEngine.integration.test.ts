import { describe, expect, it, vi } from "vitest";

import { FinancialEventEngine } from "./FinancialEventEngine";

describe("FinancialEventEngine integration", () => {
  it("connects generation to execution", async () => {
    const createdEvents: Array<{ id: string; correlationId: string }> = [];

    const engine = new FinancialEventEngine({
      generator: {
        generate: vi.fn(async () => [
          {
            sourceType: "CONTRIBUTION_POLICY",
            sourceId: "policy-1",
            eventCategory: "INVESTMENT",
            eventType: "SIP",
            priority: "MEDIUM",
            frequency: "ONCE",
            startDate: "2026-07-01T00:00:00.000Z",
            endDate: "2026-07-01T00:00:00.000Z",
            amount: 1000,
            currency: "INR",
            metadata: {},
          },
        ]),
      } as never,
      validator: {
        validateCreateInput: vi.fn(async () => ({ valid: true, errors: [], warnings: [], duplicateOfEventId: null })),
      } as never,
      repository: {
        getAuthenticatedUser: vi.fn(async () => ({ user: { id: "user-1" } })),
        createEvent: vi.fn(async (input: { correlationId: string }) => {
          const event = {
            id: `event-${createdEvents.length + 1}`,
            userId: "user-1",
            sourceType: "CONTRIBUTION_POLICY",
            sourceId: "policy-1",
            eventCategory: "INVESTMENT",
            eventType: "SIP",
            priority: "MEDIUM",
            scheduledAt: "2026-07-01T00:00:00.000Z",
            executedAt: null,
            amount: 1000,
            currency: "INR",
            status: "PENDING",
            correlationId: input.correlationId,
            metadata: {},
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
          };
          createdEvents.push({ id: event.id, correlationId: event.correlationId });
          return event;
        }),
        updateEvent: vi.fn(async () => undefined),
        createExecutionLog: vi.fn(async () => undefined),
      } as never,
      executor: {
        execute: vi.fn(async () => ({ success: true, result: { code: "SIP_EXECUTED" }, warnings: [], errorMessage: null, retryable: false, idempotent: false })),
      } as never,
      bus: {
        registerDefaultSubscribers: vi.fn(),
        publish: vi.fn(async () => undefined),
      } as never,
      now: () => new Date("2026-07-05T00:00:00.000Z"),
    });

    const result = await engine.run();

    expect(result.generatedCount).toBe(1);
    expect(result.validatedCount).toBe(1);
    expect(result.executedCount).toBe(1);
    expect(createdEvents).toHaveLength(1);
  });
});
