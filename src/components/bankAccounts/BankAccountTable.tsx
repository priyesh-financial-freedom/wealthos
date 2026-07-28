import { Clock3, Eye, Pencil, Trash2 } from "lucide-react";

import { BankAccountTypeBadge } from "@/components/bankAccounts/BankAccountTypeBadge";
import { Button } from "@/components/ui/button";
import { DataGrid, type DataGridSortDirection } from "@/components/ui/data-grid";
import { formatCurrency } from "@/lib/formatters";
import type { BankAccount, BankAccountStatus } from "@/types/bankAccount";

function formatMaskedAccountNumber(maskedAccountNumber: string): string {
  const suffix = maskedAccountNumber.slice(-4);
  return suffix ? `••••${suffix}` : maskedAccountNumber;
}

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
  onOpenHistory: (account: BankAccount) => void;
  onBulkDelete: (accounts: BankAccount[]) => Promise<void> | void;
  onBulkChangeStatus: (accounts: BankAccount[], status: BankAccountStatus) => Promise<void> | void;
  onBulkChangeOwner: (accounts: BankAccount[], owner: string) => Promise<void> | void;
  ownerOptions: string[];
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
  onOpenHistory,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkChangeStatus,
  onBulkChangeOwner,
  ownerOptions,
}: BankAccountTableProps) {
  return (
    <DataGrid
      title="Bank accounts inventory"
      description="Track monthly balances, ownership, and cash inclusion settings"
      columns={[
        {
          key: "bank",
          header: "Bank Name",
          sortable: true,
          widthClassName: "min-w-40",
          cell: (account) => {
            const maskedAccountNumber = account.masked_account_number?.trim();

            return (
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-slate-900">{account.bank}</span>
                {maskedAccountNumber ? (
                  <span className="truncate text-xs text-slate-500">{formatMaskedAccountNumber(maskedAccountNumber)}</span>
                ) : null}
              </div>
            );
          },
        },
        {
          key: "account_name",
          header: "Account Nickname",
          sortable: true,
          widthClassName: "min-w-48",
          className: "font-medium text-slate-900",
          cell: (account) => account.nickname || account.account_name,
        },
        { key: "type", header: "Type", widthClassName: "min-w-32", cell: (account) => <BankAccountTypeBadge type={account.account_type} /> },
        { key: "opening_balance", header: "Opening Balance", widthClassName: "min-w-36 text-slate-900", cell: (account) => formatCurrency(account.opening_balance, { maximumFractionDigits: 0 }) },
        { key: "current_balance", header: "Current Balance", sortable: true, widthClassName: "min-w-40 text-slate-900", cell: (account) => formatCurrency(account.current_balance, { maximumFractionDigits: 0 }) },
        { key: "owner", header: "Owner", widthClassName: "min-w-36", cell: (account) => account.owner || "—" },
        { key: "include_in_net_worth", header: "Net Worth", widthClassName: "min-w-28", cell: (account) => (account.include_in_net_worth ? "Included" : "Excluded") },
        { key: "include_in_cash_position", header: "Cash Position", widthClassName: "min-w-28", cell: (account) => (account.include_in_cash_position ? "Included" : "Excluded") },
        { key: "status", header: "Status", widthClassName: "min-w-28 capitalize", cell: (account) => (account.status === "active" ? "Active" : "Closed") },
        {
          key: "actions",
          header: "Actions",
          widthClassName: "min-w-56",
          className: "text-right",
          headerClassName: "text-right",
          cell: (account) => (
            <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenHistory(account)}>
                <Clock3 className="h-4 w-4" />
                Monthly History
              </Button>
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
            <option value="closed">Closed</option>
          </select>
        </>
      }
      sort={{ key: sortKey, direction: sortDirection, onChange: (key, direction) => onSortChange(key as BankAccountTableProps["sortKey"], direction) }}
      pagination={{ page, pageSize, totalRows, onPageChange, onPageSizeChange, pageSizeOptions: [10, 20, 50] }}
      emptyTitle="No bank accounts yet"
      emptyDescription="Add your first bank account to start treasury tracking."
      selection={{
        exportFileName: "bank-accounts.csv",
        onDeleteSelected: onBulkDelete,
        statusOptions: [
          { label: "Active", value: "active" },
          { label: "Closed", value: "closed" },
        ],
        onChangeStatusSelected: (selectedAccounts, status) => onBulkChangeStatus(selectedAccounts, status as BankAccountStatus),
        ownerOptions: ownerOptions.map((owner) => ({ label: owner, value: owner })),
        onChangeOwnerSelected: onBulkChangeOwner,
      }}
    />
  );
}
