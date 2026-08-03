import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assumptionsService, DEFAULT_SCENARIO_KEY } from "@/services/assumptions";
import { getBalanceSheetData } from "@/services/balanceSheet";
import { createProjectionReadServerService } from "@/services/projection/ProjectionReadService";
import { getRetirementSummary } from "@/services/retirement";

type RetirementStatusLabel = "On Track" | "Needs Attention" | "Data required";

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

function toRetirementMonthKey(month: unknown, year: unknown): string | null {
  const monthValue = Number(month);
  const yearValue = Number(year);

  if (!Number.isInteger(monthValue) || monthValue < 1 || monthValue > 12) {
    return null;
  }

  if (!Number.isInteger(yearValue) || yearValue < 1900) {
    return null;
  }

  return `${yearValue}-${String(monthValue).padStart(2, "0")}`;
}

function toRetirementDateLabel(monthKey: string | null): string | null {
  if (!monthKey) {
    return null;
  }

  const [year, month] = monthKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function findExpectedCorpusAtMonth(
  monthRows: Array<{ month: string; financial_assets_total: number | null; net_worth: number | null }>,
  monthKey: string | null,
): number | null {
  if (!monthKey) {
    return null;
  }

  const monthRow = monthRows.find((row) => row.month === monthKey);
  if (!monthRow) {
    return null;
  }

  if (typeof monthRow.financial_assets_total === "number" && Number.isFinite(monthRow.financial_assets_total)) {
    return monthRow.financial_assets_total;
  }

  if (typeof monthRow.net_worth === "number" && Number.isFinite(monthRow.net_worth)) {
    return monthRow.net_worth;
  }

  return null;
}

function toFiniteNumberOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

export async function GET() {
  if (process.env.NODE_ENV !== "production") {
    console.info("[api/dashboard/retirement] route entered");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Authentication required.");
    }

    const projectionReadService = createProjectionReadServerService();

    const [retirementSummaryResult, balanceSheetResult, assumptionsResult, rollingResult, fixedResult] = await Promise.allSettled([
      getRetirementSummary(),
      getBalanceSheetData(),
      assumptionsService.getAssumptionsBundle(DEFAULT_SCENARIO_KEY),
      projectionReadService.getLatestLockedRollingProjection(),
      projectionReadService.getLatestLockedFixedProjection(),
    ]);

    if (process.env.NODE_ENV !== "production") {
      console.info(`[api/dashboard/retirement] retirement summary ${retirementSummaryResult.status === "fulfilled" ? "loaded" : "failed"}`);
      console.info(`[api/dashboard/retirement] balance sheet ${balanceSheetResult.status === "fulfilled" ? "loaded" : "failed"}`);
      console.info(`[api/dashboard/retirement] assumptions ${assumptionsResult.status === "fulfilled" ? "loaded" : "failed"}`);
    }

    const retirementSummary = retirementSummaryResult.status === "fulfilled" ? retirementSummaryResult.value : null;
    const balanceSheetData = balanceSheetResult.status === "fulfilled" ? balanceSheetResult.value : null;
    const assumptions = assumptionsResult.status === "fulfilled" ? assumptionsResult.value : null;
    const rolling = rollingResult.status === "fulfilled" ? rollingResult.value : null;
    const fixed = fixedResult.status === "fulfilled" ? fixedResult.value : null;

    const retirementMonthKey = toRetirementMonthKey(
      assumptions?.retirement?.salaryStopMonth,
      assumptions?.retirement?.salaryStopYear,
    );

    const rollingCorpusAtRetirement = findExpectedCorpusAtMonth(rolling?.monthRows ?? [], retirementMonthKey);
    const fixedCorpusAtRetirement = findExpectedCorpusAtMonth(fixed?.monthRows ?? [], retirementMonthKey);
    const expectedCorpusAtRetirement = rollingCorpusAtRetirement ?? fixedCorpusAtRetirement;

    if (process.env.NODE_ENV !== "production") {
      console.info(`[api/dashboard/retirement] rolling projection match ${rollingCorpusAtRetirement === null ? "not found" : "found"}`);
      console.info(`[api/dashboard/retirement] fixed projection fallback ${fixedCorpusAtRetirement === null ? "not found" : "found"}`);
    }

    const currentFromRetirementSummary = retirementSummary
      ? toFiniteNumberOrNull(Number(retirementSummary.totalRetirementAssets ?? 0))
      : null;
    const currentFromBalanceSheet = toFiniteNumberOrNull(balanceSheetData?.summary?.categoryTotals?.retirement);
    const currentRetirementCorpus = currentFromRetirementSummary ?? currentFromBalanceSheet;
    const hasCurrentCorpus = typeof currentRetirementCorpus === "number" && Number.isFinite(currentRetirementCorpus);
    const hasExpectedCorpus = typeof expectedCorpusAtRetirement === "number" && Number.isFinite(expectedCorpusAtRetirement);

    let statusLabel: RetirementStatusLabel = "Data required";
    if (hasCurrentCorpus && hasExpectedCorpus) {
      statusLabel = currentRetirementCorpus >= expectedCorpusAtRetirement ? "On Track" : "Needs Attention";
    }

    return NextResponse.json({
      currentRetirementCorpus,
      expectedCorpusAtRetirement,
      retirementDate: toRetirementDateLabel(retirementMonthKey),
      statusLabel,
      detail: "Expected corpus uses the latest locked rolling projection at retirement date. Fixed projection is used as fallback.",
    });
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
          message: status === 401 ? "Authentication required." : "Unable to load dashboard retirement summary.",
        },
      },
      { status },
    );
  }
}
