import { describe, expect, it } from "vitest";

import { EventScheduler } from "./EventScheduler";

describe("EventScheduler", () => {
  it("expands recurring events deterministically", () => {
    const scheduler = new EventScheduler();
    const rows = scheduler.expandRecurringEvents([
      {
        sourceType: "CONTRIBUTION_POLICY",
        sourceId: "policy-1",
        eventCategory: "INVESTMENT",
        eventType: "SIP",
        priority: "HIGH",
        frequency: "MONTHLY",
        startDate: "2026-01-01T00:00:00.000Z",
        endDate: "2026-03-31T23:59:59.999Z",
        amount: 1000,
      },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0].correlationId).toContain("policy-1");
  });

  it("orders events by priority then schedule", () => {
    const scheduler = new EventScheduler();
    const ordered = scheduler.deterministicOrder([
      {
        id: "2",
        userId: "u",
        sourceType: "SYSTEM",
        sourceId: "s",
        eventCategory: "SYSTEM",
        eventType: "SYSTEM_RECONCILIATION",
        priority: "LOW",
        scheduledAt: "2026-01-10T00:00:00.000Z",
        executedAt: null,
        amount: 0,
        currency: "INR",
        status: "PENDING",
        correlationId: "c2",
        metadata: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "1",
        userId: "u",
        sourceType: "SYSTEM",
        sourceId: "s",
        eventCategory: "SYSTEM",
        eventType: "SYSTEM_RECONCILIATION",
        priority: "CRITICAL",
        scheduledAt: "2026-01-11T00:00:00.000Z",
        executedAt: null,
        amount: 0,
        currency: "INR",
        status: "PENDING",
        correlationId: "c1",
        metadata: {},
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    expect(ordered[0].id).toBe("1");
  });
});
