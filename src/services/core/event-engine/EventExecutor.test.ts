import { describe, expect, it } from "vitest";

import { EventExecutor } from "./EventExecutor";

describe("EventExecutor", () => {
  it("executes known handler", async () => {
    const executor = new EventExecutor();
    const result = await executor.execute({
      id: "event-1",
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
      status: "SCHEDULED",
      correlationId: "corr-1",
      metadata: {},
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
    expect(result.result.code).toBe("SIP_EXECUTED");
  });

  it("applies idempotent skip for executed events", async () => {
    const executor = new EventExecutor();
    const result = await executor.execute({
      id: "event-1",
      userId: "user-1",
      sourceType: "SYSTEM",
      sourceId: "system",
      eventCategory: "SYSTEM",
      eventType: "SYSTEM_RECONCILIATION",
      priority: "LOW",
      scheduledAt: "2026-07-01T00:00:00.000Z",
      executedAt: "2026-07-01T10:00:00.000Z",
      amount: 0,
      currency: "INR",
      status: "EXECUTED",
      correlationId: "corr-2",
      metadata: {},
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    expect(result.idempotent).toBe(true);
    expect(result.success).toBe(true);
  });
});
