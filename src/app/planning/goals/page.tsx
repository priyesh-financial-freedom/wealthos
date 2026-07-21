"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { DataGrid, type DataGridColumn, type DataGridSortDirection } from "@/components/ui/data-grid";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { goalService, type FinancialGoalWithProgress, type GoalPriority, type GoalType } from "@/services/planning/goals";
import { planningScenarioService } from "@/services/planning/scenarios";

const GOAL_TYPE_OPTIONS: GoalType[] = ["RETIREMENT", "EDUCATION", "HOME_PURCHASE", "WEALTH_TARGET", "CUSTOM"];
const GOAL_PRIORITY_OPTIONS: GoalPriority[] = ["HIGH", "MEDIUM", "LOW"];

interface GoalFormValues {
  name: string;
  goal_type: GoalType;
  target_amount: string;
  target_date: string;
  priority: GoalPriority;
  funding_source: string;
  linked_scenario_id: string;
  notes: string;
}

const EMPTY_FORM: GoalFormValues = {
  name: "",
  goal_type: "CUSTOM",
  target_amount: "",
  target_date: "",
  priority: "MEDIUM",
  funding_source: "",
  linked_scenario_id: "",
  notes: "",
};

function toFormValues(goal: FinancialGoalWithProgress | null): GoalFormValues {
  if (!goal) {
    return EMPTY_FORM;
  }

  return {
    name: goal.name,
    goal_type: goal.goal_type,
    target_amount: String(goal.target_amount),
    target_date: goal.target_date,
    priority: goal.priority,
    funding_source: goal.funding_source ?? "",
    linked_scenario_id: goal.linked_scenario_id ?? "",
    notes: goal.notes ?? "",
  };
}

function statusBadgeClass(status: FinancialGoalWithProgress["status"]) {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ON_TRACK":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "NEEDS_ATTENTION":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "AT_RISK":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "NOT_STARTED":
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function PlanningGoalsPage() {
  const [goals, setGoals] = useState<FinancialGoalWithProgress[]>([]);
  const [scenarios, setScenarios] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("target_date");
  const [sortDirection, setSortDirection] = useState<DataGridSortDirection>("asc");
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinancialGoalWithProgress | null>(null);
  const [editingGoal, setEditingGoal] = useState<FinancialGoalWithProgress | null>(null);
  const [formValues, setFormValues] = useState<GoalFormValues>(EMPTY_FORM);

  async function refresh() {
    try {
      setLoading(true);
      const [nextGoals, nextScenarios] = await Promise.all([
        goalService.listGoals({ includeProgress: true }),
        planningScenarioService.listScenarios(),
      ]);

      setGoals(nextGoals);
      setScenarios(nextScenarios.map((scenario) => ({ id: scenario.id, name: scenario.name })));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load goals.");
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

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const summary = useMemo(() => {
    const totalGoals = goals.length;
    const completedGoals = goals.filter((goal) => goal.status === "COMPLETED").length;
    const onTrackGoals = goals.filter((goal) => goal.status === "ON_TRACK").length;
    const atRiskGoals = goals.filter((goal) => goal.status === "AT_RISK").length;

    return { totalGoals, completedGoals, onTrackGoals, atRiskGoals };
  }, [goals]);

  const filteredGoals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const list = goals.filter((goal) => {
      const matchesQuery =
        !normalizedQuery ||
        `${goal.name} ${goal.goal_type} ${goal.funding_source ?? ""} ${goal.notes ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || goal.status === statusFilter;

      return matchesQuery && matchesStatus;
    });

    return [...list].sort((left, right) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "name") {
        return left.name.localeCompare(right.name) * multiplier;
      }

      if (sortKey === "target_amount") {
        return (Number(left.target_amount) - Number(right.target_amount)) * multiplier;
      }

      if (sortKey === "status") {
        return left.status.localeCompare(right.status) * multiplier;
      }

      return (new Date(left.target_date).getTime() - new Date(right.target_date).getTime()) * multiplier;
    });
  }, [goals, query, sortDirection, sortKey, statusFilter]);

  const columns: Array<DataGridColumn<FinancialGoalWithProgress>> = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (goal) => (
        <div className="space-y-1">
          <p className="font-medium text-slate-900">{goal.name}</p>
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{goal.goal_type.replaceAll("_", " ")}</p>
        </div>
      ),
    },
    {
      key: "target_amount",
      header: "Target",
      sortable: true,
      cell: (goal) => (
        <div>
          <p className="font-medium text-slate-900">{formatCurrency(goal.target_amount)}</p>
          <p className="text-xs text-slate-500">Priority: {goal.priority}</p>
        </div>
      ),
    },
    {
      key: "progress",
      header: "Progress",
      cell: (goal) => (
        <div className="space-y-1">
          <p className="font-medium text-slate-900">{goal.progress ? `${goal.progress.progress_percent}%` : "—"}</p>
          <p className="text-xs text-slate-500">Projected: {goal.progress ? formatCurrency(goal.progress.projected_amount) : "—"}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      cell: (goal) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(goal.status)}`}>
          {goal.status.replaceAll("_", " ")}
        </span>
      ),
    },
    {
      key: "scenario",
      header: "Scenario",
      cell: (goal) => <span className="text-sm text-slate-700">{goal.linked_scenario_name ?? "Base Projection"}</span>,
    },
    {
      key: "target_date",
      header: "Target Date",
      sortable: true,
      cell: (goal) => <span className="text-sm text-slate-700">{formatDate(goal.target_date)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (goal) => (
        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingGoal(goal);
              setFormValues(toFormValues(goal));
              setEditorOpen(true);
            }}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                setSubmitting(true);
                await goalService.calculateGoalProgress(goal.id);
                await refresh();
                setNotice("Goal progress refreshed.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to refresh goal progress.");
              } finally {
                setSubmitting(false);
              }
            }}
            disabled={submitting}
          >
            Progress
          </Button>
          {!goal.is_completed ? (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  setSubmitting(true);
                  await goalService.markCompleted(goal.id);
                  await refresh();
                  setNotice("Goal marked as completed.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to complete goal.");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
            >
              Complete
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  setSubmitting(true);
                  await goalService.archiveGoal(goal.id);
                  await refresh();
                  setNotice("Goal archived.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to archive goal.");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
            >
              Archive
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(goal)} disabled={submitting}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const targetAmount = Number(formValues.target_amount);

      if (!formValues.name.trim()) {
        throw new Error("Goal name is required.");
      }

      if (!formValues.target_date) {
        throw new Error("Target date is required.");
      }

      if (Number.isNaN(targetAmount) || targetAmount < 0) {
        throw new Error("Target amount must be a valid positive number.");
      }

      const payload = {
        name: formValues.name.trim(),
        goal_type: formValues.goal_type,
        target_amount: targetAmount,
        target_date: formValues.target_date,
        priority: formValues.priority,
        funding_source: formValues.funding_source.trim() || null,
        linked_scenario_id: formValues.linked_scenario_id || null,
        notes: formValues.notes.trim() || null,
      };

      if (editingGoal) {
        await goalService.updateGoal({ id: editingGoal.id, ...payload });
        setNotice("Goal updated.");
      } else {
        await goalService.createGoal(payload);
        setNotice("Goal created.");
      }

      setEditorOpen(false);
      setEditingGoal(null);
      setFormValues(EMPTY_FORM);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save goal.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader title="Planning Goals" description="Define long-term outcomes and keep each target aligned with simulation-backed projections." />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/planning">Back to Planning</Link>
            </Button>
            <Button
              onClick={() => {
                setEditingGoal(null);
                setFormValues(EMPTY_FORM);
                setEditorOpen(true);
              }}
            >
              Add Goal
            </Button>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total Goals</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.totalGoals}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Completed</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.completedGoals}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">On Track</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.onTrackGoals}</p>
          </DashboardCard>
          <DashboardCard>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">At Risk</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.atRiskGoals}</p>
          </DashboardCard>
        </section>

        <DataGrid
          title="Goal List"
          description="Every goal can optionally link to one planning scenario. Progress is always derived from the simulation engine."
          columns={columns}
          rows={filteredGoals}
          getRowId={(goal) => goal.id}
          loading={loading}
          emptyTitle="No goals defined"
          emptyDescription="Create your first goal to start tracking long-term outcomes."
          search={{ value: query, onChange: setQuery, placeholder: "Search goals" }}
          filters={(
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="ON_TRACK">On Track</option>
              <option value="NEEDS_ATTENTION">Needs Attention</option>
              <option value="AT_RISK">At Risk</option>
              <option value="COMPLETED">Completed</option>
            </select>
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

      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditingGoal(null);
            setFormValues(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "Edit Goal" : "Create Goal"}</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormGrid>
              <FormField>
                <Label htmlFor="goal-name">Name</Label>
                <Input
                  id="goal-name"
                  value={formValues.name}
                  onChange={(event) => setFormValues((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Retirement corpus"
                  required
                />
              </FormField>
              <FormField>
                <Label htmlFor="goal-type">Goal Type</Label>
                <select
                  id="goal-type"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={formValues.goal_type}
                  onChange={(event) => setFormValues((current) => ({ ...current, goal_type: event.target.value as GoalType }))}
                >
                  {GOAL_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </FormField>
              <FormField>
                <Label htmlFor="goal-target-amount">Target Amount</Label>
                <Input
                  id="goal-target-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={formValues.target_amount}
                  onChange={(event) => setFormValues((current) => ({ ...current, target_amount: event.target.value }))}
                  placeholder="10000000"
                  required
                />
              </FormField>
              <FormField>
                <Label htmlFor="goal-target-date">Target Date</Label>
                <Input
                  id="goal-target-date"
                  type="date"
                  value={formValues.target_date}
                  onChange={(event) => setFormValues((current) => ({ ...current, target_date: event.target.value }))}
                  required
                />
              </FormField>
              <FormField>
                <Label htmlFor="goal-priority">Priority</Label>
                <select
                  id="goal-priority"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={formValues.priority}
                  onChange={(event) => setFormValues((current) => ({ ...current, priority: event.target.value as GoalPriority }))}
                >
                  {GOAL_PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </FormField>
              <FormField>
                <Label htmlFor="goal-funding-source">Funding Source</Label>
                <Input
                  id="goal-funding-source"
                  value={formValues.funding_source}
                  onChange={(event) => setFormValues((current) => ({ ...current, funding_source: event.target.value }))}
                  placeholder="Investments + Monthly savings"
                />
              </FormField>
              <FormField className="md:col-span-2">
                <Label htmlFor="goal-scenario">Scenario</Label>
                <select
                  id="goal-scenario"
                  className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                  value={formValues.linked_scenario_id}
                  onChange={(event) => setFormValues((current) => ({ ...current, linked_scenario_id: event.target.value }))}
                >
                  <option value="">None (Base Projection)</option>
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField className="md:col-span-2">
                <Label htmlFor="goal-notes">Notes</Label>
                <Textarea
                  id="goal-notes"
                  value={formValues.notes}
                  onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional notes about assumptions, milestones, and tradeoffs"
                />
              </FormField>
            </FormGrid>

            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditorOpen(false);
                  setEditingGoal(null);
                  setFormValues(EMPTY_FORM);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editingGoal ? "Save Changes" : "Create Goal"}</Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            {deleteTarget?.is_completed
              ? "This goal is completed. Confirm deletion to permanently remove it."
              : "Are you sure you want to delete this goal?"}
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>Cancel</Button>
            <Button
              variant="outline"
              onClick={async () => {
                if (!deleteTarget) {
                  return;
                }

                try {
                  setSubmitting(true);
                  await goalService.deleteGoal(deleteTarget.id, { confirmCompleted: true });
                  setDeleteTarget(null);
                  await refresh();
                  setNotice("Goal deleted.");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to delete goal.");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
            >
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
