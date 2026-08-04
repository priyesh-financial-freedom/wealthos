"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { ProjectionSnapshotSelector } from "@/components/planning/ProjectionSnapshotSelector";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { supabase } from "@/lib/supabase/client";
import type { ProjectionViewerFixedPlanResult } from "@/services/projection/ProjectionReadService";
import { fixedProjectionInputBuilder, fixedProjectionService, FIXED_PROJECTION_INPUT_BUILDER_DEFAULTS } from "@/services/projection";
import type { CreateFixedProjectionV1Input, FixedProjectionInputBuildResult, FixedProjectionPreviewResult } from "@/services/projection";

const FREEZE_CONFIRMATION_MESSAGE = "This will freeze Fixed Projection V1 as your benchmark plan. This should not be changed later except through a new version.";

interface FixedProjectionWorkflowDeps {
  buildInput: () => Promise<FixedProjectionInputBuildResult>;
  createPreview: (input: CreateFixedProjectionV1Input) => FixedProjectionPreviewResult;
  freezePreview: (preview: FixedProjectionPreviewResult) => Promise<unknown>;
  hasLockedProjection: () => Promise<boolean>;
  confirmFreeze: (message: string) => boolean;
}

interface FixedProjectionWorkflowProps {
  lockedProjection: ProjectionViewerFixedPlanResult | null;
  primaryCurrentAge: number | null;
  retirementAge: number | null;
  debtAnnualReturnPercent: number | null;
  deps?: FixedProjectionWorkflowDeps;
}

function formatProjectionValue(value: number | null) {
  if (value == null) {
    return "Data required";
  }

  return formatCurrency(value, { maximumFractionDigits: 0 });
}

function clampMonthKey(monthKey: string, start: string, end: string): string {
  if (monthKey < start) {
    return start;
  }

  if (monthKey > end) {
    return end;
  }

  return monthKey;
}

function toPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "Data required";
  }

  return `${value}%`;
}

async function hasLockedFixedProjection(): Promise<boolean> {
  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Authentication required.");
  }

  const { data, error } = await supabase
    .from("projection_plan_versions")
    .select("id")
    .eq("user_id", user.id)
    .eq("plan_kind", "FIXED")
    .eq("status", "LOCKED")
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data?.length ?? 0) > 0;
}

const defaultDeps: FixedProjectionWorkflowDeps = {
  buildInput: () => fixedProjectionInputBuilder.buildFixedProjectionInput(),
  createPreview: (input) => fixedProjectionService.createFixedProjectionPreview(input),
  freezePreview: (preview) => fixedProjectionService.freezeFixedProjectionV1Preview(preview),
  hasLockedProjection: hasLockedFixedProjection,
  confirmFreeze: (message) => window.confirm(message),
};

function AssumptionList({ entries }: { entries: Array<{ label: string; value: string }> }) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {entries.map((entry) => (
        <DashboardCard key={entry.label}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{entry.label}</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{entry.value}</p>
        </DashboardCard>
      ))}
    </section>
  );
}

export function FixedProjectionWorkflow({
  lockedProjection,
  primaryCurrentAge,
  retirementAge,
  debtAnnualReturnPercent,
  deps = defaultDeps,
}: FixedProjectionWorkflowProps) {
  const router = useRouter();
  const [buildResult, setBuildResult] = useState<FixedProjectionInputBuildResult | null>(null);
  const [previewResult, setPreviewResult] = useState<FixedProjectionPreviewResult | null>(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewAssumptions = previewResult?.input.assumptions ?? null;
  const previewRetirementMonth = previewAssumptions?.salary.retirementMonth ?? null;

  const previewSnapshotsByMonth = useMemo(() => {
    return new Map((previewResult?.monthSnapshots ?? []).map((snapshot) => [snapshot.month, snapshot]));
  }, [previewResult]);

  const retirementSnapshot = useMemo(() => {
    if (!previewResult) {
      return null;
    }

    if (!previewRetirementMonth) {
      return previewResult.monthSnapshots[0] ?? null;
    }

    const clampedMonth = clampMonthKey(previewRetirementMonth, previewResult.startMonth, previewResult.horizonEndMonth);
    return previewSnapshotsByMonth.get(clampedMonth) ?? previewResult.monthSnapshots[0] ?? null;
  }, [previewRetirementMonth, previewResult, previewSnapshotsByMonth]);

  const endSnapshot = previewResult?.monthSnapshots[previewResult.monthSnapshots.length - 1] ?? null;

  const monthlySurplusAtRetirement = retirementSnapshot?.monthly_income == null || retirementSnapshot?.monthly_expense == null
    ? null
    : retirementSnapshot.monthly_income - retirementSnapshot.monthly_expense;

  async function handleGeneratePreview() {
    setGeneratingPreview(true);
    setErrorMessage(null);

    try {
      const result = await deps.buildInput();
      setBuildResult(result);

      if (!result.validation.canPreview || !result.input) {
        setPreviewResult(null);
        return;
      }

      const preview = deps.createPreview(result.input);
      setPreviewResult(preview);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate preview.";
      setErrorMessage(message);
      setBuildResult(null);
      setPreviewResult(null);
    } finally {
      setGeneratingPreview(false);
    }
  }

  function handleDiscardPreview() {
    setBuildResult(null);
    setPreviewResult(null);
    setErrorMessage(null);
  }

  async function handleFreezePreview() {
    if (!buildResult?.validation.canFreeze || !previewResult) {
      return;
    }

    setFreezing(true);
    setErrorMessage(null);

    try {
      const alreadyLocked = await deps.hasLockedProjection();
      if (alreadyLocked) {
        setErrorMessage("A locked Fixed Projection already exists. Existing locked versions are read-only.");
        return;
      }

      const confirmed = deps.confirmFreeze(FREEZE_CONFIRMATION_MESSAGE);
      if (!confirmed) {
        return;
      }

      await deps.freezePreview(previewResult);
      setBuildResult(null);
      setPreviewResult(null);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to freeze preview.";
      setErrorMessage(message);
    } finally {
      setFreezing(false);
    }
  }

  if (lockedProjection) {
    return (
      <div className="space-y-6">
        <ProjectionSnapshotSelector
          monthSnapshots={lockedProjection.monthSnapshots}
          projectionStartMonth={lockedProjection.plan.start_month}
          projectionEndMonth={lockedProjection.plan.horizon_end_month}
          primaryCurrentAge={primaryCurrentAge}
          retirementAge={retirementAge}
        />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Plan Version</p>
            <p className="mt-2 text-base font-semibold text-slate-900">v{lockedProjection.plan.version_no}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start Month</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{lockedProjection.plan.start_month}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">End Month</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{lockedProjection.plan.horizon_end_month}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{lockedProjection.plan.status}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Last Generated</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{formatDate(lockedProjection.plan.locked_at ?? lockedProjection.plan.updated_at)}</p>
          </DashboardCard>
        </section>

        <ContentCard>
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Cash</th>
                  <th className="px-3 py-2">Mutual Funds</th>
                  <th className="px-3 py-2">Stocks</th>
                  <th className="px-3 py-2">EPF</th>
                  <th className="px-3 py-2">PPF</th>
                  <th className="px-3 py-2">NPS</th>
                  <th className="px-3 py-2">Financial Assets Total</th>
                  <th className="px-3 py-2">Non-Financial Assets Total</th>
                  <th className="px-3 py-2">Liabilities</th>
                  <th className="px-3 py-2">Net Worth</th>
                </tr>
              </thead>
              <tbody>
                {lockedProjection.monthRows.map((row) => (
                  <tr key={row.month} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{row.month}</td>
                    <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.cash)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.mutual_funds)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.stocks)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.epf)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.ppf)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.nps)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.financial_assets_total)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.non_financial_assets_total)}</td>
                    <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.liabilities)}</td>
                    <td className="px-3 py-2 text-slate-900">{formatProjectionValue(row.net_worth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContentCard>
      </div>
    );
  }

  if (!buildResult) {
    return (
      <ContentCard className="space-y-4">
        <EmptyState title="No Fixed Projection has been generated yet." description="Set assumptions before generating a preview." />
        {errorMessage ? <p className="text-sm font-medium text-rose-600">{errorMessage}</p> : null}
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={handleGeneratePreview} disabled={generatingPreview}>
            {generatingPreview ? "Generating Preview..." : "Generate Preview"}
          </Button>
        </div>
      </ContentCard>
    );
  }

  return (
    <div className="space-y-6">
      <ContentCard className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-amber-800">
            Preview Only - Not Frozen
          </span>
          <Button type="button" variant="outline" onClick={handleGeneratePreview} disabled={generatingPreview || freezing}>
            {generatingPreview ? "Regenerating..." : "Regenerate Preview"}
          </Button>
          <Button type="button" variant="outline" onClick={handleDiscardPreview} disabled={generatingPreview || freezing}>
            Discard Preview
          </Button>
          {buildResult.validation.canFreeze && previewResult ? (
            <Button type="button" onClick={handleFreezePreview} disabled={freezing || generatingPreview}>
              {freezing ? "Freezing..." : "Freeze Fixed Projection"}
            </Button>
          ) : null}
        </div>

        {errorMessage ? <p className="text-sm font-medium text-rose-600">{errorMessage}</p> : null}

        {buildResult.validation.blockers.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-700">Blockers</p>
            <ul className="space-y-1 text-sm text-rose-700">
              {buildResult.validation.blockers.map((blocker) => (
                <li key={blocker}>• {blocker}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {buildResult.validation.warnings.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-700">Warnings</p>
            <ul className="space-y-1 text-sm text-amber-700">
              {buildResult.validation.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {buildResult.validation.defaultsUsed.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Defaults Used</p>
            <ul className="space-y-1 text-sm text-slate-700">
              {buildResult.validation.defaultsUsed.map((defaultMessage) => (
                <li key={defaultMessage}>• {defaultMessage}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </ContentCard>

      <ContentCard>
        <h2 className="text-lg font-semibold text-slate-900">Source Report</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {buildResult.sourceReport.map((item) => (
                <tr key={`${item.fieldName}-${item.source}`} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{item.fieldName}</td>
                  <td className="px-3 py-2 text-slate-700">{item.source}</td>
                  <td className="px-3 py-2 text-slate-700">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentCard>

      {!previewResult ? null : (
        <>
          <ProjectionSnapshotSelector
            monthSnapshots={previewResult.monthSnapshots}
            projectionStartMonth={previewResult.startMonth}
            projectionEndMonth={previewResult.horizonEndMonth}
            primaryCurrentAge={primaryCurrentAge}
            retirementAge={retirementAge}
          />

          <AssumptionList
            entries={[
              { label: "Projection Start", value: previewResult.startMonth },
              { label: "Retirement Date", value: previewRetirementMonth ?? "Data required" },
              { label: "Projection End", value: previewResult.horizonEndMonth },
              { label: "Salary Growth %", value: toPercent(previewAssumptions?.salary.annualIncrementPercent) },
              { label: "Inflation %", value: toPercent(previewAssumptions?.expenses.annualExpenseInflationPercent) },
              { label: "Mutual Fund Return %", value: toPercent(previewAssumptions?.returns.mutualFundsAnnualReturnPercent) },
              { label: "Stocks Return %", value: toPercent(previewAssumptions?.returns.stocksAnnualReturnPercent) },
              { label: "EPF Return %", value: toPercent(previewAssumptions?.returns.epfAnnualReturnPercent) },
              { label: "PPF Return %", value: toPercent(previewAssumptions?.returns.ppfAnnualReturnPercent) },
              { label: "NPS Return %", value: toPercent(previewAssumptions?.returns.npsAnnualReturnPercent) },
              { label: "Cash Return %", value: toPercent(previewAssumptions?.returns.cashAnnualReturnPercent) },
              { label: "Debt / FD Return %", value: toPercent(debtAnnualReturnPercent) },
              {
                label: "Post-retirement Expense Reduction %",
                value: toPercent(previewAssumptions?.expenses.postRetirementExpenseReductionPercent),
              },
              {
                label: "NPS Lump Sum / Annuity Split",
                value: `${previewAssumptions?.npsSplitPolicy?.lumpsumPercent ?? 50}% / ${previewAssumptions?.npsSplitPolicy?.annuityPercent ?? 50}%`,
              },
              {
                label: "EPF to Cash after Retirement Policy",
                value: `Transfer after ${FIXED_PROJECTION_INPUT_BUILDER_DEFAULTS.epfTransferToCashAfterRetirementYears} years`,
              },
              {
                label: "Property Liquidation Policy",
                value: FIXED_PROJECTION_INPUT_BUILDER_DEFAULTS.propertyLiquidationAllowed ? "Allowed" : "Not allowed",
              },
            ]}
          />

          <AssumptionList
            entries={[
              { label: "Corpus at retirement", value: formatProjectionValue(retirementSnapshot?.financial_assets_total ?? null) },
              { label: "Net worth at retirement", value: formatProjectionValue(retirementSnapshot?.net_worth ?? null) },
              { label: "Net worth at projection end", value: formatProjectionValue(endSnapshot?.net_worth ?? null) },
              { label: "Retirement corpus at retirement", value: formatProjectionValue(retirementSnapshot?.retirement_corpus ?? null) },
              { label: "Total liabilities at retirement", value: formatProjectionValue(retirementSnapshot?.total_debt ?? null) },
              {
                label: "Property / Non-Financial Assets",
                value: formatProjectionValue(retirementSnapshot?.property_value ?? null),
              },
              {
                label: "Monthly Surplus / Shortfall",
                value: monthlySurplusAtRetirement == null
                  ? "Data required"
                  : formatCurrency(monthlySurplusAtRetirement, { maximumFractionDigits: 0 }),
              },
            ]}
          />

          <ContentCard>
            <div className="overflow-x-auto">
              <table className="min-w-[1200px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Cash</th>
                    <th className="px-3 py-2">Mutual Funds</th>
                    <th className="px-3 py-2">Stocks</th>
                    <th className="px-3 py-2">EPF</th>
                    <th className="px-3 py-2">PPF</th>
                    <th className="px-3 py-2">NPS</th>
                    <th className="px-3 py-2">Financial Assets Total</th>
                    <th className="px-3 py-2">Non-Financial Assets Total</th>
                    <th className="px-3 py-2">Liabilities</th>
                    <th className="px-3 py-2">Net Worth</th>
                  </tr>
                </thead>
                <tbody>
                  {previewResult.monthRows.map((row) => (
                    <tr key={row.month} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{row.month}</td>
                      <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.cash)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.mutual_funds)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.stocks)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.epf)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.ppf)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.nps)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.financial_assets_total)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.non_financial_assets_total)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatProjectionValue(row.liabilities)}</td>
                      <td className="px-3 py-2 text-slate-900">{formatProjectionValue(row.net_worth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ContentCard>
        </>
      )}
    </div>
  );
}
