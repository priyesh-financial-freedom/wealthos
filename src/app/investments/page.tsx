"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { InvestmentDetailsDialog } from "@/components/investments/InvestmentDetailsDialog";
import { InvestmentForm } from "@/components/investments/InvestmentForm";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastViewport } from "@/components/ui/feedback";
import { buildInvestmentSummary, createInvestment, deleteInvestment, getInvestments, updateInvestment } from "@/services/investments";
import type { Investment, InvestmentInsert } from "@/types/investment";

type InvestmentSortKey = "name" | "category" | "current_value" | "gain_loss" | "cost_basis" | "nav_price";
type CategoryFilter = "all" | "Mutual Funds" | "Stocks";

const InvestmentDashboard = dynamic(() => import("@/components/investments/InvestmentDashboard").then((mod) => mod.InvestmentDashboard), {
  ssr: false,
});

const InvestmentTable = dynamic(() => import("@/components/investments/InvestmentTable").then((mod) => mod.InvestmentTable), {
  ssr: false,
});

function matchesInvestmentQuery(investment: Investment, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  return `${investment.investment_name} ${investment.category} ${investment.sector ?? ""} ${investment.amc ?? ""} ${investment.exchange ?? ""} ${investment.owner ?? ""} ${investment.folio_number ?? ""} ${investment.amfi_scheme_code ?? ""} ${investment.isin ?? ""} ${investment.broker_platform ?? ""} ${investment.broker ?? ""} ${investment.nominee ?? ""}`
    .toLowerCase()
    .includes(normalizedQuery);
}

function getInvestmentSortValue(investment: Investment, sortKey: InvestmentSortKey) {
  switch (sortKey) {
    case "name":
      return investment.investment_name.toLowerCase();
    case "category":
      return investment.category;
    case "gain_loss":
      return investment.gain_loss;
    case "cost_basis":
      return investment.cost_basis;
    case "nav_price":
      return investment.nav_price;
    case "current_value":
    default:
      return investment.current_value;
  }
}

function filterAndSortInvestments(params: {
  investments: Investment[];
  query: string;
  categoryFilter: CategoryFilter;
  regionFilter: string;
  sortKey: InvestmentSortKey;
  sortDirection: "asc" | "desc";
}) {
  const normalizedQuery = params.query.trim().toLowerCase();
  const multiplier = params.sortDirection === "asc" ? 1 : -1;

  return params.investments
    .filter((investment) => {
      const matchesQuery = matchesInvestmentQuery(investment, normalizedQuery);
      const matchesCategory = params.categoryFilter === "all" || investment.category === params.categoryFilter;
      const matchesRegion = params.regionFilter === "all" || investment.region === params.regionFilter;
      return matchesQuery && matchesCategory && matchesRegion;
    })
    .sort((left, right) => {
      const leftValue = getInvestmentSortValue(left, params.sortKey);
      const rightValue = getInvestmentSortValue(right, params.sortKey);

      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * multiplier;
      }

      return (Number(leftValue) - Number(rightValue)) * multiplier;
    });
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<InvestmentSortKey>("current_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshInvestments() {
    try {
      setLoading(true);
      const nextInvestments = await getInvestments();
      setInvestments(nextInvestments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load investments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInvestments() {
      try {
        const nextInvestments = await getInvestments();
        if (isMounted) {
          setInvestments(nextInvestments);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load investments");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadInvestments();

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => buildInvestmentSummary(investments), [investments]);

  const filteredInvestments = useMemo(
    () => filterAndSortInvestments({ investments, query, categoryFilter, regionFilter, sortKey, sortDirection }),
    [categoryFilter, investments, query, regionFilter, sortDirection, sortKey],
  );

  const paginatedInvestments = useMemo(() => filteredInvestments.slice((page - 1) * pageSize, page * pageSize), [filteredInvestments, page, pageSize]);

  async function handleCreate(values: InvestmentInsert) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createInvestment(values);
      setDialogOpen(false);
      setNotice("Investment created successfully.");
      await refreshInvestments();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create investment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(values: InvestmentInsert) {
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
      await refreshInvestments();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update investment");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(investment: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await deleteInvestment(investment.id);
      setDeleteTarget(null);
      setNotice("Investment deleted successfully.");
      await refreshInvestments();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete investment");
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
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Mutual Funds & Investments" }]} />

        <PageToolbar>
          <PageHeader title="Investments" description="Track portfolio performance, allocation, and growth with an executive-grade workspace." />
          <Button onClick={() => { setEditingInvestment(null); setDialogOpen(true); }} disabled={submitting}>Add Investment</Button>
        </PageToolbar>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <InvestmentDashboard loading={loading} emptyState={investments.length === 0} summary={summary} />
        </ContentContainer>

        <div className="flex flex-wrap gap-2">
          {[
            { label: "All", value: "all" as const },
            { label: "Mutual Funds", value: "Mutual Funds" as const },
            { label: "Stocks", value: "Stocks" as const },
          ].map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={categoryFilter === option.value ? "default" : "outline"}
              onClick={() => {
                setCategoryFilter(option.value);
                setPage(1);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <InvestmentTable
          investments={paginatedInvestments}
          totalPortfolioValue={summary.totalInvestmentValue}
          searchValue={query}
          onSearchChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          categoryFilter={categoryFilter}
          regionFilter={regionFilter}
          onRegionFilterChange={(value) => {
            setRegionFilter(value);
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
          totalRows={filteredInvestments.length}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          onView={(investment) => setSelectedInvestment(investment)}
          onEdit={(investment) => { setEditingInvestment(investment); setDialogOpen(true); }}
          onDelete={(investment) => setDeleteTarget(investment)}
        />
      </PageContainer>

      <InvestmentDetailsDialog investment={selectedInvestment} totalPortfolioValue={summary.totalInvestmentValue} open={Boolean(selectedInvestment)} onOpenChange={(open) => { if (!open) setSelectedInvestment(null); }} />

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingInvestment(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingInvestment ? "Edit investment" : "Add investment"}</DialogTitle>
          </DialogHeader>
          <InvestmentForm key={editingInvestment?.id ?? "new-investment"} initialData={editingInvestment} onSubmit={editingInvestment ? handleUpdate : handleCreate} onCancel={() => { setDialogOpen(false); setEditingInvestment(null); }} submitting={submitting} />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete investment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this investment?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDelete(deleteTarget)} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
