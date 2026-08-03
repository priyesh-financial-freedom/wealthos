import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executiveDashboardService } from "@/services/dashboard";

function inferStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (message.includes("Authentication required")) {
    return 401;
  }

  if (message.includes("permission denied") || message.includes("forbidden")) {
    return 403;
  }

  return 500;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Authentication required.");
    }

    const data = await executiveDashboardService.getDashboardOptional();
    return NextResponse.json(data);
  } catch (error) {
    const status = inferStatus(error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          status,
          error: {
            message: errorMessage,
          },
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        error: {
          message: status === 401 ? "Authentication required." : "Unable to load dashboard optional widgets.",
        },
      },
      { status },
    );
  }
}