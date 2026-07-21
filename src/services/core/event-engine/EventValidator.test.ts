import { describe, expect, it, vi } from "vitest";

import { EventValidator } from "./EventValidator";

describe("EventValidator", () => {
  it("rejects missing required fields", async () => {
    const validator = new EventValidator({
      repository: {
        listEventsByDate: vi.fn(async () => []),
        getAuthenticatedUser: vi.fn(async () => ({ user: { id: "user-1" } })),
      } as never,
    });

    const result = await validator.validateCreateInput({
      sourceType: "SYSTEM",
      sourceId: "",
      eventCategory: "SYSTEM",
      eventType: "SYSTEM_RECONCILIATION",
      priority: "MEDIUM",
      scheduledAt: "invalid",
      amount: -1,
      currency: "IN",
      correlationId: "",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("detects duplicate events", async () => {
    const validator = new EventValidator({
      repository: {
        listEventsByDate: vi.fn(async () => [
          {
            id: "event-1",
            userId: "user-1",
            sourceType: "CONTRIBUTION_POLICY",
            sourceId: "policy-1",
            eventCategory: "INVESTMENT",
            eventType: "SIP",
            priority: "MEDIUM",
            scheduledAt: "2026-07-15T00:00:00.000Z",
            executedAt: null,
            amount: 1000,
            currency: "INR",
            status: "PENDING",
            correlationId: "x",
            metadata: {},
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ]),
        getAuthenticatedUser: vi.fn(async () => ({ user: { id: "user-1" } })),
      } as never,
    });

    const result = await validator.validateCreateInput({
      sourceType: "CONTRIBUTION_POLICY",
      sourceId: "policy-1",
      eventCategory: "INVESTMENT",
      eventType: "SIP",
      priority: "MEDIUM",
      scheduledAt: "2026-07-15T00:00:00.000Z",
      amount: 1000,
      currency: "INR",
      correlationId: "x",
      metadata: {},
    });

    expect(result.valid).toBe(false);
    expect(result.duplicateOfEventId).toBe("event-1");
  });
});
