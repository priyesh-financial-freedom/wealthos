import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const TARGET_DRAFT_CLOSE_ID = "f8df4b99-744f-4301-a6d4-e916df3abc78";
const CLOSED_JULY_CLOSE_ID = "c826b7f9-e0ab-4b31-96e3-6275a09e767c";

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

const INITIAL_STATE = {
  ok: false,
  status: 0,
};

let rebuildAugustDraftAction: (prevState: typeof INITIAL_STATE, formData: FormData) => Promise<{ ok: boolean; status: number; error?: string; result?: unknown }>;

describe("rebuildAugustDraftAction", () => {
  beforeAll(async () => {
    ({ rebuildAugustDraftAction } = await import("./page"));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockReset();
    mockMaybeSingle.mockReset();
    mockEq.mockReset();
    mockSelect.mockReset();
    mockFrom.mockReset();
    mockCreateSupabaseServerClient.mockReset();
    mockRebuildDraftCloseItemsFromCanonicalSources.mockReset();
    mockRevalidatePath.mockReset();

    mockEq.mockImplementation(() => ({ maybeSingle: mockMaybeSingle }));
    mockSelect.mockImplementation(() => ({ eq: mockEq }));
    mockFrom.mockImplementation(() => ({ select: mockSelect }));

    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });

    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

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

    const result = await rebuildAugustDraftAction(INITIAL_STATE, makeFormData(TARGET_DRAFT_CLOSE_ID));

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

    const result = await rebuildAugustDraftAction(INITIAL_STATE, makeFormData(TARGET_DRAFT_CLOSE_ID));

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

    const result = await rebuildAugustDraftAction(INITIAL_STATE, makeFormData(TARGET_DRAFT_CLOSE_ID));

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

    const result = await rebuildAugustDraftAction(INITIAL_STATE, makeFormData(TARGET_DRAFT_CLOSE_ID));

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

    const result = await rebuildAugustDraftAction(INITIAL_STATE, makeFormData(TARGET_DRAFT_CLOSE_ID));

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

    const result = await rebuildAugustDraftAction(INITIAL_STATE, makeFormData(TARGET_DRAFT_CLOSE_ID));

    expect(result.ok).toBe(true);
    expect(result.result?.afterDuplicateGroups).toHaveLength(0);
    expect(result.result?.duplicateGroupsRemoved).toHaveLength(1);
  });

  it("blocks July closed close id", async () => {
    const result = await rebuildAugustDraftAction(INITIAL_STATE, makeFormData(CLOSED_JULY_CLOSE_ID));

    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toBe("Only draft closes can be rebuilt.");
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
    expect(mockRebuildDraftCloseItemsFromCanonicalSources).not.toHaveBeenCalled();
  });

  it("uses form submission wiring and does not call fetch for rebuild", () => {
    const pageSource = readFileSync(resolve(process.cwd(), "src/app/debug/net-worth-reconciliation/page.tsx"), "utf8");
    const actionSource = readFileSync(resolve(process.cwd(), "src/app/debug/net-worth-reconciliation/RebuildDraftAction.tsx"), "utf8");

    expect(pageSource.includes('<RebuildDraftAction closeId={INCIDENT_CLOSE_ID} action={rebuildAugustDraftAction} />')).toBe(true);
    expect(actionSource.includes("<form action={formAction}>")).toBe(true);
    expect(actionSource.includes('name="closeId"')).toBe(true);
    expect(actionSource.includes("fetch(")).toBe(false);
  });
});
