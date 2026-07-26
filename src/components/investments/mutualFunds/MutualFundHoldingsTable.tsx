import { useEffect, useMemo, useRef } from "react";
import { Eye, Pencil, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { formatCurrency } from "@/lib/formatters";
import type { Investment, InvestmentStatus } from "@/types/investment";

function gainPercent(row: Investment) {
  const cost = Number(row.cost_value ?? row.cost_basis ?? 0);
  if (cost <= 0) {
    return null;
  }

  return (Number(row.gain_loss ?? 0) / cost) * 100;
}

interface MutualFundHoldingsTableProps {
  rows: Investment[];
  totalHoldingsCount: number;
  filteredRowsCount: number;
  selectedRowIds: string[];
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  footerCurrentValue: number;
  searchValue: string;
  onSearchChange: (value: string) => void;
  amcFilter: string;
  ownerFilter: string;
  statusFilter: "all" | InvestmentStatus;
  amcOptions: string[];
  ownerOptions: string[];
  onAmcFilterChange: (value: string) => void;
  onOwnerFilterChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | InvestmentStatus) => void;
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  onToggleRowSelection: (rowId: string, checked: boolean) => void;
  onToggleVisibleSelection: (checked: boolean) => void;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onBulkEditOwner: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;
  onBulkMonthEndUpdate: () => void;
  onBulkDownloadStatements: () => void;
  onView: (row: Investment) => void;
  onEdit: (row: Investment) => void;
  onArchive: (row: Investment) => void;
}

export function MutualFundHoldingsTable({
  rows,
  totalHoldingsCount,
  filteredRowsCount,
  selectedRowIds,
  allVisibleSelected,
  someVisibleSelected,
  footerCurrentValue,
  searchValue,
  onSearchChange,
  amcFilter,
  ownerFilter,
  statusFilter,
  amcOptions,
  ownerOptions,
  onAmcFilterChange,
  onOwnerFilterChange,
  onStatusFilterChange,
  page,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
  onToggleRowSelection,
  onToggleVisibleSelection,
  onSelectAllFiltered,
  onClearSelection,
  onBulkEditOwner,
  onBulkArchive,
  onBulkDelete,
  onBulkExport,
  onBulkMonthEndUpdate,
  onBulkDownloadStatements,
  onView,
  onEdit,
  onArchive,
}: MutualFundHoldingsTableProps) {
  const selectedCount = selectedRowIds.length;
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const selectedRowIdsSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds]);

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }

    headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  return (
    <div className="space-y-3">
      {selectedCount > 0 ? (
        <div className="sticky top-4 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-semibold text-slate-900" aria-live="polite">
              {selectedCount} Holding{selectedCount === 1 ? "" : "s"} Selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={onSelectAllFiltered}>
                Select All Holdings
              </Button>
              <Button type="button" size="sm" onClick={onBulkEditOwner}>
                Edit Owner
              </Button>
              <Button type="button" size="sm" onClick={onBulkArchive}>
                Archive
              </Button>
              <Button type="button" size="sm" onClick={onBulkExport}>
                Export
              </Button>
              <Button type="button" size="sm" onClick={onBulkMonthEndUpdate}>
                Update Month-End Values
              </Button>
              <Button type="button" size="sm" onClick={onBulkDownloadStatements}>
                Download Statements
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onBulkDelete}
                className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              >
                Delete
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onClearSelection}>
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <DataGrid
        title={`${filteredRowsCount} Holdings`}
        description="Track scheme-level positions and value movement by AMC."
        tableViewportClassName="max-h-[32rem]"
        columns={[
          {
            key: "row_select",
            header: (
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  aria-checked={someVisibleSelected && !allVisibleSelected ? "mixed" : allVisibleSelected}
                  aria-label="Select all visible holdings"
                  onChange={(event) => onToggleVisibleSelection(event.target.checked)}
                  onClick={(event) => event.stopPropagation()}
                />
                Select
              </label>
            ),
            exportHeader: "Selected",
            widthClassName: "min-w-24",
            cell: (row) => (
              <div onClick={(event) => event.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedRowIdsSet.has(row.id)}
                  aria-label={`Select ${row.investment_name}`}
                  onChange={(event) => onToggleRowSelection(row.id, event.target.checked)}
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            ),
          },
          {
            key: "investment_name",
            header: "Scheme Name",
            widthClassName: "min-w-56",
            className: "font-medium text-slate-900",
            cell: (row) => row.investment_name,
            sortable: true,
          },
          {
            key: "amc",
            header: "AMC",
            widthClassName: "min-w-40",
            cell: (row) => row.amc || row.institution || "-",
            sortable: true,
          },
          {
            key: "folio_number",
            header: "Folio Number",
            widthClassName: "min-w-40",
            cell: (row) => row.folio_number || "-",
            sortable: true,
          },
          {
            key: "owner",
            header: "Owner",
            widthClassName: "min-w-28",
            cell: (row) => row.owner || "-",
          },
          {
            key: "current_value",
            header: "Current Value",
            widthClassName: "min-w-36",
            cell: (row) => formatCurrency(row.current_value, { maximumFractionDigits: 0 }),
            sortable: true,
          },
          {
            key: "cost_value",
            header: "Cost Value",
            widthClassName: "min-w-36",
            cell: (row) => formatCurrency(row.cost_value ?? row.cost_basis, { maximumFractionDigits: 0 }),
            sortable: true,
          },
          {
            key: "gain_loss",
            header: "Gain / Loss",
            widthClassName: "min-w-36",
            cell: (row) => (
              <span className={row.gain_loss >= 0 ? "text-emerald-700" : "text-rose-700"}>
                {formatCurrency(row.gain_loss, { maximumFractionDigits: 0 })}
              </span>
            ),
            sortable: true,
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
            key: "status",
            header: "Status",
            widthClassName: "min-w-24 capitalize",
            cell: (row) => row.status,
          },
          {
            key: "actions",
            header: "Actions",
            widthClassName: "min-w-64",
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
                <Button type="button" variant="outline" size="sm" onClick={() => onArchive(row)} disabled={row.status === "closed"}>
                  <Archive className="h-4 w-4" />
                  Archive
                </Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        getRowId={(row) => row.id}
        onRowClick={onView}
        search={{ value: searchValue, onChange: onSearchChange, placeholder: "Search by Scheme Name or Folio" }}
        filters={
          <>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={amcFilter} onChange={(event) => onAmcFilterChange(event.target.value)}>
              <option value="all">All AMCs</option>
              {amcOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={ownerFilter} onChange={(event) => onOwnerFilterChange(event.target.value)}>
              <option value="all">All owners</option>
              {ownerOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
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
          <Button type="button" size="sm" variant="outline" onClick={onSelectAllFiltered}>
            Select All Holdings
          </Button>
        }
        pagination={{ page, pageSize, totalRows, onPageChange, onPageSizeChange }}
        emptyTitle="No Mutual Funds Yet"
        emptyDescription="Add your first Mutual Fund to start tracking scheme performance."
        selection={{ enabled: false }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        <p>
          Showing <span className="font-semibold text-slate-900">{filteredRowsCount}</span> of <span className="font-semibold text-slate-900">{totalHoldingsCount}</span> Holdings
        </p>
        <p>
          Selected <span className="font-semibold text-slate-900">{selectedCount}</span> Holdings
        </p>
        <p>
          Total Current Value <span className="font-semibold text-slate-900">{formatCurrency(footerCurrentValue, { maximumFractionDigits: 0 })}</span>
        </p>
      </div>
    </div>
  );
}
