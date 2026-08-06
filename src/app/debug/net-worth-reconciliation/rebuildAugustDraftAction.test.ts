import { beforeEach, describe, expect, it, vi } from "vitest";

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

const mockRevalidatePath = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

vi.mock("@/services/monthEndClose/server", () => ({
  createMonthEndCloseServerService: mockCreateMonthEndCloseServerService,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

function makeFormData(closeId: string) {
  const formData = new FormData();
  formData.set("closeId", closeId);
  return formData;
}

describe("runRebuildAugustDraftAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: mockGetUser,
      },
      from: mockFrom,
    });
  });

  it("blocks rebuild when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const { runRebuildAugustDraftAction } = await import("./rebuildAugustDraftAction");
    const result = await runRebuildAugustDraftAction(makeFormData(TARGET_DRAFT_CLOSE_ID));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("Authentication required. Please refresh and sign in again.");
    expect(mockRebuildDraftCloseItemsFromCanonicalSources).not.toHaveBeenCalled();
  });

  it("blocks rebuild when close belongs to another user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    mockMaybeSingle.mockResolvedValue({
      data: {
        id: TARGET_DRAFT_CLOSE_ID,
        user_id: "user-2",
        status: "draft",
      },
      error: null,
    });

    const { runRebuildAugustDraftAction } = await import("./rebuildAugustDraftAction");
    const result = await runRebuildAugustDraftAction(makeFormData(TARGET_DRAFT_CLOSE_ID));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("This close does not belong to the current user.");
    expect(mockRebuildDraftCloseItemsFromCanonicalSources).not.toHaveBeenCalled();
  });

  it("blocks rebuild when close is not draft", async () => {
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

    const { runRebuildAugustDraftAction } = await import("./rebuildAugustDraftAction");
    const result = await runRebuildAugustDraftAction(makeFormData(TARGET_DRAFT_CLOSE_ID));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toBe("Only draft closes can be rebuilt.");
    expect(mockRebuildDraftCloseItemsFromCanonicalSources).not.toHaveBeenCalled();
  });

  it("calls rebuild service for valid August draft close", async () => {
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

    const { runRebuildAugustDraftAction } = await import("./rebuildAugustDraftAction");
    const result = await runRebuildAugustDraftAction(makeFormData(TARGET_DRAFT_CLOSE_ID));

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(mockRebuildDraftCloseItemsFromCanonicalSources).toHaveBeenCalledWith(TARGET_DRAFT_CLOSE_ID);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/debug/net-worth-reconciliation");
  });

  it("returns before and after item counts in action result", async () => {
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
        totalAssets: 500,
        totalLiabilities: 100,
        netWorth: 400,
        totalsByKey: {},
      },
      afterTotals: {
        totalAssets: 500,
        totalLiabilities: 100,
        netWorth: 400,
        totalsByKey: {},
      },
      beforeDuplicateGroups: [],
      afterDuplicateGroups: [],
      duplicateGroupsRemoved: [],
    });

    const { runRebuildAugustDraftAction } = await import("./rebuildAugustDraftAction");
    const result = await runRebuildAugustDraftAction(makeFormData(TARGET_DRAFT_CLOSE_ID));

    expect(result.ok).toBe(true);
    expect(result.result?.beforeItemCount).toBe(31);
    expect(result.result?.afterItemCount).toBe(28);
  });

  it("returns clean duplicate verification groups from rebuild fixture", async () => {
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
        totalsByKey: {},
      },
      afterTotals: {
        totalAssets: 118000,
        totalLiabilities: 40000,
        netWorth: 78000,
        totalsByKey: {},
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

    const { runRebuildAugustDraftAction } = await import("./rebuildAugustDraftAction");
    const result = await runRebuildAugustDraftAction(makeFormData(TARGET_DRAFT_CLOSE_ID));

    expect(result.ok).toBe(true);
    expect(result.result?.afterDuplicateGroups).toHaveLength(0);
    expect(result.result?.duplicateGroupsRemoved).toHaveLength(1);
  });
});
