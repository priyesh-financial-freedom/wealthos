import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { formatCurrency } from "@/lib/formatters";
import type { Investment, InvestmentStatus } from "@/types/investment";

type StockSortKey =
  | "investment_name"
  | "owner"
  | "demat_account_number"
  | "isin"
  | "current_value"
  | "cost_value"
  | "gain_loss"
  | "monthly_change";

interface StockHoldingsTableProps {
  rows: Investment[];
  totalRows: number;
  searchValue: string;
  ownerFilter: string;
  dematFilter: string;
  statusFilter: "all" | InvestmentStatus;
  ownerOptions: string[];
  dematOptions: string[];
  sortKey: StockSortKey;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
  submitting?: boolean;
  onSearchChange: (value: string) => void;
  onOwnerFilterChange: (value: string) => void;
  onDematFilterChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | InvestmentStatus) => void;
  onSortChange: (key: StockSortKey, direction: "asc" | "desc") => void;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  onAddStock: () => void;
  onView: (row: Investment) => void;
  onEdit: (row: Investment) => void;
  onOpenHistory: (row: Investment) => void;
  onDelete: (row: Investment) => void;
}

function gainPercent(row: Investment) {
  const cost = Number(row.cost_value ?? row.cost_basis ?? 0);
  if (cost <= 0) {
    return null;
  }

  return (Number(row.gain_loss ?? 0) / cost) * 100;
}

export function StockHoldingsTable({
  rows,
  totalRows,
  searchValue,
  ownerFilter,
  dematFilter,
  statusFilter,
  ownerOptions,
  dematOptions,
  sortKey,
  sortDirection,
  page,
  pageSize,
  submitting,
  onSearchChange,
  onOwnerFilterChange,
  onDematFilterChange,
  onStatusFilterChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onAddStock,
  onView,
  onEdit,
  onOpenHistory,
  onDelete,
}: StockHoldingsTableProps) {
  return (
    <DataGrid
      title={`${totalRows} Holdings`}
      description="Track stock-level positions across owners and demat accounts"
      tableViewportClassName="max-h-[32rem]"
      columns={[
        {
          key: "investment_name",
          header: "Stock Name",
          sortable: true,
          widthClassName: "min-w-56",
          className: "font-medium text-slate-900",
          cell: (row) => row.investment_name,
        },
        {
          key: "isin",
          header: "ISIN",
          sortable: true,
          widthClassName: "min-w-40 font-mono text-xs",
          cell: (row) => row.isin || "-",
        },
        {
          key: "owner",
          header: "Owner",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => row.owner || "-",
        },
        {
          key: "demat_account_number",
          header: "Demat Account",
          sortable: true,
          widthClassName: "min-w-40",
          cell: (row) => row.demat_account_number || "-",
        },
        {
          key: "broker",
          header: "Broker",
          widthClassName: "min-w-36",
          cell: (row) => row.broker || row.institution || "-",
        },
        {
          key: "current_value",
          header: "Current Value",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => formatCurrency(row.current_value, { maximumFractionDigits: 0 }),
        },
        {
          key: "cost_value",
          header: "Cost Value",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => formatCurrency(row.cost_value ?? row.cost_basis, { maximumFractionDigits: 0 }),
        },
        {
          key: "gain_loss",
          header: "Gain / Loss",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => (
            <span className={row.gain_loss >= 0 ? "text-emerald-700" : "text-rose-700"}>
              {formatCurrency(row.gain_loss, { maximumFractionDigits: 0 })}
            </span>
          ),
        },
        {
          key: "gain_percent",
          header: "Gain %",
          widthClassName: "min-w-24",
          cell: (row) => {
            const value = gainPercent(row);
            if (value === null) {
              return "-";
            }

            return <span className={value >= 0 ? "text-emerald-700" : "text-rose-700"}>{value.toFixed(2)}%</span>;
          },
        },
        {
          key: "monthly_change",
          header: "Monthly Change",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => (
            <span className={row.monthly_change >= 0 ? "text-emerald-700" : "text-rose-700"}>
              {formatCurrency(row.monthly_change, { maximumFractionDigits: 0 })}
            </span>
          ),
        },
        {
          key: "status",
          header: "Status",
          widthClassName: "min-w-24 capitalize",
          cell: (row) => row.status,
        },
        {
          key: "actions",
          header: "Actions",
          widthClassName: "min-w-72",
          className: "text-right",
          headerClassName: "text-right",
          cell: (row) => (
            <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="outline" size="sm" onClick={() => onView(row)}>
                <Eye className="h-4 w-4" />
                View
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onEdit(row)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenHistory(row)}>
                History
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onDelete(row)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          ),
        },
      ]}
      rows={rows}
      getRowId={(row) => row.id}
      onRowClick={onView}
      search={{
        value: searchValue,
        onChange: onSearchChange,
        placeholder: "Search by stock, owner, demat, broker, or ISIN",
      }}
      filters={
        <>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={ownerFilter} onChange={(event) => onOwnerFilterChange(event.target.value)}>
            <option value="all">All owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={dematFilter} onChange={(event) => onDematFilterChange(event.target.value)}>
            <option value="all">All demat accounts</option>
            {dematOptions.map((demat) => (
              <option key={demat} value={demat}>{demat}</option>
            ))}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as "all" | InvestmentStatus)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed</option>
          </select>
        </>
      }
      actions={
        <Button type="button" size="sm" onClick={onAddStock} disabled={submitting}>
          Add Stock
        </Button>
      }
      sort={{
        key: sortKey,
        direction: sortDirection,
        onChange: (nextKey, nextDirection) => onSortChange(nextKey as StockSortKey, nextDirection),
      }}
      pagination={{
        page,
        pageSize,
        totalRows,
        onPageChange,
        onPageSizeChange,
      }}
      emptyTitle="No Stocks Yet"
      emptyDescription="Add your first stock to start tracking positions across owners and demat accounts."
      selection={{ enabled: false }}
    />
  );
}
