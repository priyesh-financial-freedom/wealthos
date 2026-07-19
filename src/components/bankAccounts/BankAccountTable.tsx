import { Eye, Pencil, Trash2 } from "lucide-react";

import { BankAccountTypeBadge } from "@/components/bankAccounts/BankAccountTypeBadge";
import { Button } from "@/components/ui/button";
import { DataGrid, type DataGridSortDirection } from "@/components/ui/data-grid";
import { formatCurrency } from "@/lib/formatters";
import type { BankAccount } from "@/types/bankAccount";

interface BankAccountTableProps {
  accounts: BankAccount[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortKey: "account_name" | "bank" | "current_balance" | "interest_rate" | "updated_at";
  sortDirection: DataGridSortDirection;
  onSortChange: (key: BankAccountTableProps["sortKey"], direction: DataGridSortDirection) => void;
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onView: (account: BankAccount) => void;
  onEdit: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
}
export function BankAccountTable({
  accounts,
  searchValue,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
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
}: BankAccountTableProps) {
  return (
    <DataGrid
      title="Bank accounts inventory"
      description="Manage balances, ownership, and account profile details"
      columns={[
        { key: "bank", header: "Bank", sortable: true, widthClassName: "min-w-40", cell: (account) => account.bank },
        { key: "account_name", header: "Account Name", sortable: true, widthClassName: "min-w-48", className: "font-medium text-slate-900", cell: (account) => account.account_name },
        { key: "type", header: "Type", widthClassName: "min-w-32", cell: (account) => <BankAccountTypeBadge type={account.account_type} /> },
        { key: "masked_number", header: "Masked Number", widthClassName: "min-w-36", cell: (account) => account.masked_account_number },
        { key: "current_balance", header: "Current Balance", sortable: true, widthClassName: "min-w-40 text-slate-900", cell: (account) => formatCurrency(account.current_balance, { maximumFractionDigits: 0 }) },
        { key: "owner", header: "Owner", widthClassName: "min-w-36", cell: (account) => account.owner || "—" },
        { key: "status", header: "Status", widthClassName: "min-w-28 capitalize", cell: (account) => account.status },
        {
          key: "actions",
          header: "Actions",
          widthClassName: "min-w-32",
          className: "text-right",
          headerClassName: "text-right",
          cell: (account) => (
            <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="ghost" size="icon" onClick={() => onView(account)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(account)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(account)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ),
        },
      ]}
      rows={accounts}
      getRowId={(account) => account.id}
      onRowClick={onView}
      search={{ value: searchValue, onChange: onSearchChange, placeholder: "Search bank accounts" }}
      filters={
        <>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value)}>
            <option value="all">All types</option>
            <option value="Savings">Savings</option>
            <option value="Salary">Salary</option>
            <option value="Current">Current</option>
            <option value="Cash">Cash</option>
            <option value="Wallet">Wallet</option>
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed</option>
          </select>
        </>
      }
      sort={{ key: sortKey, direction: sortDirection, onChange: (key, direction) => onSortChange(key as BankAccountTableProps["sortKey"], direction) }}
      pagination={{ page, pageSize, totalRows, onPageChange, onPageSizeChange, pageSizeOptions: [10, 20, 50] }}
      emptyTitle="No bank accounts yet"
      emptyDescription="Add your first bank account to start treasury tracking."
    />
  );
}
