"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DataGrid, type DataGridColumn, type DataGridSortDirection } from "@/components/ui/data-grid";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { decisionEngine, type DecisionRecommendation } from "@/services/decision";

function badgeForPriority(priority: DecisionRecommendation["priority"]) {
  switch (priority) {
    case "Critical":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "High":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Medium":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Low":
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}

export default function DecisionCenterPage() {
  const [recommendations, setRecommendations] = useState<DecisionRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("priority");
  const [sortDirection, setSortDirection] = useState<DataGridSortDirection>("desc");
  const [selected, setSelected] = useState<DecisionRecommendation | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const next = await decisionEngine.refreshRecommendations();
      setRecommendations(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load decision recommendations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const summary = useMemo(() => ({
    Critical: recommendations.filter((item) => item.priority === "Critical" && item.status === "Open").length,
    High: recommendations.filter((item) => item.priority === "High" && item.status === "Open").length,
    Medium: recommendations.filter((item) => item.priority === "Medium" && item.status === "Open").length,
    Low: recommendations.filter((item) => item.priority === "Low" && item.status === "Open").length,
  }), [recommendations]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const list = recommendations.filter((item) => {
      const matchesQuery = !normalizedQuery || `${item.title} ${item.category} ${item.reason} ${item.recommendedAction}`.toLowerCase().includes(normalizedQuery);
      const matchesPriority = priorityFilter === "all" || item.priority === priorityFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesQuery && matchesPriority && matchesStatus;
    });

    const priorityWeight = { Critical: 4, High: 3, Medium: 2, Low: 1 } as const;

    return [...list].sort((left, right) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "priority") {
        return (priorityWeight[left.priority] - priorityWeight[right.priority]) * multiplier;
      }

      if (sortKey === "confidence") {
        return (left.confidence - right.confidence) * multiplier;
      }

      if (sortKey === "status") {
        return left.status.localeCompare(right.status) * multiplier;
      }

      return left.category.localeCompare(right.category) * multiplier;
    });
  }, [priorityFilter, query, recommendations, sortDirection, sortKey, statusFilter]);

  const columns: Array<DataGridColumn<DecisionRecommendation>> = [
    {
      key: "category",
      header: "Category",
      sortable: true,
      cell: (item) => <span className="text-sm font-medium text-slate-800">{item.category}</span>,
    },
    {
      key: "recommendation",
      header: "Recommendation",
      cell: (item) => (
        <div className="space-y-1">
          <p className="font-medium text-slate-900">{item.title}</p>
          <p className="text-xs text-slate-600">{item.reason}</p>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      cell: (item) => <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${badgeForPriority(item.priority)}`}>{item.priority}</span>,
    },
    {
      key: "confidence",
      header: "Confidence",
      sortable: true,
      cell: (item) => <span className="text-sm text-slate-800">{Math.round(item.confidence * 100)}%</span>,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (item) => <span className="text-sm text-slate-700">{item.status}</span>,
    },
    {
      key: "benefit",
      header: "Expected Benefit",
      cell: (item) => <span className="text-sm text-slate-700">{item.expectedBenefit}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (item) => (
        <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => setSelected(item)}>View</Button>
          {item.status !== "Dismissed" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={async () => {
                try {
                  setSubmitting(true);
                  await decisionEngine.dismissRecommendation(item.id);
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to dismiss recommendation.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              Dismiss
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Decision Center"
            description="Deterministic recommendations generated from simulation, health score, goals, scenarios, and monthly review outputs."
          />
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/planning">Back to Planning</Link>
            </Button>
            <Button onClick={() => void refresh()} disabled={loading || submitting}>Refresh</Button>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Critical</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.Critical}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">High</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.High}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Medium</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.Medium}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Low</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.Low}</p>
          </DashboardCard>
        </section>

        <DataGrid
          title="Recommendation Table"
          description="Generated by deterministic rule evaluation only; no AI heuristics are used."
          columns={columns}
          rows={filtered}
          getRowId={(item) => item.id}
          onRowClick={(item) => setSelected(item)}
          loading={loading}
          emptyTitle="No recommendations"
          emptyDescription="Your current state does not trigger any recommendation rules."
          search={{ value: query, onChange: setQuery, placeholder: "Search recommendations" }}
          filters={(
            <>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                <option value="all">All priorities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="Open">Open</option>
                <option value="Dismissed">Dismissed</option>
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
        />
      </PageContainer>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Recommendation Card</DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Recommendation</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{selected.title}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reason</p>
                <p className="mt-1 text-sm text-slate-700">{selected.reason}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Expected Benefit</p>
                <p className="mt-1 text-sm text-slate-700">{selected.expectedBenefit}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Confidence</p>
                  <p className="mt-1 text-sm text-slate-900">{Math.round(selected.confidence * 100)}%</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Priority</p>
                  <p className="mt-1 text-sm text-slate-900">{selected.priority}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
                  <p className="mt-1 text-sm text-slate-900">{selected.status}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Suggested Action</p>
                <p className="mt-1 text-sm text-slate-700">{selected.recommendedAction}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
