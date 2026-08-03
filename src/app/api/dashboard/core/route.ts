import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executiveDashboardService } from "@/services/dashboard";

type DashboardCorePhase = "route entered" | "auth/session resolve" | "getDashboardCore started" | "getDashboardCore completed";

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
  let phase: DashboardCorePhase = "route entered";

  if (process.env.NODE_ENV !== "production") {
    console.info("[api/dashboard/core] route entered");
  }

  try {
    phase = "auth/session resolve";
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[api/dashboard/core] auth/session failed");
      }
      throw new Error("Authentication required.");
    }

    if (process.env.NODE_ENV !== "production") {
      console.info("[api/dashboard/core] auth/session resolved");
    }

    phase = "getDashboardCore started";
    if (process.env.NODE_ENV !== "production") {
      console.info("[api/dashboard/core] getDashboardCore started");
    }

    const data = await executiveDashboardService.getDashboardCore();

    phase = "getDashboardCore completed";
    if (process.env.NODE_ENV !== "production") {
      console.info("[api/dashboard/core] getDashboardCore completed");
    }

    return NextResponse.json(data);
  } catch (error) {
    const status = inferStatus(error);
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (process.env.NODE_ENV !== "production") {
      console.error("[api/dashboard/core] error", {
        phase,
        name: errorName,
        message: errorMessage,
      });

      return NextResponse.json(
        {
          status,
          error: {
            name: errorName,
            message: errorMessage,
            phase,
          },
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        error: {
          message: status === 401 ? "Authentication required." : "Unable to load dashboard core.",
        },
      },
      { status },
    );
  }
}