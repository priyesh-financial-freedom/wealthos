import { Eye, Pencil, Trash2 } from "lucide-react";

import { LiabilityTypeBadge } from "@/components/liabilities/LiabilityTypeBadge";
import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import type { Liability, LiabilityStatus } from "@/types/liability";

interface LiabilityTableProps {
  liabilities: Liability[];
  onView: (liability: Liability) => void;
  onEdit: (liability: Liability) => void;
  onDelete: (liability: Liability) => void;
  onBulkDelete: (liabilities: Liability[]) => Promise<void> | void;
  onBulkChangeStatus: (liabilities: Liability[], status: LiabilityStatus) => Promise<void> | void;
}

export function LiabilityTable({ liabilities, onView, onEdit, onDelete, onBulkDelete, onBulkChangeStatus }: LiabilityTableProps) {
  return (
    <DataGrid
      title="Liability inventory"
      description="Manage debt accounts, repayment plans, and status"
      tableViewportClassName="max-h-[32rem]"
      columns={[
        { key: "account_name", header: "Account", widthClassName: "min-w-44", className: "font-medium text-slate-900", cell: (liability) => liability.account_name },
        { key: "type", header: "Type", widthClassName: "min-w-36", cell: (liability) => <LiabilityTypeBadge type={liability.liability_type} /> },
        { key: "owner", header: "Owner", widthClassName: "min-w-28", cell: (liability) => liability.owner ?? "—" },
        { key: "primary_borrower", header: "Primary Borrower", widthClassName: "min-w-36", cell: (liability) => liability.primary_borrower ?? "—" },
        { key: "lender", header: "Lender", widthClassName: "min-w-40", cell: (liability) => liability.lender },
        { key: "outstanding_amount", header: "Outstanding", widthClassName: "min-w-36 text-slate-900", cell: (liability) => `₹${Number(liability.outstanding_amount).toLocaleString("en-IN")}` },
        { key: "emi", header: "EMI", widthClassName: "min-w-32 text-slate-900", cell: (liability) => (liability.emi ? `₹${Number(liability.emi).toLocaleString("en-IN")}` : "—") },
        { key: "interest_rate", header: "Interest", widthClassName: "min-w-28 text-slate-900", cell: (liability) => (liability.interest_rate ? `${Number(liability.interest_rate).toFixed(1)}%` : "—") },
        { key: "status", header: "Status", widthClassName: "min-w-28 capitalize", cell: (liability) => liability.status },
        {
          key: "actions",
          header: "Actions",
          widthClassName: "min-w-32",
          className: "text-right",
          headerClassName: "text-right",
          cell: (liability) => (
            <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="ghost" size="icon" onClick={() => onView(liability)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(liability)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(liability)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ),
        },
      ]}
      rows={liabilities}
      getRowId={(liability) => liability.id}
      onRowClick={onView}
      emptyTitle="No liabilities yet"
      emptyDescription="Add your first liability to track debt, repayment obligations, and risk."
      selection={{
        exportFileName: "liabilities.csv",
        onDeleteSelected: onBulkDelete,
        statusOptions: [
          { label: "Active", value: "active" },
          { label: "Paid Off", value: "paid_off" },
          { label: "Pending", value: "pending" },
          { label: "Closed", value: "closed" },
        ],
        onChangeStatusSelected: (selectedLiabilities, status) => onBulkChangeStatus(selectedLiabilities, status as LiabilityStatus),
      }}
    />
  );
}
