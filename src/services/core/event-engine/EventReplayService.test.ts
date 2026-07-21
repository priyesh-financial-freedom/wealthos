import { describe, expect, it, vi } from "vitest";

import { EventReplayService } from "./EventReplayService";

describe("EventReplayService", () => {
  it("replays events in dry-run mode by default", async () => {
    const replay = new EventReplayService({
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
            scheduledAt: "2026-07-01T00:00:00.000Z",
            executedAt: null,
            amount: 1000,
            currency: "INR",
            status: "PENDING",
            correlationId: "corr-1",
            metadata: {},
            createdAt: "2026-07-01T00:00:00.000Z",
            updatedAt: "2026-07-01T00:00:00.000Z",
          },
        ]),
        updateEvent: vi.fn(),
        createExecutionLog: vi.fn(),
      } as never,
      executor: {
        execute: vi.fn(async () => ({
          success: true,
          result: { code: "SIP_EXECUTED" },
          warnings: [],
          errorMessage: null,
          retryable: false,
          idempotent: false,
        })),
      } as never,
    });

    const result = await replay.replay({
      dateFrom: "2026-07-01T00:00:00.000Z",
      dateTo: "2026-07-31T23:59:59.999Z",
    });

    expect(result.dryRun).toBe(true);
    expect(result.executed).toBe(1);
    expect(result.total).toBe(1);
  });
});
