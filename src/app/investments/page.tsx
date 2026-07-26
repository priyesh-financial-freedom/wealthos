"use client";

import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { InvestmentCategoryCard } from "@/components/investments/InvestmentCategoryCard";
import { getInvestmentCategoryMeta, primaryInvestmentCategories } from "@/components/investments/investmentCategoryMeta";
import { InvestmentDetailsDialog } from "@/components/investments/InvestmentDetailsDialog";
import { InvestmentForm } from "@/components/investments/InvestmentForm";
import { InvestmentMonthlyHistoryTable } from "@/components/investments/InvestmentMonthlyHistory";
import { InvestmentSummaryCard, formatSignedCurrency } from "@/components/investments/InvestmentSummaryCard";
import { InvestmentTable } from "@/components/investments/InvestmentTable";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastViewport } from "@/components/ui/feedback";
import { ModuleCategoryGrid, ModuleInsightPanel, ModuleKpiGrid, ModuleOnboardingState } from "@/components/ui/module-design-system";
import {
  buildInvestmentSummary,
  createInvestment,
  createInvestmentMonthlyHistory,
  deleteInvestment,
  deleteInvestmentMonthlyHistory,
  getInvestmentMonthlyHistory,
  getInvestments,
  updateInvestment,
  updateInvestmentMonthlyHistory,
} from "@/services/investments";
import type {
  Investment,
  InvestmentCategory,
  InvestmentInsert,
  InvestmentMonthlyHistory,
  InvestmentMonthlyHistoryInsert,
  InvestmentStatus,
} from "@/types/investment";
import { formatCurrency } from "@/lib/formatters";

type InvestmentSortKey = "investment_name" | "investment_type" | "current_value" | "cost_value" | "monthly_change";

type HistoryFormState = {
  month_end_date: string;
  closing_value: number | string;
  notes: string;
};

const defaultHistoryState: HistoryFormState = {
  month_end_date: "",
  closing_value: 0,
  notes: "",
};

function normalizeCategoryFilter(value: string | null): "all" | InvestmentCategory {
  if (!value) {
    return "all";
  }

  const match = primaryInvestmentCategories.find((item) => item === value);
  return match ?? "all";
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function sortRows(rows: Investment[], key: InvestmentSortKey, direction: "asc" | "desc") {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];

    if (typeof leftValue === "string" && typeof rightValue === "string") {
      return leftValue.localeCompare(rightValue) * multiplier;
    }

    return (Number(leftValue ?? 0) - Number(rightValue ?? 0)) * multiplier;
  });
}

function InvestmentsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [historyRows, setHistoryRows] = useState<InvestmentMonthlyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InvestmentStatus>("all");
  const [sortKey, setSortKey] = useState<InvestmentSortKey>("current_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Investment | null>(null);
  const [editingHistory, setEditingHistory] = useState<InvestmentMonthlyHistory | null>(null);
  const [historyForm, setHistoryForm] = useState<HistoryFormState>(defaultHistoryState);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const categoryFilter = normalizeCategoryFilter(searchParams.get("category"));
  const selectedCategory = categoryFilter === "all" ? null : categoryFilter;

  function updateCategoryFilter(nextFilter: "all" | InvestmentCategory) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilter === "all") {
      params.delete("category");
    } else {
      params.set("category", nextFilter);
    }

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  }

  async function loadInvestmentsAndHistory() {
    try {
      setLoading(true);
      const [allInvestments, allHistory] = await Promise.all([getInvestments(), getInvestmentMonthlyHistory()]);
      setInvestments(allInvestments);
      setHistoryRows(allHistory);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load investments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadInvestmentsAndHistory();
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const summary = useMemo(() => buildInvestmentSummary(investments), [investments]);
  const activeCategoryCount = useMemo(
    () => summary.categorySummaries.filter((item) => item.holdingsCount > 0).length,
    [summary.categorySummaries],
  );
  const portfolioSummaryText = summary.activeInvestmentsCount > 0 ? `${summary.activeInvestmentsCount} Holdings across ${activeCategoryCount} Investment Categories` : undefined;

  const filteredRows = useMemo(() => {
    const normalized = normalizeQuery(query);
    const base = investments.filter((investment) => {
      const matchesQuery = normalized.length === 0 || `${investment.investment_name} ${investment.owner ?? ""} ${investment.institution ?? ""}`.toLowerCase().includes(normalized);
      const matchesCategory = categoryFilter === "all" || investment.investment_type === categoryFilter;
      const matchesStatus = statusFilter === "all" || investment.status === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });

    return sortRows(base, sortKey, sortDirection);
  }, [categoryFilter, investments, query, sortDirection, sortKey, statusFilter]);

  const paginatedRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize]);

  const historyRowsForTarget = useMemo(() => {
    if (!historyTarget) {
      return [];
    }

    return historyRows.filter((row) => row.investment_id === historyTarget.id);
  }, [historyRows, historyTarget]);

  async function handleCreateInvestment(values: InvestmentInsert) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await createInvestment(values);
      setDialogOpen(false);
      setEditingInvestment(null);
      setNotice("Investment created successfully.");
      await loadInvestmentsAndHistory();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create investment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateInvestment(values: InvestmentInsert) {
    if (!editingInvestment) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await updateInvestment({ id: editingInvestment.id, ...values });
      setDialogOpen(false);
      setEditingInvestment(null);
      setNotice("Investment updated successfully.");
      await loadInvestmentsAndHistory();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update investment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteInvestment(target: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteInvestment(target.id);
      setDeleteTarget(null);
      setNotice("Investment deleted successfully.");
      await loadInvestmentsAndHistory();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete investment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveHistory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!historyTarget || !historyForm.month_end_date) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const payload: InvestmentMonthlyHistoryInsert = {
        investment_id: historyTarget.id,
        month_end_date: historyForm.month_end_date,
        closing_value: Number(historyForm.closing_value),
        notes: historyForm.notes || null,
      };

      if (editingHistory) {
        await updateInvestmentMonthlyHistory({
          id: editingHistory.id,
          ...payload,
        });
        setNotice("Month-end history updated.");
      } else {
        await createInvestmentMonthlyHistory(payload);
        setNotice("Month-end history added.");
      }

      setEditingHistory(null);
      setHistoryForm(defaultHistoryState);
      await loadInvestmentsAndHistory();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Unable to save month-end history.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteHistory(row: InvestmentMonthlyHistory) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteInvestmentMonthlyHistory(row.id);
      setNotice("Month-end history removed.");
      await loadInvestmentsAndHistory();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : "Unable to delete month-end history.");
    } finally {
      setSubmitting(false);
    }
  }

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

    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Investments" }]} />

        <PageToolbar>
          <PageHeader
            title="Investments"
            description="Track and monitor your investment portfolio across all investment categories."
            summary={portfolioSummaryText}
          />
          {selectedCategory ? (
            <Button
              onClick={() => {
                setEditingInvestment(null);
                setDialogOpen(true);
              }}
              disabled={submitting}
            >
              {getInvestmentCategoryMeta(selectedCategory).addLabel}
            </Button>
          ) : null}
        </PageToolbar>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <ModuleKpiGrid>
          <InvestmentSummaryCard
            title="Total Investment Value"
            value={summary.activeInvestmentsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalInvestmentValue, { maximumFractionDigits: 0 })}
            subtitle={summary.activeInvestmentsCount === 0 ? "Add your first investment to start your portfolio." : "Total value across all investment categories"}
            icon="wallet"
          />
          <InvestmentSummaryCard
            title="Monthly Change"
            value={summary.activeInvestmentsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.monthlyChange)}
            subtitle={summary.activeInvestmentsCount === 0 ? "Value movement appears after your first month-end update." : "Change versus previous month-end values"}
            icon="change"
            tone={summary.monthlyChange >= 0 ? "positive" : "warning"}
          />
          <InvestmentSummaryCard
            title="Investment Holdings"
            value={summary.activeInvestmentsCount === 0 ? "No Holdings Yet" : `${summary.activeInvestmentsCount}`}
            subtitle={summary.activeInvestmentsCount === 0 ? "Use category cards to add your first holding." : "Number of active investment holdings."}
            icon="count"
          />
          <InvestmentSummaryCard
            title="Asset Allocation"
            value={summary.assetAllocation.length === 0 ? "No investment data available." : `${summary.assetAllocation.length} categories`}
            subtitle={summary.assetAllocation.length === 0 ? "Your allocation chart will appear after you add your first investment." : "Allocation view across your portfolio categories"}
            icon="allocation"
          />
        </ModuleKpiGrid>

        <ModuleInsightPanel title="Asset Allocation" description="Track current allocation weights across investment categories.">
            {summary.assetAllocation.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No investment data available.<br />Your allocation chart will appear after you add your first investment.</div>
            ) : (
              <div className="space-y-2">
                {summary.assetAllocation.map((item) => {
                  const share = summary.totalInvestmentValue > 0 ? (item.value / summary.totalInvestmentValue) * 100 : 0;
                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{item.name}</span>
                        <span className="text-slate-600">{share.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-slate-700" style={{ width: `${Math.min(100, share)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </ModuleInsightPanel>

        <ModuleCategoryGrid>
          {primaryInvestmentCategories.map((category) => {
            const card = summary.categorySummaries.find((item) => item.category === category) ?? {
              category,
              totalValue: 0,
              holdingsCount: 0,
              monthlyChange: 0,
            };

            return (
              <InvestmentCategoryCard
                key={category}
                displayName={getInvestmentCategoryMeta(category).displayName}
                category={category}
                totalValue={card.totalValue}
                holdingsCount={card.holdingsCount}
                monthlyChange={card.monthlyChange}
                href={category === "Mutual Funds" ? "/investments/mutual-funds" : `/investments?category=${encodeURIComponent(category)}`}
              />
            );
          })}
        </ModuleCategoryGrid>

        {investments.length === 0 ? (
          <ContentContainer>
            <ModuleOnboardingState
              title="Welcome to Investments"
              description="Start building your investment portfolio."
              steps={["Mutual Funds", "Stocks", "Bonds", "Fixed Deposits"]}
            />
          </ContentContainer>
        ) : null}

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading investments...</div>
          ) : (
            <InvestmentTable
              rows={paginatedRows}
              searchValue={query}
              onSearchChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              categoryFilter={categoryFilter}
              statusFilter={statusFilter}
              onCategoryFilterChange={(value) => {
                updateCategoryFilter(value);
                setPage(1);
              }}
              onStatusFilterChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={(nextKey, nextDirection) => {
                setSortKey(nextKey);
                setSortDirection(nextDirection);
                setPage(1);
              }}
              page={page}
              pageSize={pageSize}
              totalRows={filteredRows.length}
              onPageChange={setPage}
              onPageSizeChange={(value) => {
                setPageSize(value);
                setPage(1);
              }}
              onView={setSelectedInvestment}
              onEdit={(row) => {
                setEditingInvestment(row);
                setDialogOpen(true);
              }}
              onDelete={setDeleteTarget}
              onOpenHistory={(row) => {
                setHistoryTarget(row);
                setEditingHistory(null);
                setHistoryForm(defaultHistoryState);
                setHistoryDialogOpen(true);
              }}
            />
          )}
        </ContentContainer>
      </PageContainer>

      <InvestmentDetailsDialog
        investment={selectedInvestment}
        totalPortfolioValue={summary.totalInvestmentValue}
        open={Boolean(selectedInvestment)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInvestment(null);
          }
        }}
      />

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingInvestment(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingInvestment
                ? `Edit ${getInvestmentCategoryMeta(editingInvestment.investment_type).singularName}`
                : selectedCategory
                  ? getInvestmentCategoryMeta(selectedCategory).addLabel
                  : "Add Mutual Fund"}
            </DialogTitle>
          </DialogHeader>
          <InvestmentForm
            initialData={editingInvestment}
            submitLabel={selectedCategory ? getInvestmentCategoryMeta(selectedCategory).addLabel : "Add Mutual Fund"}
            onSubmit={editingInvestment ? handleUpdateInvestment : handleCreateInvestment}
            onCancel={() => {
              setDialogOpen(false);
              setEditingInvestment(null);
            }}
            submitting={submitting}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete investment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this investment?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDeleteInvestment(deleteTarget)} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyDialogOpen}
        onOpenChange={(open) => {
          setHistoryDialogOpen(open);
          if (!open) {
            setHistoryTarget(null);
            setEditingHistory(null);
            setHistoryForm(defaultHistoryState);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{historyTarget ? `Monthly History · ${historyTarget.investment_name}` : "Monthly History"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveHistory} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1fr_2fr_auto]">
            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={historyForm.month_end_date}
              onChange={(event) => setHistoryForm((current) => ({ ...current, month_end_date: event.target.value }))}
              required
            />
            <input
              type="number"
              step="0.01"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Closing Value"
              value={historyForm.closing_value}
              onChange={(event) => setHistoryForm((current) => ({ ...current, closing_value: event.target.value }))}
              required
            />
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Notes"
              value={historyForm.notes}
              onChange={(event) => setHistoryForm((current) => ({ ...current, notes: event.target.value }))}
            />
            <div className="flex gap-2">
              {editingHistory ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingHistory(null);
                    setHistoryForm(defaultHistoryState);
                  }}
                  disabled={submitting}
                >
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={submitting || !historyTarget}>{editingHistory ? "Update" : "Add"}</Button>
            </div>
          </form>

          <InvestmentMonthlyHistoryTable
            rows={historyRowsForTarget}
            onEdit={(row) => {
              setEditingHistory(row);
              setHistoryForm({
                month_end_date: row.month_end_date,
                closing_value: row.closing_value,
                notes: row.notes ?? "",
              });
            }}
            onDelete={(row) => {
              void handleDeleteHistory(row);
            }}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

export default function InvestmentsPage() {
  return (
    <Suspense fallback={<div className="h-dvh min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef4ff_0%,_#f3f6fb_35%,_#f8fbff_100%)]" />}>
      <InvestmentsPageContent />
    </Suspense>
  );
}
