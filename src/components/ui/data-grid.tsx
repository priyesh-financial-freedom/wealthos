"use client";

import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

import { Input } from "@/components/ui/input";
import { EmptyState, LoadingState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

export type DataGridSortDirection = "asc" | "desc";

export interface DataGridColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  widthClassName?: string;
  className?: string;
  headerClassName?: string;
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
  filters?: React.ReactNode;
  actions?: React.ReactNode;
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
}: DataGridProps<T>) {
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.totalRows / pagination.pageSize)) : 1;

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
                  {columns.map((column) => {
                    const isSorted = sort?.key === column.key;
                    const nextDirection: DataGridSortDirection = isSorted && sort?.direction === "asc" ? "desc" : "asc";
                    return (
                      <th key={column.key} className={cn("px-4 py-3 text-left font-medium text-slate-600", column.widthClassName, column.headerClassName)}>
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
                  >
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
