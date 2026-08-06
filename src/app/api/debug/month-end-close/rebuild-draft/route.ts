import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMonthEndCloseServerService } from "@/services/monthEndClose/server";

const TARGET_DRAFT_CLOSE_ID = "f8df4b99-744f-4301-a6d4-e916df3abc78";

type CloseOwnershipRow = {
  id: string;
  user_id: string;
  status: "draft" | "closed";
};

const AUTH_REQUIRED_MESSAGE = "Authentication required. Please refresh and sign in again.";
const CLOSE_OWNERSHIP_MESSAGE = "This close does not belong to the current user.";
const DRAFT_ONLY_MESSAGE = "Only draft closes can be rebuilt.";

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unexpected server error.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const closeId = String((body as { closeId?: unknown }).closeId ?? "").trim();

    if (!closeId) {
      return NextResponse.json({ error: "closeId is required." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: AUTH_REQUIRED_MESSAGE }, { status: 401 });
    }

    // Temporary safety guard for this incident-specific rebuild.
    if (closeId !== TARGET_DRAFT_CLOSE_ID) {
      return NextResponse.json({ ok: false, error: CLOSE_OWNERSHIP_MESSAGE }, { status: 403 });
    }

    const { data: closeRowData, error: closeError } = await supabase
      .from("month_end_closes")
      .select("id,user_id,status")
      .eq("id", closeId)
      .maybeSingle();

    const closeRow = closeRowData as CloseOwnershipRow | null;

    if (closeError) {
      throw new Error(closeError.message || "Failed to validate close ownership.");
    }

    if (!closeRow || closeRow.user_id !== user.id) {
      return NextResponse.json({ ok: false, error: CLOSE_OWNERSHIP_MESSAGE }, { status: 403 });
    }

    if (closeRow.status !== "draft") {
      return NextResponse.json({ ok: false, error: DRAFT_ONLY_MESSAGE }, { status: 409 });
    }

    const service = createMonthEndCloseServerService();
    const result = await service.rebuildDraftCloseItemsFromCanonicalSources(closeId);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = safeErrorMessage(error);

    if (message.includes("Authentication required")) {
      return NextResponse.json({ ok: false, error: AUTH_REQUIRED_MESSAGE }, { status: 401 });
    }

    if (message.includes("Only draft month-end closes can be rebuilt")) {
      return NextResponse.json({ ok: false, error: DRAFT_ONLY_MESSAGE }, { status: 409 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: `Failed to rebuild draft close items. ${message}`,
      },
      { status: 500 },
    );
  }
}
