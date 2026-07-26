"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BankAccount, BankAccountMonthlySnapshot, BankAccountMonthlySnapshotInsert } from "@/types/bankAccount";

interface BankAccountMonthlySnapshotFormProps {
  accounts: BankAccount[];
  initialData?: BankAccountMonthlySnapshot | null;
  preselectedAccountId?: string | null;
  onSubmit: (values: BankAccountMonthlySnapshotInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type SnapshotFormState = {
  bank_account_id: string;
  financial_month: string;
  closing_balance: number | string;
  notes: string;
};

const now = new Date();

function toFinancialMonthValue(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseFinancialMonth(value: string) {
  const [yearRaw, monthRaw] = value.split("-");
  return {
    snapshot_year: Number(yearRaw),
    snapshot_month: Number(monthRaw),
  };
}

function openingBalanceForAccount(account: BankAccount | null, initialData?: BankAccountMonthlySnapshot | null) {
  if (initialData) {
    return initialData.opening_balance ?? 0;
  }

  return account?.current_balance ?? account?.opening_balance ?? 0;
}

const defaultState = (accounts: BankAccount[], initialData?: BankAccountMonthlySnapshot | null, preselectedAccountId?: string | null): SnapshotFormState => ({
  bank_account_id: initialData?.bank_account_id ?? preselectedAccountId ?? accounts[0]?.id ?? "",
  financial_month: initialData ? toFinancialMonthValue(initialData.snapshot_month, initialData.snapshot_year) : toFinancialMonthValue(now.getMonth() + 1, now.getFullYear()),
  closing_balance: initialData?.closing_balance ?? 0,
  notes: initialData?.notes ?? "",
});

export function BankAccountMonthlySnapshotForm({ accounts, initialData, preselectedAccountId, onSubmit, onCancel, submitting }: BankAccountMonthlySnapshotFormProps) {
  const [formValues, setFormValues] = useState<SnapshotFormState>(() => defaultState(accounts, initialData, preselectedAccountId));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof SnapshotFormState>(field: K, value: SnapshotFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === formValues.bank_account_id) ?? null,
    [accounts, formValues.bank_account_id],
  );

  const computedPreview = useMemo(() => {
    const opening = openingBalanceForAccount(selectedAccount, initialData);
    const closing = Number(formValues.closing_balance ?? 0);
    const rate = Number(selectedAccount?.interest_rate ?? initialData?.interest_rate ?? 0);

    const monthlyChange = closing - opening;
    const averageBalance = (opening + closing) / 2;
    const interestEarned = averageBalance * (rate / 1200);

    return { opening, monthlyChange, averageBalance, interestEarned };
  }, [formValues.closing_balance, initialData, selectedAccount]);

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (!formValues.bank_account_id) {
      nextErrors.bank_account_id = "Account is required";
    }
    if (!formValues.financial_month) {
      nextErrors.financial_month = "Financial month is required";
    }

    if (Number(formValues.closing_balance) < 0) {
      nextErrors.closing_balance = "Closing balance must be positive";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const { snapshot_month, snapshot_year } = parseFinancialMonth(formValues.financial_month);
    const openingBalance = openingBalanceForAccount(selectedAccount, initialData);

    await onSubmit({
      bank_account_id: formValues.bank_account_id,
      snapshot_month,
      snapshot_year,
      opening_balance: Number(openingBalance),
      deposits: 0,
      withdrawals: 0,
      closing_balance: Number(formValues.closing_balance),
      interest_rate: Number(selectedAccount?.interest_rate ?? initialData?.interest_rate ?? 0),
      notes: formValues.notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="bank_account_id">Bank Account</Label>
          <select id="bank_account_id" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.bank_account_id} onChange={(event) => updateField("bank_account_id", event.target.value)} disabled={Boolean(preselectedAccountId && !initialData)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bank} • {account.nickname ?? account.account_name}
              </option>
            ))}
          </select>
          {errors.bank_account_id ? <p className="text-sm text-rose-600">{errors.bank_account_id}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="financial_month">Financial Month</Label>
          <Input id="financial_month" type="month" value={formValues.financial_month} onChange={(event) => updateField("financial_month", event.target.value)} />
          {errors.financial_month ? <p className="text-sm text-rose-600">{errors.financial_month}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="closing_balance">Closing Balance</Label>
          <Input id="closing_balance" type="number" step="0.01" value={formValues.closing_balance} onChange={(event) => updateField("closing_balance", event.target.value)} />
          {errors.closing_balance ? <p className="text-sm text-rose-600">{errors.closing_balance}</p> : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">Month-end preview</p>
        <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <p>Opening Balance: <span className="font-semibold text-slate-900">₹{computedPreview.opening.toLocaleString("en-IN")}</span></p>
          <p>Monthly Change: <span className="font-semibold text-slate-900">₹{computedPreview.monthlyChange.toLocaleString("en-IN")}</span></p>
          <p>Average Balance: <span className="font-semibold text-slate-900">₹{computedPreview.averageBalance.toLocaleString("en-IN")}</span></p>
          <p>Estimated Interest: <span className="font-semibold text-slate-900">₹{computedPreview.interestEarned.toLocaleString("en-IN")}</span></p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="snapshot_notes">Notes</Label>
        <Textarea id="snapshot_notes" rows={3} value={formValues.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add monthly history"}
        </Button>
      </div>
    </form>
  );
}
