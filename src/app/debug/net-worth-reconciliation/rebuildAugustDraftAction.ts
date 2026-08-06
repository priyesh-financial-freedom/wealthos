import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMonthEndCloseServerService } from "@/services/monthEndClose/server";

type CloseOwnershipRow = {
  id: string;
  user_id: string;
  status: "draft" | "closed";
};

const TARGET_DRAFT_CLOSE_ID = "f8df4b99-744f-4301-a6d4-e916df3abc78";
const CLOSED_JULY_CLOSE_ID = "c826b7f9-e0ab-4b31-96e3-6275a09e767c";

const AUTH_REQUIRED_MESSAGE = "Authentication required. Please refresh and sign in again.";
const CLOSE_OWNERSHIP_MESSAGE = "This close does not belong to the current user.";
const DRAFT_ONLY_MESSAGE = "Only draft closes can be rebuilt.";

function asCloseId(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unexpected server error.";
}

export type RebuildDraftActionState = {
  ok: boolean;
  status: number;
  error?: string;
  result?: {
    closeId: string;
    closeYear: number;
    closeMonth: number;
    status: "draft";
    beforeItemCount: number;
    afterItemCount: number;
    beforeTotals: {
      totalAssets: number;
      totalLiabilities: number;
      netWorth: number;
      totalsByKey: Record<string, number>;
    };
    afterTotals: {
      totalAssets: number;
      totalLiabilities: number;
      netWorth: number;
      totalsByKey: Record<string, number>;
    };
    beforeDuplicateGroups: Array<{
      groupKey: string;
      itemKey: string;
      entityName: string;
      rowCount: number;
      entityTypes: string[];
      entityIds: string[];
      totalActualValue: number;
    }>;
    afterDuplicateGroups: Array<{
      groupKey: string;
      itemKey: string;
      entityName: string;
      rowCount: number;
      entityTypes: string[];
      entityIds: string[];
      totalActualValue: number;
    }>;
    duplicateGroupsRemoved: Array<{
      groupKey: string;
      itemKey: string;
      entityName: string;
      rowCount: number;
      entityTypes: string[];
      entityIds: string[];
      totalActualValue: number;
    }>;
  };
};

export async function runRebuildAugustDraftAction(formData: FormData): Promise<RebuildDraftActionState> {
  try {
    const closeId = asCloseId(formData.get("closeId"));

    if (!closeId) {
      return {
        ok: false,
        status: 400,
        error: "closeId is required.",
      };
    }

    if (closeId === CLOSED_JULY_CLOSE_ID) {
      return {
        ok: false,
        status: 409,
        error: DRAFT_ONLY_MESSAGE,
      };
    }

    // Temporary safety guard for this incident-specific rebuild.
    if (closeId !== TARGET_DRAFT_CLOSE_ID) {
      return {
        ok: false,
        status: 403,
        error: CLOSE_OWNERSHIP_MESSAGE,
      };
    }

    const client = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      return {
        ok: false,
        status: 401,
        error: AUTH_REQUIRED_MESSAGE,
      };
    }

    const { data: closeRowData, error: closeError } = await client
      .from("month_end_closes")
      .select("id,user_id,status")
      .eq("id", closeId)
      .maybeSingle();

    const closeRow = closeRowData as CloseOwnershipRow | null;

    if (closeError) {
      throw new Error(closeError.message || "Failed to validate close ownership.");
    }

    if (!closeRow || closeRow.user_id !== user.id) {
      return {
        ok: false,
        status: 403,
        error: CLOSE_OWNERSHIP_MESSAGE,
      };
    }

    if (closeRow.status !== "draft") {
      return {
        ok: false,
        status: 409,
        error: DRAFT_ONLY_MESSAGE,
      };
    }

    const service = createMonthEndCloseServerService();
    const result = await service.rebuildDraftCloseItemsFromCanonicalSources(closeId);

    revalidatePath("/debug/net-worth-reconciliation");

    return {
      ok: true,
      status: 200,
      result,
    };
  } catch (error) {
    const message = safeErrorMessage(error);

    if (message.includes("Authentication required")) {
      return {
        ok: false,
        status: 401,
        error: AUTH_REQUIRED_MESSAGE,
      };
    }

    if (message.includes("Only draft month-end closes can be rebuilt")) {
      return {
        ok: false,
        status: 409,
        error: DRAFT_ONLY_MESSAGE,
      };
    }

    return {
      ok: false,
      status: 500,
      error: `Failed to rebuild draft close items. ${message}`,
    };
  }
}
