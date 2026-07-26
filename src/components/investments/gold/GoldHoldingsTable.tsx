import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { formatCurrency } from "@/lib/formatters";
import type { Investment, InvestmentStatus } from "@/types/investment";

type GoldSortKey =
  | "investment_name"
  | "gold_type"
  | "units"
  | "average_purchase_price"
  | "current_value"
  | "owner";

interface GoldHoldingsTableProps {
  rows: Investment[];
  totalRows: number;
  searchValue: string;
  ownerFilter: string;
  typeFilter: string;
  statusFilter: "all" | InvestmentStatus;
  ownerOptions: string[];
  typeOptions: string[];
  sortKey: GoldSortKey;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
  submitting?: boolean;
  onSearchChange: (value: string) => void;
  onOwnerFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | InvestmentStatus) => void;
  onSortChange: (key: GoldSortKey, direction: "asc" | "desc") => void;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  onAddHolding: () => void;
  onView: (row: Investment) => void;
  onEdit: (row: Investment) => void;
  onDelete: (row: Investment) => void;
}

function safeText(value: string | null | undefined) {
  return value ?? "-";
}

export function GoldHoldingsTable({
  rows,
  totalRows,
  searchValue,
  ownerFilter,
  typeFilter,
  statusFilter,
  ownerOptions,
  typeOptions,
  sortKey,
  sortDirection,
  page,
  pageSize,
  submitting,
  onSearchChange,
  onOwnerFilterChange,
  onTypeFilterChange,
  onStatusFilterChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onAddHolding,
  onView,
  onEdit,
  onDelete,
}: GoldHoldingsTableProps) {
  return (
    <DataGrid
      title={`${totalRows} Holdings`}
      description="Track your gold positions across owners, units, and valuations."
      tableViewportClassName="max-h-[32rem]"
      columns={[
        {
          key: "investment_name",
          header: "Asset Name",
          sortable: true,
          widthClassName: "min-w-56",
          className: "font-medium text-slate-900",
          cell: (row) => row.investment_name,
        },
        {
          key: "gold_type",
          header: "Gold Type",
          sortable: true,
          widthClassName: "min-w-40",
          cell: (row) => safeText(row.gold_type),
        },
        {
          key: "units",
          header: "Quantity",
          sortable: true,
          widthClassName: "min-w-24",
          cell: (row) => Number(row.units ?? 0).toLocaleString("en-IN"),
        },
        {
          key: "gold_unit",
          header: "Unit",
          widthClassName: "min-w-24",
          cell: (row) => safeText(row.gold_unit),
        },
        {
          key: "average_purchase_price",
          header: "Purchase Price",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => formatCurrency(row.average_purchase_price ?? row.purchase_price ?? 0, { maximumFractionDigits: 0 }),
        },
        {
          key: "current_value",
          header: "Current Value",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => formatCurrency(row.current_value, { maximumFractionDigits: 0 }),
        },
        {
          key: "owner",
          header: "Owner",
          sortable: true,
          widthClassName: "min-w-28",
          cell: (row) => safeText(row.owner),
        },
        {
          key: "actions",
          header: "Actions",
          widthClassName: "min-w-56",
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
        placeholder: "Search by asset name, type, owner, or storage location",
      }}
      filters={
        <>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={ownerFilter} onChange={(event) => onOwnerFilterChange(event.target.value)}>
            <option value="all">All owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value)}>
            <option value="all">All types</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>{type}</option>
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
        <Button type="button" size="sm" onClick={onAddHolding} disabled={submitting}>
          Add Gold Holding
        </Button>
      }
      sort={{
        key: sortKey,
        direction: sortDirection,
        onChange: (nextKey, nextDirection) => onSortChange(nextKey as GoldSortKey, nextDirection),
      }}
      pagination={{
        page,
        pageSize,
        totalRows,
        onPageChange,
        onPageSizeChange,
      }}
      emptyTitle="No Gold Holdings Yet"
      emptyDescription="Add your first gold position to track invested value and gains."
      selection={{ enabled: false }}
    />
  );
}
