"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { ContentCard } from "@/components/layout/ContentCard";
import { EmptyState } from "@/components/layout/EmptyState";
import { ProjectionSnapshotSelector } from "@/components/planning/ProjectionSnapshotSelector";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { supabase } from "@/lib/supabase/client";
import type { ProjectionViewerRollingPlanResult } from "@/services/projection/ProjectionReadService";
import { rollingProjectionService } from "@/services/projection";
import type { RollingProjectionPreviewResult } from "@/services/projection/RollingProjectionService";

const ROLLING_FREEZE_CONFIRMATION_MESSAGE = "This will freeze Rolling Projection V1 based on latest actuals and linked Fixed Projection V1.";

interface RollingProjectionWorkflowDeps {
  createPreview: () => Promise<RollingProjectionPreviewResult>;
  freezePreview: (preview: RollingProjectionPreviewResult) => Promise<unknown>;
  hasLockedProjection: () => Promise<boolean>;
  confirmFreeze: (message: string) => boolean;
}

interface RollingProjectionWorkflowProps {
  lockedProjection: ProjectionViewerRollingPlanResult | null;
  primaryCurrentAge: number | null;
  retirementAge: number | null;
  deps?: RollingProjectionWorkflowDeps;
}

function formatProjectionValue(value: number | null) {
  if (value == null) {
    return "Data required";
  }

  return formatCurrency(value, { maximumFractionDigits: 0 });
}

function toPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "Data required";
  }

  return `${value}%`;
}

async function hasLockedRollingProjection(): Promise<boolean> {
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
    .eq("plan_kind", "ROLLING")
    .eq("status", "LOCKED")
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  return (data?.length ?? 0) > 0;
}

const defaultDeps: RollingProjectionWorkflowDeps = {
  createPreview: () => rollingProjectionService.createRollingProjectionPreview({}),
  freezePreview: (preview) => rollingProjectionService.freezeRollingProjectionV1Preview(preview),
  hasLockedProjection: hasLockedRollingProjection,
  confirmFreeze: (message) => window.confirm(message),
};

export function RollingProjectionWorkflow({
  lockedProjection,
  primaryCurrentAge,
  retirementAge,
  deps = defaultDeps,
}: RollingProjectionWorkflowProps) {
  const router = useRouter();
  const [previewResult, setPreviewResult] = useState<RollingProjectionPreviewResult | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewSnapshotsByMonth = useMemo(() => {
    return new Map((previewResult?.monthSnapshots ?? []).map((snapshot) => [snapshot.month, snapshot]));
  }, [previewResult]);

  const previewRetirementMonth = previewResult?.assumptions.salary.retirementMonth ?? null;

  const retirementSnapshot = useMemo(() => {
    if (!previewResult) {
      return null;
    }

    if (!previewRetirementMonth) {
      return previewResult.monthSnapshots[0] ?? null;
    }

    return previewSnapshotsByMonth.get(previewRetirementMonth) ?? previewResult.monthSnapshots[0] ?? null;
  }, [previewResult, previewRetirementMonth, previewSnapshotsByMonth]);

  const endSnapshot = previewResult?.monthSnapshots[previewResult.monthSnapshots.length - 1] ?? null;

  async function handleGeneratePreview() {
    setGeneratingPreview(true);
    setErrorMessage(null);
    setBlockers([]);
    setWarnings([]);

    try {
      const preview = await deps.createPreview();
      setPreviewResult(preview);
      setWarnings(preview.validation.warnings);
      setBlockers(preview.validation.blockers);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to generate rolling preview.";
      setPreviewResult(null);
      setBlockers([message]);
    } finally {
      setGeneratingPreview(false);
    }
  }

  function handleDiscardPreview() {
    setPreviewResult(null);
    setErrorMessage(null);
    setBlockers([]);
    setWarnings([]);
  }

  async function handleFreezePreview() {
    if (!previewResult || !previewResult.canFreeze) {
      return;
    }

    setFreezing(true);
    setErrorMessage(null);

    try {
      const alreadyLocked = await deps.hasLockedProjection();
      if (alreadyLocked) {
        setErrorMessage("A locked Rolling Projection already exists. Existing locked versions are read-only.");
        return;
      }

      const confirmed = deps.confirmFreeze(ROLLING_FREEZE_CONFIRMATION_MESSAGE);
      if (!confirmed) {
        return;
      }

      await deps.freezePreview(previewResult);
      setPreviewResult(null);
      setBlockers([]);
      setWarnings([]);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to freeze rolling preview.";
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

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rolling Version</p>
            <p className="mt-2 text-base font-semibold text-slate-900">v{lockedProjection.plan.version_no}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Linked Fixed Plan</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{lockedProjection.linkedFixedVersionNo == null ? "Data required" : `v${lockedProjection.linkedFixedVersionNo}`}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rebased From Month</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{lockedProjection.rebasedFromMonth ?? "Data required"}</p>
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

  if (!previewResult) {
    return (
      <ContentCard className="space-y-4">
        <EmptyState
          title="No Rolling Projection is available yet."
          description="Close a monthly review and generate a rolling preview from latest actuals."
        />
        {errorMessage ? <p className="text-sm font-medium text-rose-600">{errorMessage}</p> : null}
        {blockers.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-700">Blockers</p>
            <ul className="space-y-1 text-sm text-rose-700">
              {blockers.map((blocker) => (
                <li key={blocker}>- {blocker}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={handleGeneratePreview} disabled={generatingPreview}>
            {generatingPreview ? "Generating Preview..." : "Generate Rolling Preview"}
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
          <Button type="button" onClick={handleFreezePreview} disabled={freezing || generatingPreview || !previewResult.canFreeze}>
            {freezing ? "Freezing..." : "Freeze Rolling Projection"}
          </Button>
        </div>

        {errorMessage ? <p className="text-sm font-medium text-rose-600">{errorMessage}</p> : null}

        {blockers.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-700">Blockers</p>
            <ul className="space-y-1 text-sm text-rose-700">
              {blockers.map((blocker) => (
                <li key={blocker}>- {blocker}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-700">Warnings</p>
            <ul className="space-y-1 text-sm text-amber-700">
              {warnings.map((warning) => (
                <li key={warning}>- {warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </ContentCard>

      <ProjectionSnapshotSelector
        monthSnapshots={previewResult.monthSnapshots}
        projectionStartMonth={previewResult.startMonth}
        projectionEndMonth={previewResult.horizonEndMonth}
        primaryCurrentAge={primaryCurrentAge}
        retirementAge={retirementAge}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rolling Version</p>
          <p className="mt-2 text-base font-semibold text-slate-900">v{previewResult.input.versionNo}</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Linked Fixed Plan</p>
          <p className="mt-2 text-base font-semibold text-slate-900">v{previewResult.linkedFixedVersionNo}</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Rebased From Month</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{previewResult.rebasedFromMonth}</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start Month</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{previewResult.startMonth}</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">End Month</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{previewResult.horizonEndMonth}</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Net Salary Handling</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{previewResult.assumptions.netSalaryIncludesEmployeeDeductions === false ? "Excludes deductions" : "Includes deductions"}</p>
        </DashboardCard>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Salary Growth %</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{toPercent(previewResult.assumptions.salary.annualIncrementPercent)}</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Inflation %</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{toPercent(previewResult.assumptions.expenses.annualExpenseInflationPercent)}</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">NPS Split</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{previewResult.assumptions.npsSplitPolicy?.lumpsumPercent ?? 50}% / {previewResult.assumptions.npsSplitPolicy?.annuityPercent ?? 50}%</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Retirement Corpus At Retirement</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{formatProjectionValue(retirementSnapshot?.retirement_corpus ?? null)}</p>
        </DashboardCard>
        <DashboardCard>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Net Worth At End</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{formatProjectionValue(endSnapshot?.net_worth ?? null)}</p>
        </DashboardCard>
      </section>

      <ContentCard>
        <h2 className="text-lg font-semibold text-slate-900">Actual Balances Used</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Bucket</th>
                <th className="px-3 py-2">Opening Balance</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(previewResult.openingBalances).map(([bucket, value]) => (
                <tr key={bucket} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{bucket}</td>
                  <td className="px-3 py-2 text-slate-700">{formatCurrency(value, { maximumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ContentCard>

      <ContentCard>
        <h2 className="text-lg font-semibold text-slate-900">Planned One-Time Outflows</h2>
        {previewResult.oneTimeOutflows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No one-time goals/events found for this preview.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Event Month</th>
                  <th className="px-3 py-2">Event Name</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {previewResult.oneTimeOutflows.map((outflow) => (
                  <tr key={`${outflow.id ?? outflow.name}-${outflow.month}-${outflow.amount}`} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{outflow.month}</td>
                    <td className="px-3 py-2 text-slate-700">{outflow.name}</td>
                    <td className="px-3 py-2 text-slate-700">{formatCurrency(outflow.amount, { maximumFractionDigits: 0 })}</td>
                    <td className="px-3 py-2 text-slate-700">{outflow.source ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ContentCard>

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
    </div>
  );
}
