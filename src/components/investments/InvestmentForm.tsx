"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getInvestmentCategoryMeta, primaryInvestmentCategories } from "@/components/investments/investmentCategoryMeta";
import type { Investment, InvestmentCategory, InvestmentInsert, InvestmentStatus } from "@/types/investment";

const categories: InvestmentCategory[] = primaryInvestmentCategories;

type InvestmentFormState = {
  owner: string;
  institution: string;
  investment_name: string;
  investment_type: InvestmentCategory;
  acquisition_date: string;
  cost_value: number | string;
  current_value: number | string;
  status: InvestmentStatus;
  notes: string;
};

interface InvestmentFormProps {
  initialData?: Investment | null;
  onSubmit: (values: InvestmentInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

function defaultState(initialData?: Investment | null): InvestmentFormState {
  return {
    owner: initialData?.owner ?? "",
    institution: initialData?.institution ?? "",
    investment_name: initialData?.investment_name ?? "",
    investment_type: initialData?.investment_type ?? initialData?.category ?? "Mutual Funds",
    acquisition_date: initialData?.acquisition_date ?? initialData?.purchase_date ?? "",
    cost_value: initialData?.cost_value ?? initialData?.cost_basis ?? 0,
    current_value: initialData?.current_value ?? 0,
    status: initialData?.status ?? "active",
    notes: initialData?.notes ?? "",
  };
}

export function InvestmentForm({ initialData, onSubmit, onCancel, submitting, submitLabel }: InvestmentFormProps) {
  const [values, setValues] = useState<InvestmentFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof InvestmentFormState>(field: K, value: InvestmentFormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!values.owner.trim()) {
      nextErrors.owner = "Owner is required.";
    }
    if (!values.institution.trim()) {
      nextErrors.institution = "Institution is required.";
    }
    if (!values.investment_name.trim()) {
      nextErrors.investment_name = "Investment name is required.";
    }
    if (Number(values.cost_value) < 0) {
      nextErrors.cost_value = "Cost value must be zero or higher.";
    }
    if (Number(values.current_value) < 0) {
      nextErrors.current_value = "Current value must be zero or higher.";
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
      owner: values.owner.trim(),
      institution: values.institution.trim(),
      investment_name: values.investment_name.trim(),
      investment_type: values.investment_type,
      category: values.investment_type,
      acquisition_date: values.acquisition_date || null,
      purchase_date: values.acquisition_date || null,
      cost_value: Number(values.cost_value),
      current_value: Number(values.current_value),
      status: values.status,
      notes: values.notes.trim() || null,
      cost_basis: Number(values.cost_value),
      units: 1,
      nav_price: Number(values.current_value),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormGrid>
        <FormField>
          <Label htmlFor="owner">Owner</Label>
          <Input id="owner" value={values.owner} onChange={(event) => updateField("owner", event.target.value)} />
          {errors.owner ? <p className="text-sm text-rose-600">{errors.owner}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="institution">Institution</Label>
          <Input id="institution" value={values.institution} onChange={(event) => updateField("institution", event.target.value)} />
          {errors.institution ? <p className="text-sm text-rose-600">{errors.institution}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="investment_name">Investment Name</Label>
          <Input id="investment_name" value={values.investment_name} onChange={(event) => updateField("investment_name", event.target.value)} />
          {errors.investment_name ? <p className="text-sm text-rose-600">{errors.investment_name}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="investment_type">Investment Type</Label>
          <select
            id="investment_type"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.investment_type}
            onChange={(event) => updateField("investment_type", event.target.value as InvestmentCategory)}
          >
            {categories.map((category) => (
              <option key={category} value={category}>{getInvestmentCategoryMeta(category).displayName}</option>
            ))}
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="acquisition_date">Acquisition Date</Label>
          <Input id="acquisition_date" type="date" value={values.acquisition_date} onChange={(event) => updateField("acquisition_date", event.target.value)} />
        </FormField>

        <FormField>
          <Label htmlFor="cost_value">Cost Value</Label>
          <Input id="cost_value" type="number" step="0.01" value={values.cost_value} onChange={(event) => updateField("cost_value", event.target.value)} />
          {errors.cost_value ? <p className="text-sm text-rose-600">{errors.cost_value}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="current_value">Current Value</Label>
          <Input id="current_value" type="number" step="0.01" value={values.current_value} onChange={(event) => updateField("current_value", event.target.value)} />
          {errors.current_value ? <p className="text-sm text-rose-600">{errors.current_value}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.status}
            onChange={(event) => updateField("status", event.target.value as InvestmentStatus)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed</option>
          </select>
        </FormField>
      </FormGrid>

      <FormField>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </FormField>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : initialData ? "Save changes" : submitLabel ?? "Add Investment"}</Button>
      </FormActions>
    </form>
  );
}
