"use client";

import { useEffect, useMemo, useState } from "react";

import { InvestmentDashboard } from "@/components/investments/InvestmentDashboard";
import { InvestmentDetailsDialog } from "@/components/investments/InvestmentDetailsDialog";
import { InvestmentForm } from "@/components/investments/InvestmentForm";
import { InvestmentTable } from "@/components/investments/InvestmentTable";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { buildInvestmentInsights, buildInvestmentSummary, createInvestment, deleteInvestment, getInvestments, getRecentInvestments, getTopInvestments, updateInvestment } from "@/services/investments";
import type { Investment, InvestmentInsert } from "@/types/investment";

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"name" | "category" | "current_value" | "gain_loss" | "cagr" | "xirr" | "cost_basis" | "nav_price">("current_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
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
  const topInvestments = useMemo(() => getTopInvestments(investments), [investments]);
  const recentInvestments = useMemo(() => getRecentInvestments(investments), [investments]);
  const insights = useMemo(() => buildInvestmentInsights(summary), [summary]);

  const filteredInvestments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = investments.filter((investment) => {
      const matchesQuery = !normalized || `${investment.investment_name} ${investment.category} ${investment.sector ?? ""} ${investment.amc ?? ""} ${investment.owner ?? ""} ${investment.folio_number ?? ""} ${investment.amfi_scheme_code ?? ""} ${investment.broker_platform ?? ""} ${investment.nominee ?? ""}`.toLowerCase().includes(normalized);
      const matchesCategory = categoryFilter === "all" || investment.category === categoryFilter;
      const matchesRegion = regionFilter === "all" || investment.region === regionFilter;
      return matchesQuery && matchesCategory && matchesRegion;
    });

    return [...filtered].sort((left, right) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      const getValue = (investment: Investment) => {
        switch (sortKey) {
          case "name":
            return investment.investment_name.toLowerCase();
          case "category":
            return investment.category;
          case "gain_loss":
            return investment.gain_loss;
          case "cagr":
            return investment.cagr ?? -Infinity;
          case "xirr":
            return investment.xirr ?? -Infinity;
          case "cost_basis":
            return investment.cost_basis;
          case "nav_price":
            return investment.nav_price;
          case "current_value":
          default:
            return investment.current_value;
        }
      };

      const leftValue = getValue(left);
      const rightValue = getValue(right);
      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * multiplier;
      }

      return (Number(leftValue) - Number(rightValue)) * multiplier;
    });
  }, [categoryFilter, investments, query, regionFilter, sortDirection, sortKey]);

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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader title="Investments" description="Track portfolio performance, allocation, and growth with an executive-grade workspace." />
          <Button onClick={() => { setEditingInvestment(null); setDialogOpen(true); }} disabled={submitting}>Add Investment</Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <InvestmentDashboard loading={loading} emptyState={investments.length === 0} summary={summary} topInvestments={topInvestments} recentInvestments={recentInvestments} insights={insights} />

        <DashboardCard id="investment-form">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Investment portfolio</h3>
              <p className="text-sm text-slate-600">Search, filter, sort, and manage holdings</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search investments" className="max-w-sm" />
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option value="all">All categories</option>
                <option value="Mutual Funds">Mutual Funds</option>
                <option value="Stocks">Stocks</option>
                <option value="ETFs">ETFs</option>
                <option value="Bonds">Bonds</option>
                <option value="Fixed Deposits">Fixed Deposits</option>
                <option value="EPF">EPF</option>
                <option value="PPF">PPF</option>
                <option value="NPS">NPS</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Sovereign Gold Bonds">Sovereign Gold Bonds</option>
                <option value="Crypto">Crypto</option>
                <option value="Cash Equivalents">Cash Equivalents</option>
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
                <option value="all">All regions</option>
                <option value="Domestic">Domestic</option>
                <option value="International">International</option>
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={`${sortKey}:${sortDirection}`} onChange={(event) => {
                const [nextKey, nextDirection] = event.target.value.split(":") as [typeof sortKey, typeof sortDirection];
                setSortKey(nextKey);
                setSortDirection(nextDirection);
              }}>
                <option value="current_value:desc">Current value (High-Low)</option>
                <option value="current_value:asc">Current value (Low-High)</option>
                <option value="gain_loss:desc">Gain/Loss (High-Low)</option>
                <option value="gain_loss:asc">Gain/Loss (Low-High)</option>
                <option value="cagr:desc">CAGR (High-Low)</option>
                <option value="cagr:asc">CAGR (Low-High)</option>
                <option value="xirr:desc">XIRR (High-Low)</option>
                <option value="xirr:asc">XIRR (Low-High)</option>
                <option value="cost_basis:desc">Cost basis (High-Low)</option>
                <option value="cost_basis:asc">Cost basis (Low-High)</option>
                <option value="nav_price:desc">NAV / Price (High-Low)</option>
                <option value="nav_price:asc">NAV / Price (Low-High)</option>
                <option value="name:asc">Name (A-Z)</option>
                <option value="name:desc">Name (Z-A)</option>
              </select>
            </div>
          </div>

          {loading ? <LoadingSpinner label="Loading investments..." /> : filteredInvestments.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><h4 className="text-base font-semibold text-slate-900">No investments yet</h4><p className="mt-2 text-sm text-slate-600">Add your first holding to unlock allocation, return, and diversification insights.</p></div> : <InvestmentTable investments={filteredInvestments} totalPortfolioValue={summary.totalInvestmentValue} onView={(investment) => setSelectedInvestment(investment)} onEdit={(investment) => { setEditingInvestment(investment); setDialogOpen(true); }} onDelete={(investment) => setDeleteTarget(investment)} />}
        </DashboardCard>
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
