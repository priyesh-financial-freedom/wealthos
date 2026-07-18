"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Investment, InvestmentInsert } from "@/types/investment";

interface InvestmentFormProps {
  initialData?: Investment | null;
  onSubmit: (values: InvestmentInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type InvestmentFormState = {
  investment_name: string;
  category: InvestmentInsert["category"];
  units: number | string;
  nav_price: number | string;
  cost_basis: number | string;
  today_gain_loss: number | string;
  sector: string;
  amc: string;
  region: InvestmentInsert["region"];
  purchase_date: string;
  notes: string;
};

const categories: InvestmentInsert["category"][] = [
  "Mutual Funds",
  "Stocks",
  "ETFs",
  "Bonds",
  "Fixed Deposits",
  "EPF",
  "PPF",
  "NPS",
  "Gold",
  "Silver",
  "Sovereign Gold Bonds",
  "Crypto",
  "Cash Equivalents",
];

const defaultState = (initialData?: Investment | null): InvestmentFormState => ({
  investment_name: initialData?.investment_name ?? "",
  category: initialData?.category ?? "Mutual Funds",
  units: initialData?.units ?? 0,
  nav_price: initialData?.nav_price ?? 0,
  cost_basis: initialData?.cost_basis ?? 0,
  today_gain_loss: initialData?.today_gain_loss ?? 0,
  sector: initialData?.sector ?? "",
  amc: initialData?.amc ?? "",
  region: initialData?.region ?? "Domestic",
  purchase_date: initialData?.purchase_date ?? "",
  notes: initialData?.notes ?? "",
});

export function InvestmentForm({ initialData, onSubmit, onCancel, submitting }: InvestmentFormProps) {
  const [formValues, setFormValues] = useState<InvestmentFormState>(() => defaultState(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateField<K extends keyof InvestmentFormState>(field: K, value: InvestmentFormState[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  function validate(values: InvestmentFormState) {
    const nextErrors: Record<string, string> = {};

    if (!values.investment_name.trim()) {
      nextErrors.investment_name = "Investment name is required";
    }
    if (!values.category) {
      nextErrors.category = "Category is required";
    }
    if (Number(values.units) <= 0) {
      nextErrors.units = "Units must be greater than zero";
    }
    if (Number(values.nav_price) < 0) {
      nextErrors.nav_price = "NAV / price must be positive";
    }
    if (Number(values.cost_basis) < 0) {
      nextErrors.cost_basis = "Cost basis must be positive";
    }
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(formValues);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSubmit({
      investment_name: formValues.investment_name,
      category: formValues.category,
      units: Number(formValues.units),
      nav_price: Number(formValues.nav_price),
      cost_basis: Number(formValues.cost_basis),
      today_gain_loss: Number(formValues.today_gain_loss),
      sector: formValues.sector || null,
      amc: formValues.amc || null,
      region: formValues.region,
      purchase_date: formValues.purchase_date || null,
      notes: formValues.notes || null,
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="investment_name">Name</Label>
          <Input id="investment_name" value={formValues.investment_name} onChange={(event) => updateField("investment_name", event.target.value)} />
          {errors.investment_name ? <p className="text-sm text-rose-600">{errors.investment_name}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={formValues.category}
            onChange={(event) => updateField("category", event.target.value as InvestmentInsert["category"])}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category ? <p className="text-sm text-rose-600">{errors.category}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <select id="region" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.region} onChange={(event) => updateField("region", event.target.value as InvestmentInsert["region"])}>
            <option value="Domestic">Domestic</option>
            <option value="International">International</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="units">Units</Label>
          <Input id="units" type="number" step="0.0001" value={formValues.units} onChange={(event) => updateField("units", event.target.value)} />
          {errors.units ? <p className="text-sm text-rose-600">{errors.units}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="nav_price">NAV / Price</Label>
          <Input id="nav_price" type="number" step="0.0001" value={formValues.nav_price} onChange={(event) => updateField("nav_price", event.target.value)} />
          {errors.nav_price ? <p className="text-sm text-rose-600">{errors.nav_price}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cost_basis">Cost basis</Label>
          <Input id="cost_basis" type="number" step="0.01" value={formValues.cost_basis} onChange={(event) => updateField("cost_basis", event.target.value)} />
          {errors.cost_basis ? <p className="text-sm text-rose-600">{errors.cost_basis}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="today_gain_loss">Today&apos;s gain/loss</Label>
          <Input id="today_gain_loss" type="number" step="0.01" value={formValues.today_gain_loss} onChange={(event) => updateField("today_gain_loss", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sector">Sector</Label>
          <Input id="sector" value={formValues.sector} onChange={(event) => updateField("sector", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amc">AMC / Issuer</Label>
          <Input id="amc" value={formValues.amc} onChange={(event) => updateField("amc", event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purchase_date">Purchase date</Label>
          <Input id="purchase_date" type="date" value={formValues.purchase_date} onChange={(event) => updateField("purchase_date", event.target.value)} />
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
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add investment"}
        </Button>
      </div>
    </form>
  );
}