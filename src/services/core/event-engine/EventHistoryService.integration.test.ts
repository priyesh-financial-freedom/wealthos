import { describe, expect, it, vi } from "vitest";

import { EventHistoryService } from "./EventHistoryService";

describe("EventHistoryService integration", () => {
  it("returns audit history with execution logs", async () => {
    const service = new EventHistoryService({
      repository: {
        listEvents: vi.fn(async () => ({
          rows: [
            {
              id: "event-1",
              userId: "user-1",
              sourceType: "SYSTEM",
              sourceId: "snapshot",
              eventCategory: "SNAPSHOT",
              eventType: "SNAPSHOT",
              priority: "MEDIUM",
              scheduledAt: "2026-07-01T00:00:00.000Z",
              executedAt: "2026-07-01T01:00:00.000Z",
              amount: 0,
              currency: "INR",
              status: "EXECUTED",
              correlationId: "snapshot:2026-07",
              metadata: {},
              createdAt: "2026-07-01T00:00:00.000Z",
              updatedAt: "2026-07-01T01:00:00.000Z",
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
        })),
        getExecutionHistory: vi.fn(async () => [
          {
            id: "exec-1",
            eventId: "event-1",
            executionStart: "2026-07-01T01:00:00.000Z",
            executionEnd: "2026-07-01T01:00:00.100Z",
            durationMs: 100,
            result: { code: "SNAPSHOT_CAPTURED" },
            warnings: [],
            errorMessage: null,
            retryCount: 0,
          },
        ]),
      } as never,
    });

    const audit = await service.getAuditHistory();
    expect(audit).toHaveLength(1);
    expect(audit[0].executions).toHaveLength(1);
  });
});
