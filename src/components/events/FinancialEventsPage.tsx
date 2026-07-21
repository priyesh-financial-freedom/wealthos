"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CircleAlert, CircleCheckBig, Clock3, RotateCcw } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataGrid, type DataGridColumn, type DataGridSortDirection } from "@/components/ui/data-grid";
import { DetailDialog, DetailGrid, DetailItem, DetailSection } from "@/components/ui/detail-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SummaryCard, SummaryCardGrid } from "@/components/ui/summary-cards";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { eventDashboardService } from "@/services/core/event-engine";
import type { FinancialEvent, FinancialEventCategory, FinancialEventExecution, FinancialEventFilters, FinancialEventStatus } from "@/types/financialEvent";

interface TimelineRow extends FinancialEvent {
  statusTone: "success" | "danger" | "warning" | "neutral";
}

type ReplayMode = "MONTH" | "YEAR" | "RANGE";

function toneForStatus(status: FinancialEventStatus): TimelineRow["statusTone"] {
  if (status === "EXECUTED") {
    return "success";
  }
  if (status === "FAILED") {
    return "danger";
  }
  if (status === "SCHEDULED") {
    return "warning";
  }
  return "neutral";
}

function statusClassName(tone: TimelineRow["statusTone"]): string {
  if (tone === "success") {
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  }
  if (tone === "danger") {
    return "bg-rose-100 text-rose-700 border border-rose-200";
  }
  if (tone === "warning") {
    return "bg-amber-100 text-amber-700 border border-amber-200";
  }

  return "bg-slate-100 text-slate-700 border border-slate-200";
}

function toIsoRange(mode: ReplayMode, month: string, year: string, dateFrom: string, dateTo: string): { dateFrom: string; dateTo: string } {
  if (mode === "MONTH") {
    const parsed = new Date(`${month}-01T00:00:00.000Z`);
    const start = new Date(parsed.getFullYear(), parsed.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0, 23, 59, 59, 999);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }

  if (mode === "YEAR") {
    const y = Number(year);
    const start = new Date(y, 0, 1, 0, 0, 0, 0);
    const end = new Date(y, 11, 31, 23, 59, 59, 999);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }

  return {
    dateFrom: new Date(dateFrom).toISOString(),
    dateTo: new Date(dateTo).toISOString(),
  };
}

export function FinancialEventsPage() {
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("scheduledAt");
  const [sortDirection, setSortDirection] = useState<DataGridSortDirection>("desc");
  const [filters, setFilters] = useState<FinancialEventFilters>({
    status: "ALL",
    category: "ALL",
    sourceType: "ALL",
  });
  const [summary, setSummary] = useState({
    pendingEvents: 0,
    executedToday: 0,
    failedEvents: 0,
    upcomingThisMonth: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<FinancialEvent | null>(null);
  const [executions, setExecutions] = useState<FinancialEventExecution[]>([]);

  const [replayOpen, setReplayOpen] = useState(false);
  const [replayMode, setReplayMode] = useState<ReplayMode>("MONTH");
  const [replayMonth, setReplayMonth] = useState(new Date().toISOString().slice(0, 7));
  const [replayYear, setReplayYear] = useState(String(new Date().getFullYear()));
  const [replayFrom, setReplayFrom] = useState(new Date().toISOString().slice(0, 10));
  const [replayTo, setReplayTo] = useState(new Date().toISOString().slice(0, 10));
  const [replayDryRun, setReplayDryRun] = useState(true);
  const [replayResult, setReplayResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const filterStatus = filters.status;
  const filterCategory = filters.category;
  const filterSourceType = filters.sourceType;

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const response = await eventDashboardService.getDashboard({
        filters: {
          status: filterStatus,
          category: filterCategory,
          sourceType: filterSourceType,
        },
          options: {
            page,
            pageSize,
          },
        });

        if (!mounted) {
          return;
        }

        const rows = response.timeline.rows.map((item) => ({
          ...item,
          statusTone: toneForStatus(item.status),
        }));

        setSummary(response.summary);
        setTimeline(rows);
        setTotal(response.timeline.total);
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load financial events dashboard.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      mounted = false;
    };
  }, [page, pageSize, filterStatus, filterCategory, filterSourceType]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const source = needle.length === 0
      ? timeline
      : timeline.filter((row) => `${row.eventType} ${row.sourceType} ${row.sourceId} ${row.eventCategory} ${row.status}`.toLowerCase().includes(needle));

    const sorted = [...source].sort((left, right) => {
      const leftValue = String((left as unknown as Record<string, unknown>)[sortKey] ?? "");
      const rightValue = String((right as unknown as Record<string, unknown>)[sortKey] ?? "");
      if (sortDirection === "asc") {
        return leftValue.localeCompare(rightValue);
      }
      return rightValue.localeCompare(leftValue);
    });

    return sorted;
  }, [timeline, search, sortKey, sortDirection]);

  async function openEventDetail(event: FinancialEvent) {
    setDetailOpen(true);
    setSelected(event);
    setExecutions([]);

    try {
      const details = await eventDashboardService.getEventDetail(event.id);
      setSelected(details.event ?? event);
      setExecutions(details.executions);
    } catch {
      setExecutions([]);
    }
  }

  async function runReplay() {
    try {
      setBusy(true);
      const range = toIsoRange(replayMode, replayMonth, replayYear, replayFrom, replayTo);
      const result = await eventDashboardService.replay({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        dryRun: replayDryRun,
        persistResults: !replayDryRun,
      });

      setReplayResult(`Replay complete: total ${result.total}, executed ${result.executed}, failed ${result.failed}.`);
      setPage(1);
    } catch (err) {
      setReplayResult(err instanceof Error ? err.message : "Replay failed.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Array<DataGridColumn<TimelineRow>> = [
    {
      key: "scheduledAt",
      header: "Scheduled",
      sortable: true,
      cell: (row) => <span className="font-medium text-slate-900">{formatDate(row.scheduledAt)}</span>,
    },
    {
      key: "eventType",
      header: "Event",
      sortable: true,
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.eventType}</p>
          <p className="text-xs text-slate-500">{row.eventCategory}</p>
        </div>
      ),
    },
    {
      key: "sourceType",
      header: "Source",
      sortable: true,
      cell: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.sourceType}</p>
          <p className="text-xs text-slate-500">{row.sourceId}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      cell: (row) => formatCurrency(row.amount),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (row) => <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClassName(row.statusTone)}`}>{row.status}</span>,
    },
  ];

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Financial Events"
            description="Core event timeline for planned financial activity with deterministic scheduling, execution history and replay."
          />
          <Button onClick={() => setReplayOpen(true)}>
            <RotateCcw className="h-4 w-4" />
            Replay
          </Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <SummaryCardGrid>
          <SummaryCard title="Pending Events" value={String(summary.pendingEvents)} icon={<Clock3 className="h-5 w-5" />} />
          <SummaryCard title="Executed Today" value={String(summary.executedToday)} tone="positive" icon={<CircleCheckBig className="h-5 w-5" />} />
          <SummaryCard title="Failed Events" value={String(summary.failedEvents)} tone="warning" icon={<CircleAlert className="h-5 w-5" />} />
          <SummaryCard title="Upcoming This Month" value={String(summary.upcomingThisMonth)} tone="dark" icon={<CalendarClock className="h-5 w-5" />} />
        </SummaryCardGrid>

        <DataGrid
          title="Timeline"
          description="Chronological event timeline with source, status and execution details."
          columns={columns}
          rows={filteredRows}
          getRowId={(row) => row.id}
          loading={loading}
          onRowClick={(row) => {
            void openEventDetail(row);
          }}
          emptyTitle="No events found"
          emptyDescription="Adjust filters or trigger generation to populate the timeline."
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search by type, category or source",
          }}
          filters={(
            <>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={filters.status ?? "ALL"}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as FinancialEventStatus | "ALL" }))}
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="EXECUTED">Executed</option>
                <option value="FAILED">Failed</option>
              </select>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={filters.category ?? "ALL"}
                onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value as FinancialEventCategory | "ALL" }))}
              >
                <option value="ALL">All categories</option>
                <option value="INCOME">Income</option>
                <option value="INVESTMENT">Investment</option>
                <option value="EXPENSE">Expense</option>
                <option value="LIABILITY">Liability</option>
                <option value="INSURANCE">Insurance</option>
                <option value="GOAL">Goal</option>
                <option value="SNAPSHOT">Snapshot</option>
                <option value="SYSTEM">System</option>
              </select>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={filters.sourceType ?? "ALL"}
                onChange={(event) => setFilters((current) => ({ ...current, sourceType: event.target.value as FinancialEventFilters["sourceType"] }))}
              >
                <option value="ALL">All sources</option>
                <option value="CONTRIBUTION_POLICY">Contribution Policy</option>
                <option value="INCOME_POLICY">Income Policy</option>
                <option value="EXPENSE_POLICY">Expense Policy</option>
                <option value="LOAN_POLICY">Loan Policy</option>
                <option value="INSURANCE_POLICY">Insurance Policy</option>
                <option value="MANUAL">Manual</option>
                <option value="SYSTEM">System</option>
              </select>
            </>
          )}
          sort={{
            key: sortKey,
            direction: sortDirection,
            onChange: (key, direction) => {
              setSortKey(key);
              setSortDirection(direction);
            },
          }}
          pagination={{
            page,
            pageSize,
            totalRows: total,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
            pageSizeOptions: [20, 50, 100],
          }}
          maxBodyHeightClassName="max-h-[540px]"
        />
      </PageContainer>

      <DetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={selected ? `${selected.eventType} Event` : "Event Detail"}
        description="Detailed event metadata and execution history."
      >
        {selected ? (
          <div className="space-y-6">
            <DetailGrid>
              <DetailItem label="Source" value={`${selected.sourceType} • ${selected.sourceId}`} />
              <DetailItem label="Policy / Source ID" value={selected.sourceId} />
              <DetailItem label="Amount" value={formatCurrency(selected.amount)} />
              <DetailItem label="Status" value={selected.status} />
            </DetailGrid>

            <DetailSection title="Metadata">
              <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                {JSON.stringify(selected.metadata, null, 2)}
              </pre>
            </DetailSection>

            <DetailSection title="Execution Log">
              {executions.length === 0 ? (
                <p className="text-sm text-slate-600">No execution log entries for this event.</p>
              ) : (
                <div className="space-y-2">
                  {executions.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-slate-900">{formatDate(entry.executionStart)}</p>
                        <p className="text-sm text-slate-600">{entry.durationMs} ms</p>
                      </div>
                      {entry.errorMessage ? <p className="mt-2 text-sm text-rose-700">{entry.errorMessage}</p> : null}
                      {entry.warnings.length > 0 ? <p className="mt-1 text-xs text-amber-700">{entry.warnings.join(" | ")}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </DetailSection>
          </div>
        ) : null}
      </DetailDialog>

      <Dialog open={replayOpen} onOpenChange={setReplayOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Replay Events</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Mode</label>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={replayMode}
                onChange={(event) => setReplayMode(event.target.value as ReplayMode)}
              >
                <option value="MONTH">Month</option>
                <option value="YEAR">Year</option>
                <option value="RANGE">Custom Range</option>
              </select>
            </div>

            {replayMode === "MONTH" ? (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Month</label>
                <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="month" value={replayMonth} onChange={(event) => setReplayMonth(event.target.value)} />
              </div>
            ) : null}

            {replayMode === "YEAR" ? (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Year</label>
                <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="number" min={2000} max={2200} value={replayYear} onChange={(event) => setReplayYear(event.target.value)} />
              </div>
            ) : null}

            {replayMode === "RANGE" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">From</label>
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={replayFrom} onChange={(event) => setReplayFrom(event.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium text-slate-700">To</label>
                  <input className="rounded-md border border-slate-300 px-3 py-2 text-sm" type="date" value={replayTo} onChange={(event) => setReplayTo(event.target.value)} />
                </div>
              </div>
            ) : null}

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={replayDryRun} onChange={(event) => setReplayDryRun(event.target.checked)} />
              Dry Run (default)
            </label>

            {replayResult ? <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{replayResult}</p> : null}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReplayOpen(false)} disabled={busy}>Close</Button>
              <Button onClick={() => void runReplay()} disabled={busy}>{busy ? "Running..." : "Run Replay"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
