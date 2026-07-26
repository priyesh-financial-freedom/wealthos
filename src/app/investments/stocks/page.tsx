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
import { InvestmentDetailsDialog } from "@/components/investments/InvestmentDetailsDialog";
import { InvestmentMonthlyHistoryTable } from "@/components/investments/InvestmentMonthlyHistory";
import { InvestmentSummaryCard, formatSignedCurrency } from "@/components/investments/InvestmentSummaryCard";
import { StockForm, type StockFormValues } from "@/components/investments/stocks/StockForm";
import { StockHoldingsTable } from "@/components/investments/stocks/StockHoldingsTable";
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
import { createStock, deleteStockById, listStocks, updateStock } from "@/services/investments/stocks";
import type { Investment, InvestmentMonthlyHistory, InvestmentMonthlyHistoryInsert, InvestmentStatus } from "@/types/investment";

type StockSortKey =
  | "investment_name"
  | "owner"
  | "demat_account_number"
  | "isin"
  | "current_value"
  | "cost_value"
  | "gain_loss"
  | "monthly_change";

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

function sortStocks(rows: Investment[], key: StockSortKey, direction: "asc" | "desc") {
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

export default function StocksPage() {
  const router = useRouter();
  const [stocks, setStocks] = useState<Investment[]>([]);
  const [allHistoryRows, setAllHistoryRows] = useState<InvestmentMonthlyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dematFilter, setDematFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | InvestmentStatus>("all");
  const [sortKey, setSortKey] = useState<StockSortKey>("current_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedStock, setSelectedStock] = useState<Investment | null>(null);
  const [editingStock, setEditingStock] = useState<Investment | null>(null);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);

  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<Investment | null>(null);
  const [editingHistory, setEditingHistory] = useState<InvestmentMonthlyHistory | null>(null);
  const [historyForm, setHistoryForm] = useState<HistoryFormState>(defaultHistoryState);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadStocksData() {
    try {
      setLoading(true);
      const [stocksData, historyRows] = await Promise.all([listStocks(), getInvestmentMonthlyHistory()]);
      setStocks(stocksData);
      setAllHistoryRows(historyRows);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load stocks data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadStocksData();
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const stockIds = useMemo(() => new Set(stocks.map((stock) => stock.id)), [stocks]);

  const stockHistoryRows = useMemo(
    () => allHistoryRows.filter((row) => stockIds.has(row.investment_id)),
    [allHistoryRows, stockIds],
  );

  const summary = useMemo(() => {
    const totalValue = stocks.reduce((sum, stock) => sum + Number(stock.current_value ?? 0), 0);
    const investedCost = stocks.reduce((sum, stock) => sum + Number(stock.cost_value ?? stock.cost_basis ?? 0), 0);
    const gainLoss = totalValue - investedCost;
    const monthlyChange = stocks.reduce((sum, stock) => sum + Number(stock.monthly_change ?? 0), 0);

    return {
      holdingsCount: stocks.length,
      totalValue,
      investedCost,
      gainLoss,
      monthlyChange,
      uniqueIsinCount: new Set(stocks.map((stock) => (stock.isin ?? "").trim().toUpperCase()).filter(Boolean)).size,
      dematAccountCount: new Set(stocks.map((stock) => (stock.demat_account_number ?? "").trim()).filter(Boolean)).size,
      ownerCount: new Set(stocks.map((stock) => (stock.owner ?? "").trim()).filter(Boolean)).size,
    };
  }, [stocks]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(stocks.map((stock) => (stock.owner ?? "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [stocks],
  );

  const dematOptions = useMemo(
    () => Array.from(new Set(stocks.map((stock) => (stock.demat_account_number ?? "").trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right)),
    [stocks],
  );

  const filteredStocks = useMemo(() => {
    const normalizedQuery = normalizeQuery(searchValue);

    const rows = stocks.filter((stock) => {
      const matchesQuery =
        normalizedQuery.length === 0
          || `${stock.investment_name} ${stock.owner ?? ""} ${stock.institution ?? ""} ${stock.isin ?? ""} ${stock.demat_account_number ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery);
      const matchesOwner = ownerFilter === "all" || stock.owner === ownerFilter;
      const matchesDemat = dematFilter === "all" || stock.demat_account_number === dematFilter;
      const matchesStatus = statusFilter === "all" || stock.status === statusFilter;

      return matchesQuery && matchesOwner && matchesDemat && matchesStatus;
    });

    return sortStocks(rows, sortKey, sortDirection);
  }, [dematFilter, ownerFilter, searchValue, sortDirection, sortKey, statusFilter, stocks]);

  const paginatedStocks = useMemo(
    () => filteredStocks.slice((page - 1) * pageSize, page * pageSize),
    [filteredStocks, page, pageSize],
  );

  const historyRowsForTarget = useMemo(() => {
    if (!historyTarget) {
      return [];
    }

    return stockHistoryRows.filter((row) => row.investment_id === historyTarget.id);
  }, [historyTarget, stockHistoryRows]);

  const topHoldings = useMemo(() => {
    return stocks
      .slice()
      .sort((left, right) => Number(right.current_value ?? 0) - Number(left.current_value ?? 0))
      .slice(0, 5);
  }, [stocks]);

  const sectorBreakdown = useMemo(() => {
    const grouped = stocks.reduce<Record<string, number>>((acc, stock) => {
      const key = (stock.sector ?? "Unspecified").trim() || "Unspecified";
      acc[key] = (acc[key] ?? 0) + Number(stock.current_value ?? 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((left, right) => right.value - left.value);
  }, [stocks]);

  const ownerAllocation = useMemo(() => {
    const grouped = stocks.reduce<Record<string, number>>((acc, stock) => {
      const key = (stock.owner ?? "Unspecified").trim() || "Unspecified";
      acc[key] = (acc[key] ?? 0) + Number(stock.current_value ?? 0);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value);
  }, [stocks]);

  const monthlyGrowthSeries = useMemo(() => {
    const grouped = stockHistoryRows.reduce<Record<string, number>>((acc, row) => {
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
  }, [stockHistoryRows]);

  async function handleSaveStock(values: StockFormValues) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const payload = {
      investment_name: values.investment_name,
      owner: values.owner,
      demat_account_provider: values.demat_account_provider || null,
      demat_account_number: values.demat_account_number,
      institution: values.institution || null,
      broker: values.broker || null,
      exchange: values.exchange || null,
      isin: values.isin,
      acquisition_date: values.acquisition_date || null,
      units: Number(values.units || 0),
      average_purchase_price: values.average_purchase_price === "" ? null : Number(values.average_purchase_price),
      cost_value: Number(values.cost_value || 0),
      current_value: Number(values.current_value || 0),
      status: values.status,
      notes: values.notes.trim() || null,
      sector: values.sector.trim() || null,
      documents_placeholder: serializeInvestmentDocuments({
        selectedTypes: values.documentsSelected,
        uploadedByType: values.documentsUploaded,
      }),
    };

    try {
      if (editingStock) {
        await updateStock({ id: editingStock.id, ...payload });
        setNotice("Stock updated successfully.");
      } else {
        await createStock(payload);
        setNotice("Stock added successfully.");
      }

      setStockDialogOpen(false);
      setEditingStock(null);
      await loadStocksData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save stock.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteStock(target: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteStockById(target.id);
      setDeleteTarget(null);
      setNotice("Stock deleted successfully.");
      await loadStocksData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete stock.");
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
      await loadStocksData();
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
      await loadStocksData();
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
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Investments", href: "/investments" }, { label: "Stocks" }]} />

        <PageToolbar>
          <PageHeader
            title="Stocks"
            description="Track equity holdings, month-end values, and supporting documents."
            summary={summary.holdingsCount > 0 ? `${summary.holdingsCount} Holdings Tracked` : undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setEditingStock(null);
                setStockDialogOpen(true);
              }}
              disabled={submitting}
            >
              Add Stock
            </Button>
            <Button variant="outline" onClick={() => router.push("/import-data")} disabled={submitting}>
              Import Stocks
            </Button>
          </div>
        </PageToolbar>

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading stocks...</div> : null}

        <ModuleKpiGrid>
          <InvestmentSummaryCard
            title="Current Market Value"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalValue, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Add your first stock to start tracking." : "Total equity market value"}
            icon="wallet"
          />
          <InvestmentSummaryCard
            title="Invested Cost"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.investedCost, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Capture purchase values per stock." : "Total purchase cost across holdings"}
            icon="allocation"
          />
          <InvestmentSummaryCard
            title="Unrealized Gain / Loss"
            value={summary.holdingsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.gainLoss)}
            subtitle={summary.holdingsCount === 0 ? "Value change appears after adding holdings." : "Current value minus invested cost"}
            icon="change"
            tone={summary.gainLoss >= 0 ? "positive" : "warning"}
          />
          <InvestmentSummaryCard
            title="Monthly Change"
            value={summary.holdingsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.monthlyChange)}
            subtitle={summary.holdingsCount === 0 ? "Update month-end values to view this." : "Change versus previous month-end"}
            icon="count"
            tone={summary.monthlyChange >= 0 ? "positive" : "warning"}
          />
          <InvestmentSummaryCard
            title="Unique ISINs"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : `${summary.uniqueIsinCount}`}
            subtitle={summary.holdingsCount === 0 ? "ISIN diversity appears after adding holdings." : "Distinct securities tracked"}
            icon="count"
          />
          <InvestmentSummaryCard
            title="Demat Accounts"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : `${summary.dematAccountCount}`}
            subtitle={summary.holdingsCount === 0 ? "Add holdings to map demat accounts." : `${summary.ownerCount} Owner${summary.ownerCount === 1 ? "" : "s"} across accounts`}
            icon="allocation"
          />
        </ModuleKpiGrid>

        <div className="grid gap-4 xl:grid-cols-2">
          <ModuleInsightPanel title="Allocation by Owner" description="Distribution of current value across owners.">
            {ownerAllocation.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Add stocks to view owner allocation.</div>
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

          <ModuleInsightPanel title="Monthly Portfolio Growth" description="Month-end value history for stock holdings.">
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

        <ModuleInsightPanel title="Top Holdings" description="Largest stock positions by current value.">
          {topHoldings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No holdings yet.</div>
          ) : (
            <div className="space-y-2">
              {topHoldings.map((stock) => (
                <div key={stock.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{stock.investment_name}</p>
                    <p className="text-slate-600">{stock.owner ?? "-"}</p>
                  </div>
                  <p className="font-semibold text-slate-900">{formatCurrency(stock.current_value, { maximumFractionDigits: 0 })}</p>
                </div>
              ))}
            </div>
          )}
        </ModuleInsightPanel>

        <ModuleInsightPanel title="Sector Allocation" description="Current value distribution by sector.">
          {sectorBreakdown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Add stocks and sector tags to view allocation.</div>
          ) : (
            <div className="space-y-2">
              {sectorBreakdown.map((item) => {
                const share = summary.totalValue > 0 ? (item.value / summary.totalValue) * 100 : 0;

                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-slate-600">{share.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-slate-800" style={{ width: `${Math.min(100, share)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ModuleInsightPanel>

        {stocks.length === 0 ? (
          <ContentContainer>
            <ModuleOnboardingState
              title="No Stock Holdings Yet"
              description="Add your first stock to start tracking performance, documents, and month-end history."
              steps={["Add Stock", "Attach Documents", "Update Month-End Values"]}
            />
          </ContentContainer>
        ) : null}

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <StockHoldingsTable
            rows={paginatedStocks}
            totalRows={filteredStocks.length}
            searchValue={searchValue}
            ownerFilter={ownerFilter}
            dematFilter={dematFilter}
            statusFilter={statusFilter}
            ownerOptions={ownerOptions}
            dematOptions={dematOptions}
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
            onDematFilterChange={(value) => {
              setDematFilter(value);
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
            onAddStock={() => {
              setEditingStock(null);
              setStockDialogOpen(true);
            }}
            onView={setSelectedStock}
            onEdit={(row) => {
              setEditingStock(row);
              setStockDialogOpen(true);
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
        investment={selectedStock}
        totalPortfolioValue={summary.totalValue}
        open={Boolean(selectedStock)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStock(null);
          }
        }}
      />

      <Dialog
        open={stockDialogOpen}
        onOpenChange={(open) => {
          setStockDialogOpen(open);
          if (!open) {
            setEditingStock(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingStock ? "Edit Stock" : "Add Stock"}</DialogTitle>
          </DialogHeader>

          <StockForm
            initialData={editingStock}
            onSubmit={handleSaveStock}
            onCancel={() => {
              setStockDialogOpen(false);
              setEditingStock(null);
            }}
            submitting={submitting}
            submitLabel={editingStock ? "Save changes" : "Add Stock"}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete stock</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this stock holding?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDeleteStock(deleteTarget)} disabled={submitting}>
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
