import type { UniversalAccountType } from "@/types/universalAccount";

interface UniversalAccountFiltersProps {
  query: string;
  onQueryChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  sortValue: string;
  onSortValueChange: (value: string) => void;
  accountTypes: UniversalAccountType[];
}

export function UniversalAccountFilters({
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortValue,
  onSortValueChange,
  accountTypes,
}: UniversalAccountFiltersProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Universal Account Portfolio</h3>
        <p className="text-sm text-slate-600">Config-driven search, filters, and sorting across all account types</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search accounts"
          className="w-[220px] rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value)}>
          <option value="all">All account types</option>
          {accountTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
        <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={sortValue} onChange={(event) => onSortValueChange(event.target.value)}>
          <option value="current_value:desc">Current Value (High-Low)</option>
          <option value="current_value:asc">Current Value (Low-High)</option>
          <option value="name:asc">Name (A-Z)</option>
          <option value="name:desc">Name (Z-A)</option>
          <option value="updated_at:desc">Updated (Newest)</option>
          <option value="updated_at:asc">Updated (Oldest)</option>
          <option value="account_type:asc">Type (A-Z)</option>
          <option value="account_type:desc">Type (Z-A)</option>
        </select>
      </div>
    </div>
  );
}
