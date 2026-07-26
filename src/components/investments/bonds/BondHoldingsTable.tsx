import { Eye, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { formatCurrency } from "@/lib/formatters";
import { computeBondDerivedValues, type BondCouponFrequency } from "@/services/investments/bonds";
import type { Investment, InvestmentStatus } from "@/types/investment";

type BondSortKey =
  | "bond_name"
  | "issuer"
  | "owner"
  | "isin"
  | "bond_type"
  | "current_value"
  | "cost_value"
  | "maturity_date"
  | "coupon_rate";

interface BondHoldingsTableProps {
  rows: Investment[];
  totalRows: number;
  searchValue: string;
  ownerFilter: string;
  issuerFilter: string;
  statusFilter: "all" | InvestmentStatus;
  ownerOptions: string[];
  issuerOptions: string[];
  sortKey: BondSortKey;
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: number;
  submitting?: boolean;
  onSearchChange: (value: string) => void;
  onOwnerFilterChange: (value: string) => void;
  onIssuerFilterChange: (value: string) => void;
  onStatusFilterChange: (value: "all" | InvestmentStatus) => void;
  onSortChange: (key: BondSortKey, direction: "asc" | "desc") => void;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
  onAddBond: () => void;
  onView: (row: Investment) => void;
  onEdit: (row: Investment) => void;
  onOpenHistory: (row: Investment) => void;
  onDelete: (row: Investment) => void;
}

function safeString(value: string | null | undefined) {
  return value ?? "-";
}

function getDerived(row: Investment) {
  const couponFrequency = (row.coupon_frequency as BondCouponFrequency | null) ?? "Annual";
  return computeBondDerivedValues({
    faceValue: Number(row.face_value ?? 0),
    quantity: Number(row.units ?? 0),
    purchasePrice: Number(row.purchase_price ?? row.average_purchase_price ?? 0),
    currentMarketPrice: row.current_market_price ?? row.nav_price,
    couponRate: Number(row.coupon_rate ?? 0),
    couponFrequency,
    purchaseDate: row.purchase_date ?? row.acquisition_date ?? new Date().toISOString().slice(0, 10),
    maturityDate: row.maturity_date ?? row.purchase_date ?? new Date().toISOString().slice(0, 10),
  });
}

export function BondHoldingsTable({
  rows,
  totalRows,
  searchValue,
  ownerFilter,
  issuerFilter,
  statusFilter,
  ownerOptions,
  issuerOptions,
  sortKey,
  sortDirection,
  page,
  pageSize,
  submitting,
  onSearchChange,
  onOwnerFilterChange,
  onIssuerFilterChange,
  onStatusFilterChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onAddBond,
  onView,
  onEdit,
  onOpenHistory,
  onDelete,
}: BondHoldingsTableProps) {
  return (
    <DataGrid
      title={`${totalRows} Holdings`}
      description="Track bond holdings, coupon economics, and maturity timeline."
      tableViewportClassName="max-h-[32rem]"
      columns={[
        {
          key: "bond_name",
          header: "Bond Name",
          sortable: true,
          widthClassName: "min-w-56",
          className: "font-medium text-slate-900",
          cell: (row) => row.bond_name ?? row.investment_name,
        },
        {
          key: "issuer",
          header: "Issuer",
          sortable: true,
          widthClassName: "min-w-44",
          cell: (row) => safeString(row.issuer ?? row.institution),
        },
        {
          key: "isin",
          header: "ISIN",
          sortable: true,
          widthClassName: "min-w-40",
          cell: (row) => safeString(row.isin),
        },
        {
          key: "bond_type",
          header: "Type",
          sortable: true,
          widthClassName: "min-w-36",
          cell: (row) => safeString(row.bond_type),
        },
        {
          key: "owner",
          header: "Owner",
          sortable: true,
          widthClassName: "min-w-28",
          cell: (row) => safeString(row.owner),
        },
        {
          key: "coupon_rate",
          header: "Coupon",
          sortable: true,
          widthClassName: "min-w-24",
          cell: (row) => row.coupon_rate === null || row.coupon_rate === undefined ? "-" : `${Number(row.coupon_rate).toFixed(2)}%`,
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
          header: "Invested",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => formatCurrency(row.cost_value ?? row.cost_basis, { maximumFractionDigits: 0 }),
        },
        {
          key: "unrealized",
          header: "Unrealized P/L",
          widthClassName: "min-w-32",
          cell: (row) => {
            const derived = getDerived(row);
            return formatCurrency(derived.unrealizedGainLoss, { maximumFractionDigits: 0 });
          },
        },
        {
          key: "annual_coupon_income",
          header: "Annual Coupon",
          widthClassName: "min-w-32",
          cell: (row) => {
            const derived = getDerived(row);
            return formatCurrency(derived.annualCouponIncome, { maximumFractionDigits: 0 });
          },
        },
        {
          key: "days_to_maturity",
          header: "Days to Maturity",
          widthClassName: "min-w-32",
          cell: (row) => {
            const derived = getDerived(row);
            return derived.daysToMaturity.toLocaleString("en-IN");
          },
        },
        {
          key: "maturity_date",
          header: "Maturity Date",
          sortable: true,
          widthClassName: "min-w-32",
          cell: (row) => safeString(row.maturity_date),
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
        placeholder: "Search by bond name, issuer, owner, or ISIN",
      }}
      filters={(
        <>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={ownerFilter} onChange={(event) => onOwnerFilterChange(event.target.value)}>
            <option value="all">All owners</option>
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={issuerFilter} onChange={(event) => onIssuerFilterChange(event.target.value)}>
            <option value="all">All issuers</option>
            {issuerOptions.map((issuer) => (
              <option key={issuer} value={issuer}>{issuer}</option>
            ))}
          </select>
          <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as "all" | InvestmentStatus)}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed</option>
          </select>
        </>
      )}
      actions={(
        <Button type="button" size="sm" onClick={onAddBond} disabled={submitting}>
          Add Bond
        </Button>
      )}
      sort={{
        key: sortKey,
        direction: sortDirection,
        onChange: (nextKey, nextDirection) => onSortChange(nextKey as BondSortKey, nextDirection),
      }}
      pagination={{
        page,
        pageSize,
        totalRows,
        onPageChange,
        onPageSizeChange,
      }}
      emptyTitle="No Bonds Yet"
      emptyDescription="Add your first bond to track coupon income and maturity outcomes."
      selection={{ enabled: false }}
    />
  );
}
