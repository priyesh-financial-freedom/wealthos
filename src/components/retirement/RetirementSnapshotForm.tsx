"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MonthlyRetirementSnapshot, MonthlyRetirementSnapshotInsert, RetirementAccount } from "@/types/retirementAccount";

interface RetirementSnapshotFormProps {
  accounts: RetirementAccount[];
  initialData?: MonthlyRetirementSnapshot | null;
  initialAccountId?: string | null;
  onSubmit: (values: MonthlyRetirementSnapshotInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type SnapshotFormState = {
  retirement_account_id: string;
  snapshot_month: number | string;
  snapshot_year: number | string;
  opening_balance: number | string;
  contribution: number | string;
  interest: number | string;
  closing_balance: number | string;
};

const today = new Date();

function defaultState(initialData?: MonthlyRetirementSnapshot | null, initialAccountId?: string | null): SnapshotFormState {
  return {
    retirement_account_id: initialData?.retirement_account_id ?? initialAccountId ?? "",
    snapshot_month: initialData?.snapshot_month ?? today.getMonth() + 1,
    snapshot_year: initialData?.snapshot_year ?? today.getFullYear(),
    opening_balance: initialData?.opening_balance ?? 0,
    contribution: initialData?.contribution ?? 0,
    interest: initialData?.interest ?? 0,
    closing_balance: initialData?.closing_balance ?? 0,
  };
}

export function RetirementSnapshotForm({ accounts, initialData, initialAccountId, onSubmit, onCancel, submitting }: RetirementSnapshotFormProps) {
  const [formValues, setFormValues] = useState<SnapshotFormState>(() => defaultState(initialData, initialAccountId));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof SnapshotFormState>(field: K, value: SnapshotFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {};
    if (!formValues.retirement_account_id) {
      nextErrors.retirement_account_id = "Retirement account is required";
    }
    if (Number(formValues.snapshot_month) < 1 || Number(formValues.snapshot_month) > 12) {
      nextErrors.snapshot_month = "Month must be between 1 and 12";
    }
    if (Number(formValues.snapshot_year) < 2000) {
      nextErrors.snapshot_year = "Year must be 2000 or later";
    }
    if (Number(formValues.opening_balance) < 0) {
      nextErrors.opening_balance = "Opening balance must be zero or higher";
    }
    if (Number(formValues.closing_balance) < 0) {
      nextErrors.closing_balance = "Closing balance must be zero or higher";
    }
    return nextErrors;
  }, [formValues]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validationErrors;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSubmit({
      retirement_account_id: formValues.retirement_account_id,
      snapshot_month: Number(formValues.snapshot_month),
      snapshot_year: Number(formValues.snapshot_year),
      opening_balance: Number(formValues.opening_balance),
      contribution: Number(formValues.contribution),
      interest: Number(formValues.interest),
      closing_balance: Number(formValues.closing_balance),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="retirement_account_id">Retirement Account</Label>
          <select id="retirement_account_id" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.retirement_account_id} onChange={(event) => updateField("retirement_account_id", event.target.value)}>
            <option value="">Select account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_type} • {account.institution} • {account.holder_name}
              </option>
            ))}
          </select>
          {errors.retirement_account_id ? <p className="text-sm text-rose-600">{errors.retirement_account_id}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="snapshot_month">Month</Label>
          <Input id="snapshot_month" type="number" min={1} max={12} value={formValues.snapshot_month} onChange={(event) => updateField("snapshot_month", event.target.value)} />
          {errors.snapshot_month ? <p className="text-sm text-rose-600">{errors.snapshot_month}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="snapshot_year">Year</Label>
          <Input id="snapshot_year" type="number" min={2000} value={formValues.snapshot_year} onChange={(event) => updateField("snapshot_year", event.target.value)} />
          {errors.snapshot_year ? <p className="text-sm text-rose-600">{errors.snapshot_year}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="opening_balance">Opening Balance</Label>
          <Input id="opening_balance" type="number" step="0.01" value={formValues.opening_balance} onChange={(event) => updateField("opening_balance", event.target.value)} />
          {errors.opening_balance ? <p className="text-sm text-rose-600">{errors.opening_balance}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="contribution">Contribution</Label>
          <Input id="contribution" type="number" step="0.01" value={formValues.contribution} onChange={(event) => updateField("contribution", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="interest">Interest</Label>
          <Input id="interest" type="number" step="0.01" value={formValues.interest} onChange={(event) => updateField("interest", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="closing_balance">Closing Balance</Label>
          <Input id="closing_balance" type="number" step="0.01" value={formValues.closing_balance} onChange={(event) => updateField("closing_balance", event.target.value)} />
          {errors.closing_balance ? <p className="text-sm text-rose-600">{errors.closing_balance}</p> : null}
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initialData ? "Save snapshot" : "Add snapshot"}
        </Button>
      </div>
    </form>
  );
}