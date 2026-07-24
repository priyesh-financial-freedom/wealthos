"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

export type DataGridSortDirection = "asc" | "desc";

export interface DataGridColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  widthClassName?: string;
  className?: string;
  headerClassName?: string;
}

export interface DataGridActionOption {
  label: string;
  value: string;
}

export interface DataGridSelectionConfig<T> {
  enabled?: boolean;
  exportFileName?: string;
  getExportValue?: (row: T, column: DataGridColumn<T>) => string | number | boolean | null | undefined;
  onDeleteSelected?: (rows: T[]) => Promise<void> | void;
  statusOptions?: DataGridActionOption[];
  onChangeStatusSelected?: (rows: T[], status: string) => Promise<void> | void;
  ownerOptions?: DataGridActionOption[];
  onChangeOwnerSelected?: (rows: T[], owner: string) => Promise<void> | void;
  onSelectionChange?: (rows: T[], rowIds: string[]) => void;
}

interface DataGridProps<T> {
  title: string;
  description?: string;
  columns: Array<DataGridColumn<T>>;
  rows: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyTitle: string;
  emptyDescription: string;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  filters?: ReactNode;
  actions?: ReactNode;
  sort?: {
    key: string;
    direction: DataGridSortDirection;
    onChange: (key: string, direction: DataGridSortDirection) => void;
  };
  pagination?: {
    page: number;
    pageSize: number;
    totalRows: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
  };
  maxBodyHeightClassName?: string;
  rowClassName?: (row: T) => string | undefined;
  selection?: DataGridSelectionConfig<T>;
}

function toCsvCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return `"${value.replaceAll('"', '""')}"`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return `"${JSON.stringify(value).replaceAll('"', '""')}"`;
}

function downloadCsv(fileName: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export function DataGrid<T>({
  title,
  description,
  columns,
  rows,
  getRowId,
  onRowClick,
  loading,
  emptyTitle,
  emptyDescription,
  search,
  filters,
  actions,
  sort,
  pagination,
  maxBodyHeightClassName,
  rowClassName,
  selection,
}: DataGridProps<T>) {
  const selectionEnabled = selection?.enabled ?? true;
  const [selectedRowsById, setSelectedRowsById] = useState<Map<string, T>>(new Map());
  const [selectedStatus, setSelectedStatus] = useState(selection?.statusOptions?.[0]?.value ?? "");
  const [selectedOwner, setSelectedOwner] = useState(selection?.ownerOptions?.[0]?.value ?? "");
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const selectedRows = useMemo(() => Array.from(selectedRowsById.values()), [selectedRowsById]);
  const selectedRowIds = useMemo(() => Array.from(selectedRowsById.keys()), [selectedRowsById]);
  const selectedCount = selectedRows.length;
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.totalRows / pagination.pageSize)) : 1;

  const visibleRowIds = useMemo(() => rows.map((row) => getRowId(row)), [rows, getRowId]);
  const allVisibleSelected = visibleRowIds.length > 0 && visibleRowIds.every((rowId) => selectedRowsById.has(rowId));
  const someVisibleSelected = visibleRowIds.some((rowId) => selectedRowsById.has(rowId));

  useEffect(() => {
    if (!headerCheckboxRef.current) {
      return;
    }

    headerCheckboxRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  useEffect(() => {
    if (!selectionEnabled) {
      setSelectedRowsById(new Map());
      return;
    }

    setSelectedRowsById((current) => {
      let changed = false;
      const next = new Map(current);

      for (const row of rows) {
        const rowId = getRowId(row);
        if (next.has(rowId) && next.get(rowId) !== row) {
          next.set(rowId, row);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [getRowId, rows, selectionEnabled]);

  useEffect(() => {
    selection?.onSelectionChange?.(selectedRows, selectedRowIds);
  }, [selectedRowIds, selectedRows, selection]);

  useEffect(() => {
    const statusOptions = selection?.statusOptions ?? [];
    if (statusOptions.length > 0 && !statusOptions.some((option) => option.value === selectedStatus)) {
      setSelectedStatus(statusOptions[0]?.value ?? "");
    }

    if (statusOptions.length === 0 && selectedStatus !== "") {
      setSelectedStatus("");
    }
  }, [selectedStatus, selection?.statusOptions]);

  useEffect(() => {
    const ownerOptions = selection?.ownerOptions ?? [];
    if (ownerOptions.length > 0 && !ownerOptions.some((option) => option.value === selectedOwner)) {
      setSelectedOwner(ownerOptions[0]?.value ?? "");
    }

    if (ownerOptions.length === 0 && selectedOwner !== "") {
      setSelectedOwner("");
    }
  }, [selectedOwner, selection?.ownerOptions]);

  function setRowSelected(row: T, checked: boolean) {
    const rowId = getRowId(row);

    setSelectedRowsById((current) => {
      const next = new Map(current);
      if (checked) {
        next.set(rowId, row);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  }

  function setVisibleRowsSelected(checked: boolean) {
    setSelectedRowsById((current) => {
      const next = new Map(current);

      for (const row of rows) {
        const rowId = getRowId(row);
        if (checked) {
          next.set(rowId, row);
        } else {
          next.delete(rowId);
        }
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedRowsById(new Map());
  }

  function handleExportSelected() {
    if (selectedRows.length === 0) {
      return;
    }

    const exportableColumns = columns.filter((column) => column.key !== "actions");
    const header = exportableColumns.map((column) => toCsvCell(column.header)).join(",");
    const body = selectedRows
      .map((row) =>
        exportableColumns
          .map((column) => {
            const overrideValue = selection?.getExportValue?.(row, column);

            if (overrideValue !== undefined) {
              return toCsvCell(overrideValue);
            }

            const fieldValue = (row as Record<string, unknown>)[column.key];
            return toCsvCell(fieldValue);
          })
          .join(","),
      )
      .join("\n");

    const timestamp = new Date().toISOString().replaceAll(":", "-");
    downloadCsv(selection?.exportFileName ?? `wealthos-export-${timestamp}.csv`, `${header}\n${body}`);
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description ? <p className="text-sm text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {search || filters ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {search ? (
              <Input
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder ?? "Search"}
                className="w-full max-w-md"
              />
            ) : <div />}
            {filters ? <div className="flex flex-wrap gap-2">{filters}</div> : null}
          </div>
        ) : null}
      </div>

      {selectionEnabled && selectedCount > 0 ? (
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm font-medium text-slate-700" aria-live="polite">
            {selectedCount} record{selectedCount === 1 ? "" : "s"} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {selection?.onDeleteSelected ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void selection.onDeleteSelected?.(selectedRows)}>
                Delete
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={handleExportSelected}>
              Export
            </Button>
            {selection?.onChangeStatusSelected && selection.statusOptions && selection.statusOptions.length > 0 ? (
              <>
                <label className="sr-only" htmlFor={`${title}-bulk-status`}>Change status</label>
                <select
                  id={`${title}-bulk-status`}
                  className="h-8 rounded-md border border-slate-300 px-2 text-xs"
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                >
                  {selection.statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={() => void selection.onChangeStatusSelected?.(selectedRows, selectedStatus)}>
                  Change Status
                </Button>
              </>
            ) : null}
            {selection?.onChangeOwnerSelected && selection.ownerOptions && selection.ownerOptions.length > 0 ? (
              <>
                <label className="sr-only" htmlFor={`${title}-bulk-owner`}>Change owner</label>
                <select
                  id={`${title}-bulk-owner`}
                  className="h-8 rounded-md border border-slate-300 px-2 text-xs"
                  value={selectedOwner}
                  onChange={(event) => setSelectedOwner(event.target.value)}
                >
                  {selection.ownerOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={() => void selection.onChangeOwnerSelected?.(selectedRows, selectedOwner)}>
                  Change Owner
                </Button>
              </>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingState label="Loading data..." className="m-4" />
      ) : rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} className="m-4 min-h-52" />
      ) : (
        <>
          <div className={cn(maxBodyHeightClassName ? "overflow-auto" : "overflow-x-auto", maxBodyHeightClassName)}>
            <table className="min-w-max w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  {selectionEnabled ? (
                    <th className="w-40 px-4 py-3 text-left font-medium text-slate-600" scope="col">
                      <label className="inline-flex cursor-pointer items-center gap-2">
                        <input
                          ref={headerCheckboxRef}
                          type="checkbox"
                          checked={allVisibleSelected}
                          aria-checked={someVisibleSelected && !allVisibleSelected ? "mixed" : allVisibleSelected}
                          aria-label="Select all rows"
                          onChange={(event) => setVisibleRowsSelected(event.target.checked)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        />
                        <span>Select All</span>
                      </label>
                    </th>
                  ) : null}
                  {columns.map((column) => {
                    const isSorted = sort?.key === column.key;
                    const nextDirection: DataGridSortDirection = isSorted && sort?.direction === "asc" ? "desc" : "asc";
                    return (
                      <th key={column.key} className={cn("px-4 py-3 text-left font-medium text-slate-600", column.widthClassName, column.headerClassName)} scope="col">
                        {column.sortable && sort ? (
                          <button type="button" className="inline-flex items-center gap-1 transition-colors hover:text-slate-900" onClick={() => sort.onChange(column.key, nextDirection)}>
                            <span>{column.header}</span>
                            {isSorted ? (sort.direction === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ChevronsUpDown className="h-4 w-4 text-slate-400" />}
                          </button>
                        ) : (
                          column.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr
                    key={getRowId(row)}
                    className={cn(onRowClick ? "cursor-pointer hover:bg-slate-50" : undefined, rowClassName?.(row))}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    aria-selected={selectionEnabled ? selectedRowsById.has(getRowId(row)) : undefined}
                  >
                    {selectionEnabled ? (
                      <td className="px-4 py-3 align-top text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedRowsById.has(getRowId(row))}
                          aria-label={`Select row ${getRowId(row)}`}
                          onChange={(event) => setRowSelected(row, event.target.checked)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => (
                      <td key={column.key} className={cn("px-4 py-3 align-top text-slate-700", column.widthClassName, column.className)}>
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                Showing {rows.length === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.totalRows)} of {pagination.totalRows}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {pagination.onPageSizeChange ? (
                  <select
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={pagination.pageSize}
                    onChange={(event) => pagination.onPageSizeChange?.(Number(event.target.value))}
                  >
                    {(pagination.pageSizeOptions ?? [10, 20, 50]).map((option) => (
                      <option key={option} value={option}>{option} / page</option>
                    ))}
                  </select>
                ) : null}
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50" onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1}>Previous</button>
                  <span>Page {pagination.page} of {totalPages}</span>
                  <button type="button" className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50" onClick={() => pagination.onPageChange(Math.min(totalPages, pagination.page + 1))} disabled={pagination.page >= totalPages}>Next</button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
