import { describe, expect, it, vi, beforeEach } from "vitest";

const TARGET_DRAFT_CLOSE_ID = "f8df4b99-744f-4301-a6d4-e916df3abc78";

const mockGetUser = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockCreateSupabaseServerClient = vi.fn();

const mockRebuildDraftCloseItemsFromCanonicalSources = vi.fn();
const mockCreateMonthEndCloseServerService = vi.fn(() => ({
  rebuildDraftCloseItemsFromCanonicalSources: mockRebuildDraftCloseItemsFromCanonicalSources,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

vi.mock("@/services/monthEndClose/server", () => ({
  createMonthEndCloseServerService: mockCreateMonthEndCloseServerService,
}));

function makeRequest(closeId: string) {
  return new Request("http://localhost/api/debug/month-end-close/rebuild-draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ closeId }),
  });
}

describe("POST /api/debug/month-end-close/rebuild-draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: mockGetUser,
      },
      from: mockFrom,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(makeRequest(TARGET_DRAFT_CLOSE_ID));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Authentication required. Please refresh and sign in again.");
    expect(mockRebuildDraftCloseItemsFromCanonicalSources).not.toHaveBeenCalled();
  });

  it("calls rebuild service for authenticated user and draft close", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: TARGET_DRAFT_CLOSE_ID,
        user_id: "user-1",
        status: "draft",
      },
      error: null,
    });

    mockRebuildDraftCloseItemsFromCanonicalSources.mockResolvedValue({
      closeId: TARGET_DRAFT_CLOSE_ID,
      closeYear: 2026,
      closeMonth: 8,
      status: "draft",
      beforeItemCount: 31,
      afterItemCount: 28,
      beforeTotals: {
        totalAssets: 100,
        totalLiabilities: 20,
        netWorth: 80,
        totalsByKey: {},
      },
      afterTotals: {
        totalAssets: 100,
        totalLiabilities: 20,
        netWorth: 80,
        totalsByKey: {},
      },
      beforeDuplicateGroups: [],
      afterDuplicateGroups: [],
      duplicateGroupsRemoved: [],
    });

    const { POST } = await import("./route");
    const response = await POST(makeRequest(TARGET_DRAFT_CLOSE_ID));

    expect(response.status).toBe(200);
    expect(mockRebuildDraftCloseItemsFromCanonicalSources).toHaveBeenCalledWith(TARGET_DRAFT_CLOSE_ID);
  });

  it("returns 403 when close does not belong to the current user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: TARGET_DRAFT_CLOSE_ID,
        user_id: "other-user",
        status: "draft",
      },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(makeRequest(TARGET_DRAFT_CLOSE_ID));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("This close does not belong to the current user.");
    expect(mockRebuildDraftCloseItemsFromCanonicalSources).not.toHaveBeenCalled();
  });

  it("returns 409 when close is not draft", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: TARGET_DRAFT_CLOSE_ID,
        user_id: "user-1",
        status: "closed",
      },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(makeRequest(TARGET_DRAFT_CLOSE_ID));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toBe("Only draft closes can be rebuilt.");
    expect(mockRebuildDraftCloseItemsFromCanonicalSources).not.toHaveBeenCalled();
  });

  it("returns rebuild summary with before/after counts and duplicate groups removed", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: TARGET_DRAFT_CLOSE_ID,
        user_id: "user-1",
        status: "draft",
      },
      error: null,
    });

    mockRebuildDraftCloseItemsFromCanonicalSources.mockResolvedValue({
      closeId: TARGET_DRAFT_CLOSE_ID,
      closeYear: 2026,
      closeMonth: 8,
      status: "draft",
      beforeItemCount: 42,
      afterItemCount: 38,
      beforeTotals: {
        totalAssets: 120000,
        totalLiabilities: 40000,
        netWorth: 80000,
        totalsByKey: {
          bank_accounts: 120000,
        },
      },
      afterTotals: {
        totalAssets: 118000,
        totalLiabilities: 40000,
        netWorth: 78000,
        totalsByKey: {
          bank_accounts: 118000,
        },
      },
      beforeDuplicateGroups: [
        {
          groupKey: "bank_accounts::Primary",
          itemKey: "bank_accounts",
          entityName: "Primary",
          rowCount: 2,
          entityTypes: ["bank-account"],
          entityIds: ["bank-legacy", "bank-live"],
          totalActualValue: 236000,
        },
      ],
      afterDuplicateGroups: [],
      duplicateGroupsRemoved: [
        {
          groupKey: "bank_accounts::Primary",
          itemKey: "bank_accounts",
          entityName: "Primary",
          rowCount: 2,
          entityTypes: ["bank-account"],
          entityIds: ["bank-legacy", "bank-live"],
          totalActualValue: 236000,
        },
      ],
    });

    const { POST } = await import("./route");
    const response = await POST(makeRequest(TARGET_DRAFT_CLOSE_ID));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.result.beforeItemCount).toBe(42);
    expect(payload.result.afterItemCount).toBe(38);
    expect(payload.result.duplicateGroupsRemoved).toHaveLength(1);
    expect(payload.result.duplicateGroupsRemoved[0].groupKey).toBe("bank_accounts::Primary");
  });
});
