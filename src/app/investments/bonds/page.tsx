"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { BondForm, type BondFormValues } from "@/components/investments/bonds/BondForm";
import { BondHoldingsTable } from "@/components/investments/bonds/BondHoldingsTable";
import { serializeInvestmentDocuments } from "@/components/investments/documents";
import { InvestmentDetailsDialog } from "@/components/investments/InvestmentDetailsDialog";
import { InvestmentMonthlyHistoryTable } from "@/components/investments/InvestmentMonthlyHistory";
import { InvestmentSummaryCard, formatSignedCurrency } from "@/components/investments/InvestmentSummaryCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastViewport } from "@/components/ui/feedback";
import { ModuleInsightPanel, ModuleKpiGrid, ModuleOnboardingState } from "@/components/ui/module-design-system";
import { formatCurrency } from "@/lib/formatters";
import {
  createInvestmentMonthlyHistory,
  deleteInvestmentMonthlyHistory,
  getInvestmentMonthlyHistory,
  updateInvestmentMonthlyHistory,
} from "@/services/investments";
import { computeBondDerivedValues, createBond, deleteBond, listBonds, updateBond, type BondCouponFrequency } from "@/services/investments/bonds";
import type { Investment, InvestmentMonthlyHistory, InvestmentMonthlyHistoryInsert, InvestmentStatus } from "@/types/investment";

type BondSortKey =
  | "bond_name"
  | "issuer"
  | "owner"
  | "isin"
  | "bond_type"
  | "current_value"
  | "cost_value"
  | "maturity_date"
  | "coupon_rate";

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

const CHART_COLORS = ["#1d4ed8", "#0f766e", "#f59e0b", "#7c3aed", "#db2777", "#14b8a6", "#64748b"];

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function safeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function valueBySortKey(item: Investment, key: BondSortKey) {
  switch (key) {
    case "bond_name":
      return item.bond_name ?? item.investment_name;
    case "issuer":
      return item.issuer ?? item.institution ?? "";
    case "owner":
      return item.owner ?? "";
    case "isin":
      return item.isin ?? "";
    case "bond_type":
      return item.bond_type ?? "";
    case "current_value":
      return Number(item.current_value ?? 0);
    case "cost_value":
      return Number(item.cost_value ?? item.cost_basis ?? 0);
    case "maturity_date":
      return item.maturity_date ?? "";
    case "coupon_rate":
      return Number(item.coupon_rate ?? 0);
    default:
      return "";
  }
}

function sortRows(rows: Investment[], key: BondSortKey, direction: "asc" | "desc") {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = valueBySortKey(left, key);
    const rightValue = valueBySortKey(right, key);

    if (typeof leftValue === "string" && typeof rightValue === "string") {
      return leftValue.localeCompare(rightValue) * multiplier;
    }

    return (Number(leftValue ?? 0) - Number(rightValue ?? 0)) * multiplier;
  });
}

function monthLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(parsed);
}

function derivedFor(row: Investment) {
  return computeBondDerivedValues({
    faceValue: Number(row.face_value ?? 0),
    quantity: Number(row.units ?? 0),
    purchasePrice: Number(row.purchase_price ?? row.average_purchase_price ?? 0),
    currentMarketPrice: row.current_market_price ?? row.nav_price,
    couponRate: Number(row.coupon_rate ?? 0),
    couponFrequency: (row.coupon_frequency as BondCouponFrequency | null) ?? "Annual",
    purchaseDate: row.purchase_date ?? row.acquisition_date ?? new Date().toISOString().slice(0, 10),
    maturityDate: row.maturity_date ?? row.purchase_date ?? new Date().toISOString().slice(0, 10),
  });
}

export default function BondsPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Investment[]>([]);
  const [allHistoryRows, setAllHistoryRows] = useState<InvestmentMonthlyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [issuerFilter, setIssuerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | InvestmentStatus>("all");
  const [sortKey, setSortKey] = useState<BondSortKey>("current_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedHolding, setSelectedHolding] = useState<Investment | null>(null);
  const [editingHolding, setEditingHolding] = useState<Investment | null>(null);
  const [holdingDialogOpen, setHoldingDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Investment | null>(null);
  const [editingHistory, setEditingHistory] = useState<InvestmentMonthlyHistory | null>(null);
  const [historyForm, setHistoryForm] = useState<HistoryFormState>(defaultHistoryState);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [holdingsData, historyRows] = await Promise.all([listBonds(), getInvestmentMonthlyHistory()]);
      setHoldings(holdingsData);
      setAllHistoryRows(historyRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load bonds data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadData();
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const holdingIds = useMemo(() => new Set(holdings.map((item) => item.id)), [holdings]);

  const historyRows = useMemo(
    () => allHistoryRows.filter((row) => holdingIds.has(row.investment_id)),
    [allHistoryRows, holdingIds],
  );

  const summary = useMemo(() => {
    const totalValue = holdings.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
    const totalInvested = holdings.reduce((sum, item) => sum + Number(item.cost_value ?? item.cost_basis ?? 0), 0);
    const totalGainLoss = totalValue - totalInvested;
    const totalAccruedInterest = holdings.reduce((sum, item) => sum + derivedFor(item).accruedInterest, 0);
    const totalAnnualCouponIncome = holdings.reduce((sum, item) => sum + derivedFor(item).annualCouponIncome, 0);
    const weightedDaysToMaturity = holdings.length === 0
      ? 0
      : Math.round(holdings.reduce((sum, item) => sum + derivedFor(item).daysToMaturity, 0) / holdings.length);
    const monthlyChange = holdings.reduce((sum, item) => sum + Number(item.monthly_change ?? 0), 0);

    return {
      holdingsCount: holdings.length,
      totalValue,
      totalInvested,
      totalGainLoss,
      totalAccruedInterest,
      totalAnnualCouponIncome,
      weightedDaysToMaturity,
      monthlyChange,
      uniqueIssuers: new Set(holdings.map((item) => safeText(item.issuer ?? item.institution)).filter(Boolean)).size,
    };
  }, [holdings]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(holdings.map((item) => safeText(item.owner)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [holdings],
  );

  const issuerOptions = useMemo(
    () => Array.from(new Set(holdings.map((item) => safeText(item.issuer ?? item.institution)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [holdings],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeQuery(searchValue);

    const rows = holdings.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0
          || `${item.bond_name ?? item.investment_name} ${item.issuer ?? item.institution ?? ""} ${item.owner ?? ""} ${item.isin ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery);
      const matchesOwner = ownerFilter === "all" || item.owner === ownerFilter;
      const issuerValue = safeText(item.issuer ?? item.institution);
      const matchesIssuer = issuerFilter === "all" || issuerValue === issuerFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesQuery && matchesOwner && matchesIssuer && matchesStatus;
    });

    return sortRows(rows, sortKey, sortDirection);
  }, [holdings, issuerFilter, ownerFilter, searchValue, sortDirection, sortKey, statusFilter]);

  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );

  const historyRowsForTarget = useMemo(() => {
    if (!historyTarget) {
      return [];
    }

    return historyRows.filter((row) => row.investment_id === historyTarget.id);
  }, [historyRows, historyTarget]);

  const ownerAllocation = useMemo(() => {
    const grouped = holdings.reduce<Record<string, number>>((acc, item) => {
      const key = safeText(item.owner) || "Unspecified";
      acc[key] = (acc[key] ?? 0) + Number(item.current_value ?? 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value);
  }, [holdings]);

  const monthlyGrowthSeries = useMemo(() => {
    const grouped = historyRows.reduce<Record<string, number>>((acc, row) => {
      const key = row.month_end_date;
      acc[key] = (acc[key] ?? 0) + Number(row.closing_value ?? 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([left], [right]) => new Date(left).getTime() - new Date(right).getTime())
      .map(([date, value]) => ({
        date,
        label: monthLabel(date),
        value,
      }));
  }, [historyRows]);

  async function handleSaveHolding(values: BondFormValues) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const payload = {
      issuer: values.issuer.trim(),
      bond_name: values.bond_name.trim(),
      bond_type: values.bond_type,
      isin: values.isin.trim() || null,
      face_value: Number(values.face_value || 0),
      quantity: Number(values.quantity || 0),
      purchase_price: Number(values.purchase_price || 0),
      current_market_price: values.current_market_price === "" ? null : Number(values.current_market_price),
      coupon_rate: Number(values.coupon_rate || 0),
      coupon_frequency: values.coupon_frequency,
      purchase_date: values.purchase_date,
      maturity_date: values.maturity_date,
      owner: values.owner.trim(),
      broker: values.broker.trim() || null,
      status: values.status,
      notes: values.notes.trim() || null,
      documents_placeholder: serializeInvestmentDocuments({
        selectedTypes: values.documentsSelected,
        uploadedByType: values.documentsUploaded,
      }),
    };

    try {
      if (editingHolding) {
        await updateBond({ id: editingHolding.id, ...payload });
        setNotice("Bond updated successfully.");
      } else {
        await createBond(payload);
        setNotice("Bond added successfully.");
      }

      setHoldingDialogOpen(false);
      setEditingHolding(null);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save bond.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteHolding(target: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteBond(target.id);
      setDeleteTarget(null);
      setNotice("Bond deleted successfully.");
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete bond.");
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
        await updateInvestmentMonthlyHistory({ id: editingHistory.id, ...payload });
        setNotice("Month-end history updated.");
      } else {
        await createInvestmentMonthlyHistory(payload);
        setNotice("Month-end history added.");
      }

      setEditingHistory(null);
      setHistoryForm(defaultHistoryState);
      await loadData();
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
      await loadData();
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
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Investments", href: "/investments" }, { label: "Bonds" }]} />

        <PageToolbar>
          <PageHeader
            title="Bonds"
            description="Track issuer exposure, coupon income, and maturity schedule across fixed-income holdings."
            summary={summary.holdingsCount > 0 ? `${summary.holdingsCount} Holdings Tracked` : undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setEditingHolding(null);
                setHoldingDialogOpen(true);
              }}
              disabled={submitting}
            >
              Add Bond
            </Button>
            <Button variant="outline" onClick={() => router.push("/import-data")} disabled={submitting}>
              Import Bonds
            </Button>
          </div>
        </PageToolbar>

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading bonds...</div> : null}

        <ModuleKpiGrid>
          <InvestmentSummaryCard
            title="Current Value"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalValue, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Add your first bond to start tracking." : "Total current market value"}
            icon="wallet"
          />
          <InvestmentSummaryCard
            title="Total Invested"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalInvested, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Invested amount appears after adding holdings." : "Purchase value across holdings"}
            icon="allocation"
          />
          <InvestmentSummaryCard
            title="Unrealized Gain / Loss"
            value={summary.holdingsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.totalGainLoss)}
            subtitle={summary.holdingsCount === 0 ? "Value change appears after adding holdings." : "Current value minus invested value"}
            icon="change"
            tone={summary.totalGainLoss >= 0 ? "positive" : "warning"}
          />
          <InvestmentSummaryCard
            title="Accrued Interest"
            value={summary.holdingsCount === 0 ? "No Accrual Yet" : formatCurrency(summary.totalAccruedInterest, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Accrued interest appears after adding holdings." : "Estimated coupon accrual to date"}
            icon="count"
          />
          <InvestmentSummaryCard
            title="Annual Coupon Income"
            value={summary.holdingsCount === 0 ? "No Income Yet" : formatCurrency(summary.totalAnnualCouponIncome, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Coupon income appears after adding holdings." : "Annualized coupon payout estimate"}
            icon="allocation"
          />
          <InvestmentSummaryCard
            title="Avg Days to Maturity"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : `${summary.weightedDaysToMaturity}`}
            subtitle={summary.holdingsCount === 0 ? "Maturity horizon appears after adding holdings." : `${summary.uniqueIssuers} unique issuer${summary.uniqueIssuers === 1 ? "" : "s"}`}
            icon="count"
          />
        </ModuleKpiGrid>

        <div className="grid gap-4 xl:grid-cols-2">
          <ModuleInsightPanel title="Allocation by Owner" description="Distribution of current value across owners.">
            {ownerAllocation.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Add bonds to view owner allocation.</div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ownerAllocation} dataKey="value" nameKey="name" innerRadius={60} outerRadius={96}>
                      {ownerAllocation.map((entry, index) => (
                        <Cell key={`${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} labelFormatter={(value) => String(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </ModuleInsightPanel>

          <ModuleInsightPanel title="Monthly Portfolio Growth" description="Month-end value history for bonds.">
            {monthlyGrowthSeries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Add month-end values to view trend.</div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyGrowthSeries}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), { maximumFractionDigits: 0 })} labelFormatter={(value) => String(value)} />
                    <Line type="monotone" dataKey="value" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </ModuleInsightPanel>
        </div>

        <ModuleInsightPanel title="Monthly Change" description="Aggregate month-over-month bond value movement.">
          <p className={`text-2xl font-semibold ${summary.monthlyChange >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {summary.holdingsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.monthlyChange)}
          </p>
        </ModuleInsightPanel>

        {holdings.length === 0 ? (
          <ContentContainer>
            <ModuleOnboardingState
              title="No Bonds Yet"
              description="Add your first bond to track coupon accrual, maturity timeline, and month-end history."
              steps={["Add Bond", "Import Bonds", "Update Month-End Values"]}
            />
          </ContentContainer>
        ) : null}

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <BondHoldingsTable
            rows={paginatedRows}
            totalRows={filteredRows.length}
            searchValue={searchValue}
            ownerFilter={ownerFilter}
            issuerFilter={issuerFilter}
            statusFilter={statusFilter}
            ownerOptions={ownerOptions}
            issuerOptions={issuerOptions}
            sortKey={sortKey}
            sortDirection={sortDirection}
            page={page}
            pageSize={pageSize}
            submitting={submitting}
            onSearchChange={(value) => {
              setSearchValue(value);
              setPage(1);
            }}
            onOwnerFilterChange={(value) => {
              setOwnerFilter(value);
              setPage(1);
            }}
            onIssuerFilterChange={(value) => {
              setIssuerFilter(value);
              setPage(1);
            }}
            onStatusFilterChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            onSortChange={(nextKey, nextDirection) => {
              setSortKey(nextKey);
              setSortDirection(nextDirection);
              setPage(1);
            }}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            onAddBond={() => {
              setEditingHolding(null);
              setHoldingDialogOpen(true);
            }}
            onView={setSelectedHolding}
            onEdit={(row) => {
              setEditingHolding(row);
              setHoldingDialogOpen(true);
            }}
            onOpenHistory={(row) => {
              setHistoryTarget(row);
              setEditingHistory(null);
              setHistoryForm(defaultHistoryState);
              setHistoryDialogOpen(true);
            }}
            onDelete={setDeleteTarget}
          />
        </ContentContainer>
      </PageContainer>

      <InvestmentDetailsDialog
        investment={selectedHolding}
        totalPortfolioValue={summary.totalValue}
        open={Boolean(selectedHolding)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedHolding(null);
          }
        }}
      />

      <Dialog
        open={holdingDialogOpen}
        onOpenChange={(open) => {
          setHoldingDialogOpen(open);
          if (!open) {
            setEditingHolding(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingHolding ? "Edit Bond" : "Add Bond"}</DialogTitle>
          </DialogHeader>

          <BondForm
            initialData={editingHolding}
            onSubmit={handleSaveHolding}
            onCancel={() => {
              setHoldingDialogOpen(false);
              setEditingHolding(null);
            }}
            submitting={submitting}
            submitLabel={editingHolding ? "Save changes" : "Add Bond"}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete bond</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this bond holding?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDeleteHolding(deleteTarget)} disabled={submitting}>
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
            <DialogTitle>{historyTarget ? `Monthly History · ${historyTarget.bond_name ?? historyTarget.investment_name}` : "Monthly History"}</DialogTitle>
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
              value={historyForm.closing_value}
              onChange={(event) => setHistoryForm((current) => ({ ...current, closing_value: event.target.value }))}
              placeholder="Closing value"
              required
            />
            <input
              type="text"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={historyForm.notes}
              onChange={(event) => setHistoryForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Notes"
            />
            <Button type="submit" disabled={submitting || !historyTarget}>
              {editingHistory ? "Save" : "Add"}
            </Button>
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
