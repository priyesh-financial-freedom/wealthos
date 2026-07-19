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
    <DetailDialog open={open} onOpenChange={onOpenChange} title={`${account.bank} • ${account.account_name}`} description="Banking profile, ownership, and treasury metadata.">
      <div className="space-y-6">
        <DetailSection title="Account Snapshot">
          <DetailGrid>
            <DetailItem label="Account Type" value={account.account_type} />
            <DetailItem label="Nickname" value={account.nickname || "—"} />
            <DetailItem label="Masked Number" value={account.masked_account_number} />
            <DetailItem label="IFSC" value={account.ifsc || "—"} />
            <DetailItem label="Current Balance" value={formatCurrency(account.current_balance)} />
            <DetailItem label="Opening Balance" value={formatCurrency(account.opening_balance)} />
            <DetailItem label="Interest Rate" value={`${Number(account.interest_rate ?? 0).toFixed(3)}%`} />
            <DetailItem label="Status" value={account.status} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Ownership & Records">
          <DetailGrid>
            <DetailItem label="Owner" value={account.owner || "—"} />
            <DetailItem label="Nominee" value={account.nominee || "—"} />
            <DetailItem label="Joint Holder" value={account.joint_holder || "—"} />
            <DetailItem label="Documents" value={account.documents_placeholder || "No documents added"} />
            <DetailItem label="Created" value={formatDate(account.created_at)} />
            <DetailItem label="Updated" value={formatDate(account.updated_at)} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Notes">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">{account.notes || "No notes provided."}</div>
        </DetailSection>
      </div>
    </DetailDialog>
  );
}
