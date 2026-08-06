import { NextResponse } from "next/server";

import { createMonthEndCloseServerService } from "@/services/monthEndClose/server";

const TARGET_DRAFT_CLOSE_ID = "f8df4b99-744f-4301-a6d4-e916df3abc78";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const closeId = String((body as { closeId?: unknown }).closeId ?? "").trim();

    if (!closeId) {
      return NextResponse.json({ error: "closeId is required." }, { status: 400 });
    }

    // Temporary safety guard for this incident-specific rebuild.
    if (closeId !== TARGET_DRAFT_CLOSE_ID) {
      return NextResponse.json({ error: "This debug action is restricted to the incident close_id only." }, { status: 403 });
    }

    const service = createMonthEndCloseServerService();
    const result = await service.rebuildDraftCloseItemsFromCanonicalSources(closeId);

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rebuild draft close items.";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
