"use client";

import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Account, AccountCategory, AccountInsert, AccountStatus, LinkedItemType } from "@/types/account";

interface AccountFormProps {
  initialData?: Account | null;
  onSubmit: (values: AccountInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type AccountFormState = {
  name: string;
  category: AccountCategory;
  institution: string;
  owner: string;
  current_value: number | string;
  currency: string;
  status: AccountStatus;
  linked_item_type: LinkedItemType | "";
  linked_item_id: string;
  notes: string;
  documents_placeholder: string;
};

const defaultState = (initialData?: Account | null): AccountFormState => ({
  name: initialData?.name ?? "",
  category: initialData?.category ?? "Bank Account",
  institution: initialData?.institution ?? "",
  owner: initialData?.owner ?? "",
  current_value: initialData?.current_value ?? 0,
  currency: initialData?.currency ?? "INR",
  status: initialData?.status ?? "active",
  linked_item_type: initialData?.linked_item_type ?? "",
  linked_item_id: initialData?.linked_item_id ?? "",
  notes: initialData?.notes ?? "",
  documents_placeholder: initialData?.documents_placeholder ?? "",
});

export function AccountForm({ initialData, onSubmit, onCancel, submitting }: AccountFormProps) {
  const [formValues, setFormValues] = useState<AccountFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof AccountFormState>(field: K, value: AccountFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  const validationErrors = useMemo(() => {
    const nextErrors: Record<string, string> = {};

    if (!formValues.name.trim()) {
      nextErrors.name = "Name is required";
    }

    if (Number(formValues.current_value) < 0) {
      nextErrors.current_value = "Current value must be positive";
    }

    if (!formValues.currency.trim()) {
      nextErrors.currency = "Currency is required";
    }

    if (formValues.linked_item_type && !formValues.linked_item_id.trim()) {
      nextErrors.linked_item_id = "Linked item id is required when a linked type is selected";
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
      category: formValues.category,
      institution: formValues.institution.trim() || null,
      owner: formValues.owner.trim() || null,
      current_value: Number(formValues.current_value),
      currency: formValues.currency.trim().toUpperCase(),
      status: formValues.status,
      linked_item_type: formValues.linked_item_type || null,
      linked_item_id: formValues.linked_item_id.trim() || null,
      notes: formValues.notes.trim() || null,
      documents_placeholder: formValues.documents_placeholder.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={formValues.name} onChange={(event) => updateField("name", event.target.value)} />
          {errors.name ? <p className="text-sm text-rose-600">{errors.name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select id="category" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.category} onChange={(event) => updateField("category", event.target.value as AccountCategory)}>
            <option value="Bank Account">Bank Account</option>
            <option value="Investment">Investment</option>
            <option value="Retirement">Retirement</option>
            <option value="Fixed Income">Fixed Income</option>
            <option value="Real Estate">Real Estate</option>
            <option value="Vehicle">Vehicle</option>
            <option value="Precious Metals">Precious Metals</option>
            <option value="Liability">Liability</option>
            <option value="Insurance">Insurance</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution">Institution</Label>
          <Input id="institution" value={formValues.institution} onChange={(event) => updateField("institution", event.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner">Owner</Label>
          <Input id="owner" value={formValues.owner} onChange={(event) => updateField("owner", event.target.value)} placeholder="Optional" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="current_value">Current Value</Label>
          <Input id="current_value" type="number" step="0.01" value={formValues.current_value} onChange={(event) => updateField("current_value", event.target.value)} />
          {errors.current_value ? <p className="text-sm text-rose-600">{errors.current_value}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" value={formValues.currency} onChange={(event) => updateField("currency", event.target.value)} maxLength={6} />
          {errors.currency ? <p className="text-sm text-rose-600">{errors.currency}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.status} onChange={(event) => updateField("status", event.target.value as AccountStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="linked_item_type">Linked Type</Label>
          <select id="linked_item_type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.linked_item_type} onChange={(event) => updateField("linked_item_type", event.target.value as LinkedItemType | "")}>
            <option value="">None</option>
            <option value="asset">Asset</option>
            <option value="investment">Investment</option>
            <option value="liability">Liability</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="linked_item_id">Linked Item ID</Label>
          <Input id="linked_item_id" value={formValues.linked_item_id} onChange={(event) => updateField("linked_item_id", event.target.value)} placeholder="Optional UUID" />
          {errors.linked_item_id ? <p className="text-sm text-rose-600">{errors.linked_item_id}</p> : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="documents_placeholder">Documents Placeholder</Label>
          <Input id="documents_placeholder" value={formValues.documents_placeholder} onChange={(event) => updateField("documents_placeholder", event.target.value)} placeholder="e.g. Statements, KYC docs, policy PDFs" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={formValues.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add account"}
        </Button>
      </div>
    </form>
  );
}
