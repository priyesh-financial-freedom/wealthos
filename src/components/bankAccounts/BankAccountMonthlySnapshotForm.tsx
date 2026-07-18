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
  onSubmit: (values: BankAccountMonthlySnapshotInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type SnapshotFormState = {
  bank_account_id: string;
  snapshot_month: number | string;
  snapshot_year: number | string;
  opening_balance: number | string;
  deposits: number | string;
  withdrawals: number | string;
  closing_balance: number | string;
  interest_rate: number | string;
  notes: string;
};

const now = new Date();

const defaultState = (accounts: BankAccount[], initialData?: BankAccountMonthlySnapshot | null): SnapshotFormState => ({
  bank_account_id: initialData?.bank_account_id ?? accounts[0]?.id ?? "",
  snapshot_month: initialData?.snapshot_month ?? now.getMonth() + 1,
  snapshot_year: initialData?.snapshot_year ?? now.getFullYear(),
  opening_balance: initialData?.opening_balance ?? 0,
  deposits: initialData?.deposits ?? 0,
  withdrawals: initialData?.withdrawals ?? 0,
  closing_balance: initialData?.closing_balance ?? 0,
  interest_rate: initialData?.interest_rate ?? 0,
  notes: initialData?.notes ?? "",
});

export function BankAccountMonthlySnapshotForm({ accounts, initialData, onSubmit, onCancel, submitting }: BankAccountMonthlySnapshotFormProps) {
  const [formValues, setFormValues] = useState<SnapshotFormState>(() => defaultState(accounts, initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof SnapshotFormState>(field: K, value: SnapshotFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const computedPreview = useMemo(() => {
    const opening = Number(formValues.opening_balance ?? 0);
    const deposits = Number(formValues.deposits ?? 0);
    const withdrawals = Number(formValues.withdrawals ?? 0);
    const closing = Number(formValues.closing_balance ?? 0);
    const rate = Number(formValues.interest_rate ?? 0);

    const monthlyChange = closing - opening;
    const cashFlow = deposits - withdrawals;
    const averageBalance = (opening + closing) / 2;
    const interestEarned = averageBalance * (rate / 1200);

    return { monthlyChange, cashFlow, averageBalance, interestEarned };
  }, [formValues]);

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (!formValues.bank_account_id) {
      nextErrors.bank_account_id = "Account is required";
    }
    if (Number(formValues.snapshot_month) < 1 || Number(formValues.snapshot_month) > 12) {
      nextErrors.snapshot_month = "Month must be between 1 and 12";
    }
    if (Number(formValues.snapshot_year) < 2000) {
      nextErrors.snapshot_year = "Year must be 2000 or later";
    }

    const numericFields: Array<keyof SnapshotFormState> = ["opening_balance", "deposits", "withdrawals", "closing_balance", "interest_rate"];
    for (const field of numericFields) {
      if (Number(formValues[field]) < 0) {
        nextErrors[field] = "Value must be positive";
      }
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

    await onSubmit({
      bank_account_id: formValues.bank_account_id,
      snapshot_month: Number(formValues.snapshot_month),
      snapshot_year: Number(formValues.snapshot_year),
      opening_balance: Number(formValues.opening_balance),
      deposits: Number(formValues.deposits),
      withdrawals: Number(formValues.withdrawals),
      closing_balance: Number(formValues.closing_balance),
      interest_rate: Number(formValues.interest_rate),
      notes: formValues.notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="bank_account_id">Bank Account</Label>
          <select id="bank_account_id" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.bank_account_id} onChange={(event) => updateField("bank_account_id", event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bank} • {account.account_name} ({account.masked_account_number})
              </option>
            ))}
          </select>
          {errors.bank_account_id ? <p className="text-sm text-rose-600">{errors.bank_account_id}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="snapshot_month">Month</Label>
          <Input id="snapshot_month" type="number" min="1" max="12" value={formValues.snapshot_month} onChange={(event) => updateField("snapshot_month", event.target.value)} />
          {errors.snapshot_month ? <p className="text-sm text-rose-600">{errors.snapshot_month}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="snapshot_year">Year</Label>
          <Input id="snapshot_year" type="number" min="2000" value={formValues.snapshot_year} onChange={(event) => updateField("snapshot_year", event.target.value)} />
          {errors.snapshot_year ? <p className="text-sm text-rose-600">{errors.snapshot_year}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="opening_balance">Opening Balance</Label>
          <Input id="opening_balance" type="number" step="0.01" value={formValues.opening_balance} onChange={(event) => updateField("opening_balance", event.target.value)} />
          {errors.opening_balance ? <p className="text-sm text-rose-600">{errors.opening_balance}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="deposits">Deposits</Label>
          <Input id="deposits" type="number" step="0.01" value={formValues.deposits} onChange={(event) => updateField("deposits", event.target.value)} />
          {errors.deposits ? <p className="text-sm text-rose-600">{errors.deposits}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="withdrawals">Withdrawals</Label>
          <Input id="withdrawals" type="number" step="0.01" value={formValues.withdrawals} onChange={(event) => updateField("withdrawals", event.target.value)} />
          {errors.withdrawals ? <p className="text-sm text-rose-600">{errors.withdrawals}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="closing_balance">Closing Balance</Label>
          <Input id="closing_balance" type="number" step="0.01" value={formValues.closing_balance} onChange={(event) => updateField("closing_balance", event.target.value)} />
          {errors.closing_balance ? <p className="text-sm text-rose-600">{errors.closing_balance}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="interest_rate">Interest Rate (%)</Label>
          <Input id="interest_rate" type="number" step="0.001" value={formValues.interest_rate} onChange={(event) => updateField("interest_rate", event.target.value)} />
          {errors.interest_rate ? <p className="text-sm text-rose-600">{errors.interest_rate}</p> : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">Auto-calculated preview</p>
        <div className="mt-2 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
          <p>Monthly Change: <span className="font-semibold text-slate-900">${computedPreview.monthlyChange.toLocaleString()}</span></p>
          <p>Cash Flow: <span className="font-semibold text-slate-900">${computedPreview.cashFlow.toLocaleString()}</span></p>
          <p>Average Balance: <span className="font-semibold text-slate-900">${computedPreview.averageBalance.toLocaleString()}</span></p>
          <p>Interest Earned: <span className="font-semibold text-slate-900">${computedPreview.interestEarned.toLocaleString()}</span></p>
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
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add monthly update"}
        </Button>
      </div>
    </form>
  );
}
