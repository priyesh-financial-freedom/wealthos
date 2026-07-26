import { Eye, Pencil, Trash2 } from "lucide-react";

import { investmentCategoryMeta, primaryInvestmentCategories } from "@/components/investments/investmentCategoryMeta";
import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { formatCurrency } from "@/lib/formatters";
import type { Investment, InvestmentCategory, InvestmentStatus } from "@/types/investment";

type SortKey = "investment_name" | "investment_type" | "current_value" | "cost_value" | "monthly_change";

interface InvestmentTableProps {
  rows: Investment[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  categoryFilter: "all" | InvestmentCategory;
  statusFilter: "all" | InvestmentStatus;
  onCategoryFilterChange: (value: "all" | InvestmentCategory) => void;
  onStatusFilterChange: (value: "all" | InvestmentStatus) => void;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSortChange: (sortKey: SortKey, sortDirection: "asc" | "desc") => void;
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  onView: (investment: Investment) => void;
  onEdit: (investment: Investment) => void;
  onDelete: (investment: Investment) => void;
  onOpenHistory: (investment: Investment) => void;
}

const categoryOptions: Array<{ value: InvestmentCategory; label: string }> = primaryInvestmentCategories.map((category) => ({
  value: category,
  label: investmentCategoryMeta[category].displayName,
}));

export function InvestmentTable({
  rows,
  searchValue,
  onSearchChange,
  categoryFilter,
  statusFilter,
  onCategoryFilterChange,
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
  onOpenHistory,
}: InvestmentTableProps) {
  return (
    <DataGrid
      title="Investments"
      description="Portfolio holdings and month-end performance"
      tableViewportClassName="max-h-[32rem]"
      columns={[
        {
          key: "investment_name",
          header: "Investment Name",
          sortable: true,
          widthClassName: "min-w-52",
          className: "font-medium text-slate-900",
          cell: (row) => row.investment_name,
        },
        {
          key: "investment_type",
          header: "Investment Type",
          sortable: true,
          widthClassName: "min-w-36",
          cell: (row) => row.investment_type,
        },
        {
          key: "owner",
          header: "Owner",
          widthClassName: "min-w-28",
          cell: (row) => row.owner || "-",
        },
        {
          key: "institution",
          header: "Institution",
          widthClassName: "min-w-36",
          cell: (row) => row.institution || "-",
        },
        {
          key: "cost_value",
          header: "Cost Value",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => formatCurrency(row.cost_value ?? row.cost_basis, { maximumFractionDigits: 0 }),
        },
        {
          key: "current_value",
          header: "Current Value",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => formatCurrency(row.current_value, { maximumFractionDigits: 0 }),
        },
        {
          key: "monthly_change",
          header: "Monthly Change",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => <span className={row.monthly_change >= 0 ? "text-emerald-700" : "text-rose-700"}>{formatCurrency(row.monthly_change, { maximumFractionDigits: 0 })}</span>,
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
          widthClassName: "min-w-56",
          className: "text-right",
          headerClassName: "text-right",
          cell: (row) => (
            <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenHistory(row)}>History</Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onView(row)}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onEdit(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => onDelete(row)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ),
        },
      ]}
      rows={rows}
      getRowId={(row) => row.id}
      onRowClick={onView}
      search={{ value: searchValue, onChange: onSearchChange, placeholder: "Search investments" }}
      filters={
        <>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value as "all" | InvestmentCategory)}>
            <option value="all">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
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
      sort={{
        key: sortKey,
        direction: sortDirection,
        onChange: (nextSortKey, nextDirection) => onSortChange(nextSortKey as SortKey, nextDirection),
      }}
      pagination={{ page, pageSize, totalRows, onPageChange, onPageSizeChange }}
      emptyTitle="No investments yet"
      emptyDescription="Use a category page to add your first holding and start tracking month-end movement."
      selection={{ enabled: false }}
    />
  );
}
