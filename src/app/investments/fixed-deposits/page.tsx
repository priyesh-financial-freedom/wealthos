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

import { serializeInvestmentDocuments } from "@/components/investments/documents";
import { FixedDepositForm, type FixedDepositFormValues } from "@/components/investments/fixedDeposits/FixedDepositForm";
import { FixedDepositHoldingsTable } from "@/components/investments/fixedDeposits/FixedDepositHoldingsTable";
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
import {
  createFixedDepositHolding,
  deleteFixedDepositHolding,
  listFixedDeposits,
  updateFixedDepositHolding,
} from "@/services/investments/fixedDeposits";
import type { Investment, InvestmentMonthlyHistory, InvestmentMonthlyHistoryInsert, InvestmentStatus } from "@/types/investment";

type FixedDepositSortKey =
  | "investment_name"
  | "owner"
  | "institution"
  | "fd_number"
  | "current_value"
  | "cost_value"
  | "interest_rate"
  | "maturity_value";

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

function sortRows(rows: Investment[], key: FixedDepositSortKey, direction: "asc" | "desc") {
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

function monthLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(parsed);
}

export default function FixedDepositsPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Investment[]>([]);
  const [allHistoryRows, setAllHistoryRows] = useState<InvestmentMonthlyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | InvestmentStatus>("all");
  const [sortKey, setSortKey] = useState<FixedDepositSortKey>("current_value");
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
      const [holdingsData, historyRows] = await Promise.all([listFixedDeposits(), getInvestmentMonthlyHistory()]);
      setHoldings(holdingsData);
      setAllHistoryRows(historyRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load fixed deposits data.");
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
    const totalPrincipal = holdings.reduce((sum, item) => sum + Number(item.cost_value ?? item.cost_basis ?? 0), 0);
    const totalAccruedInterest = totalValue - totalPrincipal;
    const totalMaturityValue = holdings.reduce((sum, item) => sum + Number(item.maturity_value ?? item.current_value ?? 0), 0);
    const monthlyChange = holdings.reduce((sum, item) => sum + Number(item.monthly_change ?? 0), 0);

    return {
      holdingsCount: holdings.length,
      totalValue,
      totalPrincipal,
      totalAccruedInterest,
      totalMaturityValue,
      monthlyChange,
      uniqueBanks: new Set(holdings.map((item) => (item.institution ?? "").trim()).filter(Boolean)).size,
    };
  }, [holdings]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(holdings.map((item) => (item.owner ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [holdings],
  );

  const institutionOptions = useMemo(
    () => Array.from(new Set(holdings.map((item) => (item.institution ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [holdings],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeQuery(searchValue);

    const rows = holdings.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0
          || `${item.investment_name} ${item.owner ?? ""} ${item.institution ?? ""} ${item.fd_number ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery);
      const matchesOwner = ownerFilter === "all" || item.owner === ownerFilter;
      const matchesInstitution = institutionFilter === "all" || item.institution === institutionFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesQuery && matchesOwner && matchesInstitution && matchesStatus;
    });

    return sortRows(rows, sortKey, sortDirection);
  }, [holdings, institutionFilter, ownerFilter, searchValue, sortDirection, sortKey, statusFilter]);

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
      const key = (item.owner ?? "Unspecified").trim() || "Unspecified";
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

  async function handleSaveHolding(values: FixedDepositFormValues) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const payload = {
      investment_name: values.investment_name.trim() || null,
      owner: values.owner.trim(),
      institution: values.institution.trim(),
      fd_number: values.fd_number.trim(),
      principal: Number(values.principal || 0),
      interest_rate: Number(values.interest_rate || 0),
      compounding_frequency: values.compounding_frequency,
      payout_type: values.payout_type,
      start_date: values.start_date,
      maturity_date: values.maturity_date,
      status: values.status,
      notes: values.notes.trim() || null,
      documents_placeholder: serializeInvestmentDocuments({
        selectedTypes: values.documentsSelected,
        uploadedByType: values.documentsUploaded,
      }),
    };

    try {
      if (editingHolding) {
        await updateFixedDepositHolding({ id: editingHolding.id, ...payload });
        setNotice("Fixed Deposit updated successfully.");
      } else {
        await createFixedDepositHolding(payload);
        setNotice("Fixed Deposit added successfully.");
      }

      setHoldingDialogOpen(false);
      setEditingHolding(null);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save fixed deposit.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteHolding(target: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteFixedDepositHolding(target.id);
      setDeleteTarget(null);
      setNotice("Fixed Deposit deleted successfully.");
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete fixed deposit.");
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
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Investments", href: "/investments" }, { label: "Fixed Deposits" }]} />

        <PageToolbar>
          <PageHeader
            title="Fixed Deposits"
            description="Track principal, interest accrual, maturity value, and month-end snapshots."
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
              Add Fixed Deposit
            </Button>
            <Button variant="outline" onClick={() => router.push("/import-data")} disabled={submitting}>
              Import Fixed Deposits
            </Button>
          </div>
        </PageToolbar>

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading fixed deposits...</div> : null}

        <ModuleKpiGrid>
          <InvestmentSummaryCard
            title="Current Value"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalValue, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Add your first deposit to start tracking." : "Current aggregate value"}
            icon="wallet"
          />
          <InvestmentSummaryCard
            title="Principal"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalPrincipal, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Principal appears after adding holdings." : "Total principal invested"}
            icon="allocation"
          />
          <InvestmentSummaryCard
            title="Accrued Interest"
            value={summary.holdingsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.totalAccruedInterest)}
            subtitle={summary.holdingsCount === 0 ? "Accrual appears after adding holdings." : "Current value minus principal"}
            icon="change"
            tone={summary.totalAccruedInterest >= 0 ? "positive" : "warning"}
          />
          <InvestmentSummaryCard
            title="Projected Maturity Value"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalMaturityValue, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Projection appears after adding holdings." : "Total projected maturity amount"}
            icon="count"
          />
          <InvestmentSummaryCard
            title="Monthly Change"
            value={summary.holdingsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.monthlyChange)}
            subtitle={summary.holdingsCount === 0 ? "Update month-end values to view this." : "Change versus previous month-end"}
            icon="change"
            tone={summary.monthlyChange >= 0 ? "positive" : "warning"}
          />
          <InvestmentSummaryCard
            title="Banks"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : `${summary.uniqueBanks}`}
            subtitle={summary.holdingsCount === 0 ? "Bank diversity appears after adding holdings." : "Unique institutions tracked"}
            icon="count"
          />
        </ModuleKpiGrid>

        <div className="grid gap-4 xl:grid-cols-2">
          <ModuleInsightPanel title="Allocation by Owner" description="Distribution of current value across owners.">
            {ownerAllocation.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Add fixed deposits to view owner allocation.</div>
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

          <ModuleInsightPanel title="Monthly Portfolio Growth" description="Month-end value history for fixed deposits.">
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

        {holdings.length === 0 ? (
          <ContentContainer>
            <ModuleOnboardingState
              title="No Fixed Deposits Yet"
              description="Add your first fixed deposit to track accruals, documents, and month-end history."
              steps={["Add Fixed Deposit", "Import Fixed Deposits", "Update Month-End Values"]}
            />
          </ContentContainer>
        ) : null}

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <FixedDepositHoldingsTable
            rows={paginatedRows}
            totalRows={filteredRows.length}
            searchValue={searchValue}
            ownerFilter={ownerFilter}
            institutionFilter={institutionFilter}
            statusFilter={statusFilter}
            ownerOptions={ownerOptions}
            institutionOptions={institutionOptions}
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
            onInstitutionFilterChange={(value) => {
              setInstitutionFilter(value);
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
            onAddHolding={() => {
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
            <DialogTitle>{editingHolding ? "Edit Fixed Deposit" : "Add Fixed Deposit"}</DialogTitle>
          </DialogHeader>

          <FixedDepositForm
            initialData={editingHolding}
            onSubmit={handleSaveHolding}
            onCancel={() => {
              setHoldingDialogOpen(false);
              setEditingHolding(null);
            }}
            submitting={submitting}
            submitLabel={editingHolding ? "Save changes" : "Add Fixed Deposit"}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete fixed deposit</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this fixed deposit holding?</p>
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
