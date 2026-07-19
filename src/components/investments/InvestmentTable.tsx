"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataGrid, type DataGridSortDirection } from "@/components/ui/data-grid";
import { InvestmentCategoryBadge } from "@/components/investments/InvestmentCategoryBadge";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { Investment } from "@/types/investment";

type InvestmentSortKey = "name" | "category" | "current_value" | "gain_loss" | "cost_basis" | "nav_price";

interface InvestmentTableProps {
  investments: Investment[];
  totalPortfolioValue: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  categoryFilter: "all" | "Mutual Funds" | "Stocks";
  regionFilter: string;
  onRegionFilterChange: (value: string) => void;
  sortKey: InvestmentSortKey;
  sortDirection: DataGridSortDirection;
  onSortChange: (key: InvestmentSortKey, direction: DataGridSortDirection) => void;
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (investment: Investment) => void;
  onEdit: (investment: Investment) => void;
  onDelete: (investment: Investment) => void;
}

type InvestmentColumnKey =
  | "name"
  | "amc"
  | "folio_number"
  | "exchange"
  | "owner"
  | "units"
  | "average_purchase_price"
  | "nav_price"
  | "cost_basis"
  | "current_value"
  | "gain_loss"
  | "gain_percent"
  | "portfolio_weight"
  | "category"
  | "region"
  | "sip_amount"
  | "actions";

interface InvestmentColumnConfig {
  key: InvestmentColumnKey;
  label: string;
  cell: (investment: Investment) => React.ReactNode;
  sortable?: boolean;
  widthClassName?: string;
  className?: string;
  headerClassName?: string;
}

function getGainPercent(investment: Investment) {
  if (!Number.isFinite(investment.cost_basis) || investment.cost_basis <= 0) {
    return null;
  }

  return investment.gain_loss / investment.cost_basis;
}

function getAveragePurchasePrice(investment: Investment) {
  if (!Number.isFinite(investment.units) || investment.units <= 0) {
    return null;
  }

  return investment.cost_basis / investment.units;
}

function getPortfolioWeight(investment: Investment, totalPortfolioValue: number) {
  if (!Number.isFinite(totalPortfolioValue) || totalPortfolioValue <= 0) {
    return null;
  }

  return investment.current_value / totalPortfolioValue;
}

export function InvestmentTable({
  investments,
  totalPortfolioValue,
  searchValue,
  onSearchChange,
  categoryFilter,
  regionFilter,
  onRegionFilterChange,
  sortKey,
  sortDirection,
  onSortChange,
  page,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  onView,
  onEdit,
  onDelete,
}: InvestmentTableProps) {
  const allColumns: InvestmentColumnConfig[] = [
    { key: "name", label: "Investment Name", sortable: true, widthClassName: "min-w-56", className: "font-medium text-slate-900", cell: (investment) => investment.investment_name },
    { key: "amc", label: "AMC", widthClassName: "min-w-40", cell: (investment) => investment.amc ?? "—" },
    { key: "folio_number", label: "Folio Number", widthClassName: "min-w-40", cell: (investment) => investment.folio_number ?? "—" },
    { key: "exchange", label: "Exchange", widthClassName: "min-w-32", cell: (investment) => investment.exchange ?? "—" },
    { key: "owner", label: "Owner", widthClassName: "min-w-32", cell: (investment) => investment.owner ?? "—" },
    { key: "units", label: "Units", widthClassName: "min-w-32", cell: (investment) => formatNumber(investment.units) },
    {
      key: "average_purchase_price",
      label: "Avg Purchase Price",
      widthClassName: "min-w-40 text-slate-900",
      cell: (investment) => formatCurrency(getAveragePurchasePrice(investment), { maximumFractionDigits: 2 }),
    },
    { key: "nav_price", label: "Current Price", sortable: true, widthClassName: "min-w-32 text-slate-900", cell: (investment) => formatCurrency(investment.nav_price, { maximumFractionDigits: 2 }) },
    { key: "cost_basis", label: "Invested Value", sortable: true, widthClassName: "min-w-40 text-slate-900", cell: (investment) => formatCurrency(investment.cost_basis, { maximumFractionDigits: 0 }) },
    { key: "current_value", label: "Current Value", sortable: true, widthClassName: "min-w-40 text-slate-900", cell: (investment) => formatCurrency(investment.current_value, { maximumFractionDigits: 0 }) },
    { key: "gain_loss", label: "Gain/Loss", sortable: true, widthClassName: "min-w-36", className: "font-medium", cell: (investment) => <span className={investment.gain_loss >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatCurrency(investment.gain_loss, { maximumFractionDigits: 0 })}</span> },
    { key: "gain_percent", label: "Gain %", widthClassName: "min-w-28", className: "font-medium", cell: (investment) => <span className={investment.gain_loss >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatPercent(getGainPercent(investment))}</span> },
    { key: "portfolio_weight", label: "Portfolio Weight", widthClassName: "min-w-36 text-slate-900", cell: (investment) => formatPercent(getPortfolioWeight(investment, totalPortfolioValue)) },
    { key: "category", label: "Category", sortable: true, widthClassName: "min-w-36", cell: (investment) => <InvestmentCategoryBadge category={investment.category} /> },
    { key: "region", label: "Region", widthClassName: "min-w-28", cell: (investment) => investment.region },
    { key: "sip_amount", label: "SIP Amount", widthClassName: "min-w-32", cell: (investment) => formatCurrency(investment.sip_amount) },
    {
      key: "actions",
      label: "Actions",
      widthClassName: "min-w-32",
      className: "text-right",
      headerClassName: "text-right",
      cell: (investment) => (
        <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
          <Button type="button" variant="ghost" size="icon" onClick={() => onView(investment)}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(investment)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(investment)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const activeColumnKeys: InvestmentColumnKey[] =
    categoryFilter === "Mutual Funds"
      ? ["name", "amc", "folio_number", "nav_price", "units", "current_value", "actions"]
      : categoryFilter === "Stocks"
        ? ["name", "exchange", "average_purchase_price", "nav_price", "units", "current_value", "actions"]
        : ["name", "category", "owner", "units", "cost_basis", "current_value", "gain_loss", "actions"];

  const columns = allColumns
    .filter((column) => activeColumnKeys.includes(column.key))
    .map((column) => ({
      key: column.key,
      header: column.label,
      cell: column.cell,
      sortable: column.sortable,
      widthClassName: column.widthClassName,
      className: column.className,
      headerClassName: column.headerClassName,
    }));

  return (
    <DataGrid
      title="Investment holdings"
      description="Search, filter, sort, and manage portfolio positions"
      columns={columns}
      rows={investments}
      getRowId={(investment) => investment.id}
      onRowClick={onView}
      search={{ value: searchValue, onChange: onSearchChange, placeholder: "Search investments" }}
      filters={
        <>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={regionFilter} onChange={(event) => onRegionFilterChange(event.target.value)}>
            <option value="all">All regions</option>
            <option value="Domestic">Domestic</option>
            <option value="International">International</option>
          </select>
        </>
      }
      sort={{ key: sortKey, direction: sortDirection, onChange: (key, direction) => onSortChange(key as InvestmentTableProps["sortKey"], direction) }}
      pagination={{ page, pageSize, totalRows, onPageChange, onPageSizeChange, pageSizeOptions: [10, 20, 50] }}
      emptyTitle="No investments yet"
      emptyDescription="Add your first holding to unlock allocation, return, and diversification insights."
    />
  );
}