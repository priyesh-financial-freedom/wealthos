"use client";

import { useMemo, useState, type FormEvent } from "react";

import { UNIVERSAL_ACCOUNT_TYPES } from "@/features/accountEngine/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UniversalAccount, UniversalAccountInsert, UniversalAccountStatus, UniversalAccountType } from "@/types/universalAccount";

interface UniversalAccountFormProps {
  initialData?: UniversalAccount | null;
  onSubmit: (values: UniversalAccountInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type UniversalAccountFormState = {
  name: string;
  institution: string;
  account_type: UniversalAccountType;
  owner: string;
  joint_owner: string;
  nominee: string;
  opening_value: number | string;
  current_value: number | string;
  currency: string;
  purchase_date: string;
  interest_rate: number | string;
  maturity_date: string;
  status: UniversalAccountStatus;
  notes: string;
};

const defaultState = (initialData?: UniversalAccount | null): UniversalAccountFormState => ({
  name: initialData?.name ?? "",
  institution: initialData?.institution ?? "",
  account_type: initialData?.account_type ?? "Savings Account",
  owner: initialData?.owner ?? "",
  joint_owner: initialData?.joint_owner ?? "",
  nominee: initialData?.nominee ?? "",
  opening_value: initialData?.opening_value ?? 0,
  current_value: initialData?.current_value ?? 0,
  currency: initialData?.currency ?? "INR",
  purchase_date: initialData?.purchase_date ?? "",
  interest_rate: initialData?.interest_rate ?? "",
  maturity_date: initialData?.maturity_date ?? "",
  status: initialData?.status ?? "active",
  notes: initialData?.notes ?? "",
});

export function UniversalAccountForm({ initialData, onSubmit, onCancel, submitting }: UniversalAccountFormProps) {
  const [formValues, setFormValues] = useState<UniversalAccountFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedTypeConfig = useMemo(
    () => UNIVERSAL_ACCOUNT_TYPES.find((entry) => entry.type === formValues.account_type),
    [formValues.account_type],
  );

  function updateField<K extends keyof UniversalAccountFormState>(field: K, value: UniversalAccountFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {};
    if (!formValues.name.trim()) {
      nextErrors.name = "Name is required";
    }
    if (Number(formValues.opening_value) < 0) {
      nextErrors.opening_value = "Opening value must be positive";
    }
    if (Number(formValues.current_value) < 0) {
      nextErrors.current_value = "Current value must be positive";
    }
    if (!formValues.currency.trim()) {
      nextErrors.currency = "Currency is required";
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
      name: formValues.name.trim(),
      institution: formValues.institution.trim() || null,
      account_type: formValues.account_type,
      owner: formValues.owner.trim() || null,
      joint_owner: formValues.joint_owner.trim() || null,
      nominee: formValues.nominee.trim() || null,
      opening_value: Number(formValues.opening_value),
      current_value: Number(formValues.current_value),
      currency: formValues.currency.trim().toUpperCase(),
      purchase_date: formValues.purchase_date || null,
      interest_rate: selectedTypeConfig?.supportsInterest && formValues.interest_rate !== "" ? Number(formValues.interest_rate) : null,
      maturity_date: selectedTypeConfig?.supportsMaturity ? formValues.maturity_date || null : null,
      status: formValues.status,
      notes: formValues.notes.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" error={errors.name}>
          <Input value={formValues.name} onChange={(event) => updateField("name", event.target.value)} />
        </Field>

        <Field label="Institution">
          <Input value={formValues.institution} onChange={(event) => updateField("institution", event.target.value)} />
        </Field>

        <Field label="Account Type">
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.account_type} onChange={(event) => updateField("account_type", event.target.value as UniversalAccountType)}>
            {UNIVERSAL_ACCOUNT_TYPES.map((entry) => (
              <option key={entry.type} value={entry.type}>{entry.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Status">
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.status} onChange={(event) => updateField("status", event.target.value as UniversalAccountStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </Field>

        <Field label="Owner">
          <Input value={formValues.owner} onChange={(event) => updateField("owner", event.target.value)} />
        </Field>

        <Field label="Joint Owner">
          <Input value={formValues.joint_owner} onChange={(event) => updateField("joint_owner", event.target.value)} />
        </Field>

        <Field label="Nominee">
          <Input value={formValues.nominee} onChange={(event) => updateField("nominee", event.target.value)} />
        </Field>

        <Field label="Currency" error={errors.currency}>
          <Input value={formValues.currency} onChange={(event) => updateField("currency", event.target.value)} maxLength={6} />
        </Field>

        <Field label="Opening Value" error={errors.opening_value}>
          <Input type="number" step="0.01" value={formValues.opening_value} onChange={(event) => updateField("opening_value", event.target.value)} />
        </Field>

        <Field label="Current Value" error={errors.current_value}>
          <Input type="number" step="0.01" value={formValues.current_value} onChange={(event) => updateField("current_value", event.target.value)} />
        </Field>

        <Field label="Purchase Date">
          <Input type="date" value={formValues.purchase_date} onChange={(event) => updateField("purchase_date", event.target.value)} />
        </Field>

        <Field label={`Interest Rate ${selectedTypeConfig?.supportsInterest ? "" : "(not applicable)"}`}>
          <Input type="number" step="0.001" disabled={!selectedTypeConfig?.supportsInterest} value={formValues.interest_rate} onChange={(event) => updateField("interest_rate", event.target.value)} />
        </Field>

        <Field label={`Maturity Date ${selectedTypeConfig?.supportsMaturity ? "" : "(not applicable)"}`}>
          <Input type="date" disabled={!selectedTypeConfig?.supportsMaturity} value={formValues.maturity_date} onChange={(event) => updateField("maturity_date", event.target.value)} />
        </Field>
      </div>

      <div className="space-y-2">
        <Label htmlFor="universal-account-notes">Notes</Label>
        <Textarea id="universal-account-notes" rows={4} value={formValues.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : initialData ? "Save changes" : "Add account"}</Button>
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
