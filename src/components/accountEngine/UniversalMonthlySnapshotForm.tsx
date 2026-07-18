"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  UniversalAccount,
  UniversalAccountMonthlySnapshot,
  UniversalAccountMonthlySnapshotInsert,
} from "@/types/universalAccount";

interface UniversalMonthlySnapshotFormProps {
  accounts: UniversalAccount[];
  initialData?: UniversalAccountMonthlySnapshot | null;
  onSubmit: (values: UniversalAccountMonthlySnapshotInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type SnapshotFormState = {
  universal_account_id: string;
  snapshot_month: number | string;
  snapshot_year: number | string;
  opening_value: number | string;
  contribution: number | string;
  withdrawal: number | string;
  closing_value: number | string;
  interest: number | string;
  dividend: number | string;
  gain_loss: number | string;
  notes: string;
};

const currentDate = new Date();

const defaultState = (accounts: UniversalAccount[], initialData?: UniversalAccountMonthlySnapshot | null): SnapshotFormState => ({
  universal_account_id: initialData?.universal_account_id ?? accounts[0]?.id ?? "",
  snapshot_month: initialData?.snapshot_month ?? currentDate.getMonth() + 1,
  snapshot_year: initialData?.snapshot_year ?? currentDate.getFullYear(),
  opening_value: initialData?.opening_value ?? 0,
  contribution: initialData?.contribution ?? 0,
  withdrawal: initialData?.withdrawal ?? 0,
  closing_value: initialData?.closing_value ?? 0,
  interest: initialData?.interest ?? 0,
  dividend: initialData?.dividend ?? 0,
  gain_loss: initialData?.gain_loss ?? 0,
  notes: initialData?.notes ?? "",
});

export function UniversalMonthlySnapshotForm({ accounts, initialData, onSubmit, onCancel, submitting }: UniversalMonthlySnapshotFormProps) {
  const [formValues, setFormValues] = useState<SnapshotFormState>(() => defaultState(accounts, initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof SnapshotFormState>(field: K, value: SnapshotFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const preview = useMemo(() => {
    const opening = Number(formValues.opening_value ?? 0);
    const closing = Number(formValues.closing_value ?? 0);
    const monthlyGrowth = closing - opening;
    const cashFlow = Number(formValues.contribution ?? 0) - Number(formValues.withdrawal ?? 0);
    return { monthlyGrowth, cashFlow };
  }, [formValues]);

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (!formValues.universal_account_id) {
      nextErrors.universal_account_id = "Account is required";
    }
    if (Number(formValues.snapshot_month) < 1 || Number(formValues.snapshot_month) > 12) {
      nextErrors.snapshot_month = "Month must be between 1 and 12";
    }
    if (Number(formValues.snapshot_year) < 2000) {
      nextErrors.snapshot_year = "Year must be 2000 or later";
    }

    const numericFields: Array<keyof SnapshotFormState> = ["opening_value", "contribution", "withdrawal", "closing_value", "interest", "dividend"];
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
      universal_account_id: formValues.universal_account_id,
      snapshot_month: Number(formValues.snapshot_month),
      snapshot_year: Number(formValues.snapshot_year),
      opening_value: Number(formValues.opening_value),
      contribution: Number(formValues.contribution),
      withdrawal: Number(formValues.withdrawal),
      closing_value: Number(formValues.closing_value),
      interest: Number(formValues.interest),
      dividend: Number(formValues.dividend),
      gain_loss: Number(formValues.gain_loss),
      notes: formValues.notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="ua-account-id">Account</Label>
          <select id="ua-account-id" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.universal_account_id} onChange={(event) => updateField("universal_account_id", event.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name} • {account.account_type}</option>
            ))}
          </select>
          {errors.universal_account_id ? <p className="text-sm text-rose-600">{errors.universal_account_id}</p> : null}
        </div>

        <Field label="Month" error={errors.snapshot_month}>
          <Input type="number" min="1" max="12" value={formValues.snapshot_month} onChange={(event) => updateField("snapshot_month", event.target.value)} />
        </Field>
        <Field label="Year" error={errors.snapshot_year}>
          <Input type="number" min="2000" value={formValues.snapshot_year} onChange={(event) => updateField("snapshot_year", event.target.value)} />
        </Field>

        <Field label="Opening Value" error={errors.opening_value}>
          <Input type="number" step="0.01" value={formValues.opening_value} onChange={(event) => updateField("opening_value", event.target.value)} />
        </Field>
        <Field label="Contribution" error={errors.contribution}>
          <Input type="number" step="0.01" value={formValues.contribution} onChange={(event) => updateField("contribution", event.target.value)} />
        </Field>
        <Field label="Withdrawal" error={errors.withdrawal}>
          <Input type="number" step="0.01" value={formValues.withdrawal} onChange={(event) => updateField("withdrawal", event.target.value)} />
        </Field>
        <Field label="Closing Value" error={errors.closing_value}>
          <Input type="number" step="0.01" value={formValues.closing_value} onChange={(event) => updateField("closing_value", event.target.value)} />
        </Field>
        <Field label="Interest" error={errors.interest}>
          <Input type="number" step="0.01" value={formValues.interest} onChange={(event) => updateField("interest", event.target.value)} />
        </Field>
        <Field label="Dividend" error={errors.dividend}>
          <Input type="number" step="0.01" value={formValues.dividend} onChange={(event) => updateField("dividend", event.target.value)} />
        </Field>
        <Field label="Gain/Loss">
          <Input type="number" step="0.01" value={formValues.gain_loss} onChange={(event) => updateField("gain_loss", event.target.value)} />
        </Field>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <p>Monthly Growth: <span className={`font-semibold ${preview.monthlyGrowth >= 0 ? "text-emerald-700" : "text-rose-700"}`}>${preview.monthlyGrowth.toLocaleString()}</span></p>
        <p>Cash Flow: <span className={`font-semibold ${preview.cashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}>${preview.cashFlow.toLocaleString()}</span></p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ua-snapshot-notes">Notes</Label>
        <Textarea id="ua-snapshot-notes" rows={3} value={formValues.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : initialData ? "Save changes" : "Add snapshot"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
