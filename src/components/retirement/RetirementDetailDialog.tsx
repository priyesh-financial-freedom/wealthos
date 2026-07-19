"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RetirementAccount } from "@/types/retirementAccount";

interface RetirementDetailDialogProps {
  account: RetirementAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function renderAccountSpecificFields(account: RetirementAccount) {
  if (account.account_type === "PPF") {
    return <StatCard label="Maturity Date" value={formatDate(account.maturity_date)} />;
  }

  if (account.account_type === "EPF") {
    return (
      <>
        <StatCard label="Employer" value={account.employer || "—"} />
        <StatCard label="UAN" value={account.uan || "—"} />
        <StatCard label="Employee Contribution" value={account.employee_contribution === null ? "—" : formatMoney(account.employee_contribution)} />
        <StatCard label="Employer Contribution" value={account.employer_contribution === null ? "—" : formatMoney(account.employer_contribution)} />
      </>
    );
  }

  return (
    <>
      <StatCard label="PRAN" value={account.pran || "—"} />
      <StatCard label="POP" value={account.pop || "—"} />
      <StatCard label="Equity %" value={account.equity_percent === null ? "—" : `${account.equity_percent.toFixed(2)}%`} />
      <StatCard label="Corporate Debt %" value={account.corporate_debt_percent === null ? "—" : `${account.corporate_debt_percent.toFixed(2)}%`} />
      <StatCard label="Government Securities %" value={account.government_securities_percent === null ? "—" : `${account.government_securities_percent.toFixed(2)}%`} />
      <StatCard label="Alternative Assets %" value={account.alternative_assets_percent === null ? "—" : `${account.alternative_assets_percent.toFixed(2)}%`} />
    </>
  );
}

export function RetirementDetailDialog({ account, open, onOpenChange }: RetirementDetailDialogProps) {
  if (!account) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{account.account_type} Retirement Account</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <StatCard label="Owner" value={account.owner} />
          <StatCard label="Institution" value={account.institution} />
          <StatCard label="Account Number" value={account.account_number || "—"} />
          <StatCard label="Opening Date" value={formatDate(account.opening_date)} />
          <StatCard label="Current Balance" value={formatMoney(account.current_balance)} />
          <StatCard label="Contribution Frequency" value={account.contribution_frequency} />
          <StatCard label="Contribution Amount" value={formatMoney(account.contribution_amount)} />
          <StatCard label="Contribution Day" value={account.contribution_day ? String(account.contribution_day) : "—"} />
          <StatCard label="Contribution Month" value={account.contribution_month || "—"} />
          <StatCard label="Interest Rate" value={account.interest_rate === null ? "—" : `${account.interest_rate.toFixed(2)}%`} />
          <StatCard label="Nominee" value={account.nominee || "—"} />
          <StatCard label="Created" value={formatDate(account.created_at)} />
          {renderAccountSpecificFields(account)}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-500">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{account.notes || "No notes provided."}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}