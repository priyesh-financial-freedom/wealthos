"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { GoldForm, type GoldFormValues } from "@/components/investments/gold/GoldForm";
import { GoldHoldingsTable } from "@/components/investments/gold/GoldHoldingsTable";
import { InvestmentDetailsDialog } from "@/components/investments/InvestmentDetailsDialog";
import { InvestmentSummaryCard, formatSignedCurrency } from "@/components/investments/InvestmentSummaryCard";
import { serializeInvestmentDocuments } from "@/components/investments/documents";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastViewport } from "@/components/ui/feedback";
import { ModuleKpiGrid, ModuleOnboardingState } from "@/components/ui/module-design-system";
import { formatCurrency } from "@/lib/formatters";
import { computeGoldValues, createGoldHolding, deleteGoldHolding, listGoldHoldings, updateGoldHolding } from "@/services/investments/gold";
import type { Investment, InvestmentStatus } from "@/types/investment";

type GoldSortKey =
  | "investment_name"
  | "gold_type"
  | "units"
  | "average_purchase_price"
  | "current_value"
  | "owner";

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function safeText(value: string | null | undefined) {
  return (value ?? "").trim();
}

function valueBySortKey(item: Investment, key: GoldSortKey) {
  switch (key) {
    case "investment_name":
      return item.investment_name;
    case "gold_type":
      return item.gold_type ?? "";
    case "units":
      return Number(item.units ?? 0);
    case "average_purchase_price":
      return Number(item.average_purchase_price ?? item.purchase_price ?? 0);
    case "current_value":
      return Number(item.current_value ?? 0);
    case "owner":
      return item.owner ?? "";
    default:
      return "";
  }
}

function sortRows(rows: Investment[], key: GoldSortKey, direction: "asc" | "desc") {
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

export default function GoldPage() {
  const router = useRouter();
  const [holdings, setHoldings] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | InvestmentStatus>("all");
  const [sortKey, setSortKey] = useState<GoldSortKey>("current_value");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedHolding, setSelectedHolding] = useState<Investment | null>(null);
  const [editingHolding, setEditingHolding] = useState<Investment | null>(null);
  const [holdingDialogOpen, setHoldingDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const data = await listGoldHoldings();
      setHoldings(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load gold holdings.");
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

  const summary = useMemo(() => {
    const totalInvested = holdings.reduce((sum, item) => {
      const values = computeGoldValues({
        quantity: Number(item.units ?? 0),
        purchasePrice: Number(item.average_purchase_price ?? item.purchase_price ?? 0),
        currentValue: item.current_value,
      });
      return sum + values.totalInvested;
    }, 0);

    const totalCurrentValue = holdings.reduce((sum, item) => sum + Number(item.current_value ?? 0), 0);
    const gainLoss = totalCurrentValue - totalInvested;

    return {
      totalCurrentValue,
      totalInvested,
      gainLoss,
      holdingsCount: holdings.length,
    };
  }, [holdings]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(holdings.map((item) => safeText(item.owner)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [holdings],
  );

  const typeOptions = useMemo(
    () => Array.from(new Set(holdings.map((item) => safeText(item.gold_type)).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [holdings],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeQuery(searchValue);

    const rows = holdings.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0
          || `${item.investment_name} ${item.gold_type ?? ""} ${item.owner ?? ""} ${item.storage_location ?? ""}`
            .toLowerCase()
            .includes(normalizedQuery);
      const matchesOwner = ownerFilter === "all" || item.owner === ownerFilter;
      const matchesType = typeFilter === "all" || item.gold_type === typeFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesQuery && matchesOwner && matchesType && matchesStatus;
    });

    return sortRows(rows, sortKey, sortDirection);
  }, [holdings, ownerFilter, searchValue, sortDirection, sortKey, statusFilter, typeFilter]);

  const paginatedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );

  async function handleSaveHolding(values: GoldFormValues) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const payload = {
      asset_name: values.asset_name.trim(),
      gold_type: values.gold_type,
      quantity: Number(values.quantity || 0),
      unit: values.unit,
      purchase_price: Number(values.purchase_price || 0),
      current_value: values.current_value === "" ? null : Number(values.current_value),
      purchase_date: values.purchase_date,
      owner: values.owner.trim(),
      storage_location: values.storage_location.trim() || null,
      status: values.status,
      notes: values.notes.trim() || null,
      documents_placeholder: serializeInvestmentDocuments({
        selectedTypes: values.documentsSelected,
        uploadedByType: values.documentsUploaded,
      }),
    };

    try {
      if (editingHolding) {
        await updateGoldHolding({ id: editingHolding.id, ...payload });
        setNotice("Gold holding updated successfully.");
      } else {
        await createGoldHolding(payload);
        setNotice("Gold holding added successfully.");
      }

      setHoldingDialogOpen(false);
      setEditingHolding(null);
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save gold holding.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteHolding(target: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      await deleteGoldHolding(target.id);
      setDeleteTarget(null);
      setNotice("Gold holding deleted successfully.");
      await loadData();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete gold holding.");
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
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Investments", href: "/investments" }, { label: "Gold" }]} />

        <PageToolbar>
          <PageHeader
            title="Gold"
            description="Track gold holdings across physical, ETF, fund, SGB, and digital formats."
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
              Add Gold Holding
            </Button>
            <Button variant="outline" onClick={() => router.push("/investments")} disabled={submitting}>
              Back to Investments
            </Button>
          </div>
        </PageToolbar>

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading gold holdings...</div> : null}

        <ModuleKpiGrid>
          <InvestmentSummaryCard
            title="Total Gold Value"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalCurrentValue, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Add your first gold holding to start tracking." : "Total current value across all gold holdings"}
            icon="wallet"
          />
          <InvestmentSummaryCard
            title="Total Invested"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalInvested, { maximumFractionDigits: 0 })}
            subtitle={summary.holdingsCount === 0 ? "Invested amount appears after adding holdings." : "Total purchase value across holdings"}
            icon="allocation"
          />
          <InvestmentSummaryCard
            title="Gain / Loss"
            value={summary.holdingsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.gainLoss)}
            subtitle={summary.holdingsCount === 0 ? "Value change appears after adding holdings." : "Current value minus invested value"}
            icon="change"
            tone={summary.gainLoss >= 0 ? "positive" : "warning"}
          />
          <InvestmentSummaryCard
            title="Number of Holdings"
            value={summary.holdingsCount === 0 ? "No Holdings Yet" : `${summary.holdingsCount}`}
            subtitle={summary.holdingsCount === 0 ? "Create your first gold position." : "Active gold holdings"}
            icon="count"
          />
        </ModuleKpiGrid>

        {holdings.length === 0 ? (
          <ContentContainer>
            <ModuleOnboardingState
              title="No Gold Holdings Yet"
              description="Add your first gold holding with valuation, documents, and notes."
              steps={["Add Gold Holding", "Attach Documents", "Track Valuation"]}
            />
          </ContentContainer>
        ) : null}

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <GoldHoldingsTable
            rows={paginatedRows}
            totalRows={filteredRows.length}
            searchValue={searchValue}
            ownerFilter={ownerFilter}
            typeFilter={typeFilter}
            statusFilter={statusFilter}
            ownerOptions={ownerOptions}
            typeOptions={typeOptions}
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
            onTypeFilterChange={(value) => {
              setTypeFilter(value);
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
            onDelete={setDeleteTarget}
          />
        </ContentContainer>
      </PageContainer>

      <InvestmentDetailsDialog
        investment={selectedHolding}
        totalPortfolioValue={summary.totalCurrentValue}
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
            <DialogTitle>{editingHolding ? "Edit Gold Holding" : "Add Gold Holding"}</DialogTitle>
          </DialogHeader>

          <GoldForm
            initialData={editingHolding}
            onSubmit={handleSaveHolding}
            onCancel={() => {
              setHoldingDialogOpen(false);
              setEditingHolding(null);
            }}
            submitting={submitting}
            submitLabel={editingHolding ? "Save changes" : "Add Gold Holding"}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete gold holding</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to remove this gold holding?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDeleteHolding(deleteTarget)} disabled={submitting}>
              {submitting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
