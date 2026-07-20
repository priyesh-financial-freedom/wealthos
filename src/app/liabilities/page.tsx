"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { LiabilityDetailsDialog } from "@/components/liabilities/LiabilityDetailsDialog";
import { LiabilityForm } from "@/components/liabilities/LiabilityForm";
import { LiabilitySummary } from "@/components/liabilities/LiabilitySummary";
import { LiabilityTable } from "@/components/liabilities/LiabilityTable";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { formatCurrency, formatPercent, truncateLabel } from "@/lib/formatters";
import { getBalanceSheetData } from "@/services/balanceSheet";
import { createLiability, deleteLiability, getLiabilities, updateLiability } from "@/services/liabilities";
import { LIABILITY_TYPES, type Liability, type LiabilityInsert, type LiabilityType } from "@/types/liability";

interface SummaryBucket {
  label: string;
  value: number;
  share: number;
}

const CHART_COLORS = ["#0f172a", "#1d4ed8", "#0f766e", "#b45309", "#7c3aed", "#be123c", "#0e7490", "#475569"];

function sum(values: number[]) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}

function liabilityBucketLabel(type: LiabilityType) {
  if (type === "Home Loan" || type === "Loan Against Property") {
    return "Home Loans";
  }

  if (type === "Car Loan") {
    return "Vehicle Loans";
  }

  if (type === "Credit Card") {
    return "Credit Cards";
  }

  if (type === "Overdraft / Line of Credit") {
    return "Overdraft";
  }

  return "Other";
}

function buildSummaryBuckets(liabilities: Liability[]): SummaryBucket[] {
  const grouped = liabilities.reduce<Record<string, number>>((acc, liability) => {
    const key = liabilityBucketLabel(liability.liability_type);
    acc[key] = (acc[key] ?? 0) + Number(liability.outstanding_amount ?? 0);
    return acc;
  }, {
    "Home Loans": 0,
    "Vehicle Loans": 0,
    "Credit Cards": 0,
    Overdraft: 0,
    Other: 0,
  });

  const totalLiabilities = sum(Object.values(grouped));
  return ["Home Loans", "Vehicle Loans", "Credit Cards", "Overdraft", "Other"].map((label) => ({
    label,
    value: Number(grouped[label] ?? 0),
    share: totalLiabilities > 0 ? Number(grouped[label] ?? 0) / totalLiabilities : 0,
  }));
}

function buildAllocationRows(liabilities: Liability[]) {
  const grouped = liabilities.reduce<Record<string, number>>((acc, liability) => {
    const key = liability.liability_type;
    acc[key] = (acc[key] ?? 0) + Number(liability.outstanding_amount ?? 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value);
}

function buildEmiRows(liabilities: Liability[]) {
  const grouped = liabilities.reduce<Record<string, number>>((acc, liability) => {
    const key = liability.liability_type;
    acc[key] = (acc[key] ?? 0) + Number(liability.emi ?? 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([name, emi]) => ({ name, emi }))
    .filter((row) => row.emi > 0)
    .sort((left, right) => right.emi - left.emi);
}

export default function LiabilitiesPage() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [totalAssetBase, setTotalAssetBase] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<"account_name" | "outstanding_amount" | "emi" | "interest_rate" | "created_at">("outstanding_amount");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLiability, setEditingLiability] = useState<Liability | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Liability | null>(null);
  const [selectedLiability, setSelectedLiability] = useState<Liability | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshDashboard() {
    try {
      setLoading(true);
      const [nextLiabilities, balanceSheetData] = await Promise.all([
        getLiabilities(),
        getBalanceSheetData().catch(() => null),
      ]);

      setLiabilities(nextLiabilities);
      setTotalAssetBase(balanceSheetData?.summary.totalBalanceSheetAssets ?? 0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load liabilities");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadLiabilities() {
      try {
        const [nextLiabilities, balanceSheetData] = await Promise.all([
          getLiabilities(),
          getBalanceSheetData().catch(() => null),
        ]);

        if (isMounted) {
          setLiabilities(nextLiabilities);
          setTotalAssetBase(balanceSheetData?.summary.totalBalanceSheetAssets ?? 0);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load liabilities");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadLiabilities();

    const handleRefresh = () => {
      void refreshDashboard();
    };

    window.addEventListener("wealthos:finance-data-updated", handleRefresh);
    window.addEventListener("focus", handleRefresh);

    return () => {
      isMounted = false;
      window.removeEventListener("wealthos:finance-data-updated", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, []);

  const filteredLiabilities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = liabilities.filter((liability) => {
      const matchesQuery = !normalizedQuery || `${liability.account_name} ${liability.lender} ${liability.liability_type} ${liability.status} ${liability.notes ?? ""}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === "all" || liability.status === statusFilter;
      const matchesType = typeFilter === "all" || liability.liability_type === typeFilter;
      return matchesQuery && matchesStatus && matchesType;
    });

    return [...filtered].sort((left, right) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;

      const getValue = (liability: Liability) => {
        switch (sortKey) {
          case "account_name":
            return liability.account_name.toLowerCase();
          case "emi":
            return Number(liability.emi ?? 0);
          case "interest_rate":
            return Number(liability.interest_rate ?? 0);
          case "created_at":
            return new Date(liability.created_at).getTime();
          case "outstanding_amount":
          default:
            return Number(liability.outstanding_amount ?? 0);
        }
      };

      const leftValue = getValue(left);
      const rightValue = getValue(right);
      if (typeof leftValue === "string" && typeof rightValue === "string") {
        return leftValue.localeCompare(rightValue) * multiplier;
      }

      return (Number(leftValue) - Number(rightValue)) * multiplier;
    });
  }, [liabilities, query, sortDirection, sortKey, statusFilter, typeFilter]);

  const liabilitySummaryCards = useMemo(() => buildSummaryBuckets(filteredLiabilities), [filteredLiabilities]);
  const allocationRows = useMemo(() => buildAllocationRows(filteredLiabilities), [filteredLiabilities]);
  const emiRows = useMemo(() => buildEmiRows(filteredLiabilities), [filteredLiabilities]);

  async function handleCreate(values: LiabilityInsert) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createLiability(values);
      setDialogOpen(false);
      setNotice("Liability created successfully.");
      await refreshDashboard();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create liability");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(values: LiabilityInsert) {
    if (!editingLiability) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await updateLiability({ id: editingLiability.id, ...values });
      setDialogOpen(false);
      setEditingLiability(null);
      setNotice("Liability updated successfully.");
      await refreshDashboard();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update liability");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(liability: Liability) {
    setError(null);
    setNotice(null);
    try {
      await deleteLiability(liability.id);
      setDeleteTarget(null);
      setNotice("Liability deleted successfully.");
      await refreshDashboard();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete liability");
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
          <PageHeader title="Liabilities" description="Executive liability dashboard with debt concentration, EMI pressure, and repayment intelligence." />
          <Button onClick={() => { setEditingLiability(null); setDialogOpen(true); }} disabled={submitting}>
            Add Liability
          </Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <LiabilitySummary liabilities={filteredLiabilities} totalAssetBase={totalAssetBase} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {liabilitySummaryCards.map((bucket) => (
            <DashboardCard key={bucket.label}>
              <p className="text-sm font-medium text-slate-500">{bucket.label}</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(bucket.value, { maximumFractionDigits: 0 })}</p>
              <p className="mt-1 text-xs text-slate-500">{formatPercent(bucket.share, { digits: 1 })} of total liabilities</p>
            </DashboardCard>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <DashboardCard>
            <h3 className="text-base font-semibold text-slate-900">Liability Allocation</h3>
            <p className="mt-1 text-sm text-slate-600">Outstanding balance split by liability type</p>
            {allocationRows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
                Add liabilities to visualize debt allocation.
              </div>
            ) : (
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocationRows} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={2}>
                      {allocationRows.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardCard>

          <DashboardCard>
            <h3 className="text-base font-semibold text-slate-900">EMI Breakdown</h3>
            <p className="mt-1 text-sm text-slate-600">Monthly repayment pressure by liability type</p>
            {emiRows.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-600">
                Add EMI values to analyze monthly repayment obligations.
              </div>
            ) : (
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={emiRows}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => truncateLabel(String(value), 14)} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} />
                    <Bar dataKey="emi" radius={[10, 10, 0, 0]} fill="#0f172a">
                      {emiRows.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </DashboardCard>
        </div>

        <DashboardCard>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Liability portfolio register</h3>
              <p className="text-sm text-slate-600">Search, filter, sort, and manage liabilities from one unified module</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search liabilities" className="max-w-sm" />
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="paid_off">Paid Off</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All types</option>
                {LIABILITY_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={`${sortKey}:${sortDirection}`} onChange={(event) => {
                const [nextKey, nextDirection] = event.target.value.split(":") as [typeof sortKey, typeof sortDirection];
                setSortKey(nextKey);
                setSortDirection(nextDirection);
              }}>
                <option value="outstanding_amount:desc">Outstanding (High-Low)</option>
                <option value="outstanding_amount:asc">Outstanding (Low-High)</option>
                <option value="account_name:asc">Account (A-Z)</option>
                <option value="account_name:desc">Account (Z-A)</option>
                <option value="emi:desc">EMI (High-Low)</option>
                <option value="emi:asc">EMI (Low-High)</option>
                <option value="interest_rate:desc">Interest (High-Low)</option>
                <option value="interest_rate:asc">Interest (Low-High)</option>
                <option value="created_at:desc">Created (Newest)</option>
                <option value="created_at:asc">Created (Oldest)</option>
              </select>
            </div>
          </div>

          {loading ? <LoadingSpinner label="Loading liabilities..." /> : filteredLiabilities.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><h4 className="text-base font-semibold text-slate-900">No liabilities yet</h4><p className="mt-2 text-sm text-slate-600">Add your first liability to track debt, repayment obligations, and risk.</p></div> : <LiabilityTable liabilities={filteredLiabilities} onView={(liability) => setSelectedLiability(liability)} onEdit={(liability) => { setEditingLiability(liability); setDialogOpen(true); }} onDelete={(liability) => setDeleteTarget(liability)} />}
        </DashboardCard>
      </PageContainer>

      <LiabilityDetailsDialog liability={selectedLiability} open={Boolean(selectedLiability)} onOpenChange={(open) => { if (!open) setSelectedLiability(null); }} />

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingLiability(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingLiability ? "Edit liability" : "Add liability"}</DialogTitle>
          </DialogHeader>
          <LiabilityForm key={editingLiability?.id ?? "new-liability"} initialData={editingLiability} onSubmit={editingLiability ? handleUpdate : handleCreate} onCancel={() => { setDialogOpen(false); setEditingLiability(null); }} submitting={submitting} />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete liability</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this liability?</p>
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
