"use client";

import { DetailDialog, DetailGrid, DetailItem, DetailSection } from "@/components/ui/detail-dialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { BankAccount } from "@/types/bankAccount";

interface BankAccountDetailsDialogProps {
  account: BankAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BankAccountDetailsDialog({ account, open, onOpenChange }: BankAccountDetailsDialogProps) {
  if (!account) {
    return null;
  }

  return (
    <DetailDialog open={open} onOpenChange={onOpenChange} title={`${account.bank} • ${account.nickname || account.account_name}`} description="Month-end balance profile for this bank account.">
      <div className="space-y-6">
        <DetailSection title="Account Snapshot">
          <DetailGrid>
            <DetailItem label="Bank Name" value={account.bank} />
            <DetailItem label="Account Nickname" value={account.nickname || account.account_name} />
            <DetailItem label="Account Type" value={account.account_type} />
            <DetailItem label="Owner" value={account.owner || "—"} />
            <DetailItem label="Current Balance" value={formatCurrency(account.current_balance)} />
            <DetailItem label="Opening Balance" value={formatCurrency(account.opening_balance)} />
            <DetailItem label="Interest Rate" value={account.interest_rate ? `${Number(account.interest_rate ?? 0).toFixed(3)}%` : "—"} />
            <DetailItem label="Include in Net Worth" value={account.include_in_net_worth ? "Yes" : "No"} />
            <DetailItem label="Include in Cash Position" value={account.include_in_cash_position ? "Yes" : "No"} />
            <DetailItem label="Status" value={account.status === "active" ? "Active" : "Closed"} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Records">
          <DetailGrid>
            <DetailItem label="Created" value={formatDate(account.created_at)} />
            <DetailItem label="Updated" value={formatDate(account.updated_at)} />
          </DetailGrid>
        </DetailSection>

        {account.notes ? (
          <DetailSection title="Notes">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{account.notes}</div>
          </DetailSection>
        ) : null}
      </div>
    </DetailDialog>
  );
}
