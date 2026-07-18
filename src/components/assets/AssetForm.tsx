"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Asset, AssetInsert } from "@/types/asset";

interface AssetFormProps {
  initialData?: Asset | null;
  onSubmit: (values: AssetInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type AssetFormState = {
  asset_type: string;
  asset_name: string;
  institution: string;
  current_value: number | string;
  purchase_value: number | string;
  purchase_date: string;
  owner: string;
  notes: string;
};

export function AssetForm({ initialData, onSubmit, onCancel, submitting }: AssetFormProps) {
  const [formValues, setFormValues] = useState<AssetFormState>(() => ({
    asset_type: initialData?.asset_type ?? "cash",
    asset_name: initialData?.asset_name ?? "",
    institution: initialData?.institution ?? "",
    current_value: initialData?.current_value ?? 0,
    purchase_value: initialData?.purchase_value ?? "",
    purchase_date: initialData?.purchase_date ?? "",
    owner: initialData?.owner ?? "",
    notes: initialData?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(values: AssetFormState) {
    const nextErrors: Record<string, string> = {};
    if (!values.asset_name.trim()) {
      nextErrors.asset_name = "Asset name is required";
    }
    if (!values.asset_type.trim()) {
      nextErrors.asset_type = "Asset type is required";
    }
    if (Number(values.current_value) < 0) {
      nextErrors.current_value = "Current value must be positive";
    }
    if (values.purchase_value && Number(values.purchase_value) < 0) {
      nextErrors.purchase_value = "Purchase value must be positive";
    }
    return nextErrors;
  }

  function updateField<K extends keyof AssetFormState>(field: K, value: AssetFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(formValues);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSubmit({
      asset_type: formValues.asset_type as Asset["asset_type"],
      asset_name: formValues.asset_name,
      institution: formValues.institution || null,
      current_value: Number(formValues.current_value),
      purchase_value: formValues.purchase_value ? Number(formValues.purchase_value) : null,
      purchase_date: formValues.purchase_date || null,
      owner: formValues.owner || null,
      notes: formValues.notes || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="asset_type">Asset type</Label>
          <select
            id="asset_type"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={formValues.asset_type}
            onChange={(event) => updateField("asset_type", event.target.value)}
          >
            <option value="cash">Cash</option>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="investment">Investment</option>
            <option value="real_estate">Real Estate</option>
            <option value="vehicle">Vehicle</option>
            <option value="business">Business</option>
            <option value="other">Other</option>
          </select>
          {errors.asset_type ? <p className="text-sm text-rose-600">{errors.asset_type}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="asset_name">Asset name</Label>
          <Input
            id="asset_name"
            value={formValues.asset_name}
            onChange={(event) => updateField("asset_name", event.target.value)}
          />
          {errors.asset_name ? <p className="text-sm text-rose-600">{errors.asset_name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution">Institution</Label>
          <Input
            id="institution"
            value={formValues.institution}
            onChange={(event) => updateField("institution", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="owner">Owner</Label>
          <Input id="owner" value={formValues.owner} onChange={(event) => updateField("owner", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="current_value">Current value</Label>
          <Input
            id="current_value"
            type="number"
            step="0.01"
            value={formValues.current_value}
            onChange={(event) => updateField("current_value", event.target.value)}
          />
          {errors.current_value ? <p className="text-sm text-rose-600">{errors.current_value}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_value">Purchase value</Label>
          <Input
            id="purchase_value"
            type="number"
            step="0.01"
            value={formValues.purchase_value}
            onChange={(event) => updateField("purchase_value", event.target.value)}
          />
          {errors.purchase_value ? <p className="text-sm text-rose-600">{errors.purchase_value}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_date">Purchase date</Label>
          <Input
            id="purchase_date"
            type="date"
            value={formValues.purchase_date}
            onChange={(event) => updateField("purchase_date", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={4}
          value={formValues.notes}
          onChange={(event) => updateField("notes", event.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add asset"}
        </Button>
      </div>
    </form>
  );
}
