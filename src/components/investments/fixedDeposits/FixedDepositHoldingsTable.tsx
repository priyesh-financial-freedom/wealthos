import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { formatCurrency } from "@/lib/formatters";
import type { Investment, InvestmentStatus } from "@/types/investment";

type FixedDepositSortKey =
  | "investment_name"
  | "owner"
  | "institution"
  | "fd_number"
  | "current_value"
  | "cost_value"
  | "interest_rate"
  | "maturity_value";

interface FixedDepositHoldingsTableProps {
  rows: Investment[];
  totalRows: number;
  searchValue: string;
  ownerFilter: string;
  institutionFilter: string;
  statusFilter: "all" | InvestmentStatus;
  ownerOptions: string[];
  institutionOptions: string[];
  sortKey: FixedDepositSortKey;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
  submitting?: boolean;
  onSearchChange: (value: string) => void;
  onOwnerFilterChange: (value: string) => void;
  onInstitutionFilterChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | InvestmentStatus) => void;
  onSortChange: (key: FixedDepositSortKey, direction: "asc" | "desc") => void;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  onAddHolding: () => void;
  onView: (row: Investment) => void;
  onEdit: (row: Investment) => void;
  onOpenHistory: (row: Investment) => void;
  onDelete: (row: Investment) => void;
}

export function FixedDepositHoldingsTable({
  rows,
  totalRows,
  searchValue,
  ownerFilter,
  institutionFilter,
  statusFilter,
  ownerOptions,
  institutionOptions,
  sortKey,
  sortDirection,
  page,
  pageSize,
  submitting,
  onSearchChange,
  onOwnerFilterChange,
  onInstitutionFilterChange,
  onStatusFilterChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onAddHolding,
  onView,
  onEdit,
  onOpenHistory,
  onDelete,
}: FixedDepositHoldingsTableProps) {
  return (
    <DataGrid
      title={`${totalRows} Holdings`}
      description="Track fixed deposit positions, accrued interest, and maturity outcomes."
      tableViewportClassName="max-h-[32rem]"
      columns={[
        {
          key: "investment_name",
          header: "FD Name",
          sortable: true,
          widthClassName: "min-w-52",
          className: "font-medium text-slate-900",
          cell: (row) => row.investment_name,
        },
        {
          key: "institution",
          header: "Bank",
          sortable: true,
          widthClassName: "min-w-40",
          cell: (row) => row.institution || "-",
        },
        {
          key: "fd_number",
          header: "FD Number",
          sortable: true,
          widthClassName: "min-w-36",
          cell: (row) => row.fd_number || "-",
        },
        {
          key: "owner",
          header: "Owner",
          sortable: true,
          widthClassName: "min-w-28",
          cell: (row) => row.owner || "-",
        },
        {
          key: "interest_rate",
          header: "Rate",
          sortable: true,
          widthClassName: "min-w-24",
          cell: (row) => row.interest_rate === null ? "-" : `${Number(row.interest_rate).toFixed(2)}%`,
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
          header: "Principal",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => formatCurrency(row.cost_value ?? row.cost_basis, { maximumFractionDigits: 0 }),
        },
        {
          key: "accrued_interest",
          header: "Accrued Interest",
          widthClassName: "min-w-32",
          cell: (row) => formatCurrency((row.current_value ?? 0) - (row.cost_value ?? row.cost_basis ?? 0), { maximumFractionDigits: 0 }),
        },
        {
          key: "maturity_value",
          header: "Maturity Value",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => row.maturity_value === null ? "-" : formatCurrency(row.maturity_value, { maximumFractionDigits: 0 }),
        },
        {
          key: "maturity_date",
          header: "Maturity Date",
          widthClassName: "min-w-32",
          cell: (row) => row.maturity_date || "-",
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
        placeholder: "Search by name, owner, bank, or FD number",
      }}
      filters={
        <>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={ownerFilter} onChange={(event) => onOwnerFilterChange(event.target.value)}>
            <option value="all">All owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={institutionFilter} onChange={(event) => onInstitutionFilterChange(event.target.value)}>
            <option value="all">All banks</option>
            {institutionOptions.map((bank) => (
              <option key={bank} value={bank}>{bank}</option>
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
          Add Fixed Deposit
        </Button>
      }
      sort={{
        key: sortKey,
        direction: sortDirection,
        onChange: (nextKey, nextDirection) => onSortChange(nextKey as FixedDepositSortKey, nextDirection),
      }}
      pagination={{
        page,
        pageSize,
        totalRows,
        onPageChange,
        onPageSizeChange,
      }}
      emptyTitle="No Fixed Deposits Yet"
      emptyDescription="Add your first fixed deposit to track accruals and maturity value."
      selection={{ enabled: false }}
    />
  );
}
