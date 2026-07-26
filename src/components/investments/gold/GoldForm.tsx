"use client";

import { useMemo, useState, type FormEvent } from "react";

import { defaultInvestmentDocumentOptions, parseInvestmentDocuments } from "@/components/investments/documents";
import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { computeGoldValues, type GoldType, type GoldUnit } from "@/services/investments/gold";
import type { Investment, InvestmentStatus } from "@/types/investment";

const goldTypes: GoldType[] = [
  "Physical Gold",
  "Gold ETF",
  "Gold Mutual Fund",
  "Digital Gold",
  "Gold Coin",
  "Jewellery",
  "Sovereign Gold Bond",
  "Other",
];

const goldUnits: GoldUnit[] = ["Gram", "Kilogram", "Tola"];

export type GoldFormValues = {
  asset_name: string;
  gold_type: GoldType;
  quantity: number | string;
  unit: GoldUnit;
  purchase_price: number | string;
  current_value: number | string;
  purchase_date: string;
  owner: string;
  storage_location: string;
  status: InvestmentStatus;
  notes: string;
  documentsSelected: string[];
  documentsUploaded: Partial<Record<string, { fileName: string | null; uploadDate: string }>>;
};

interface GoldFormProps {
  initialData?: Investment | null;
  onSubmit: (values: GoldFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

function toAmount(value: number | string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function defaultValues(initialData?: Investment | null): GoldFormValues {
  const parsedDocuments = parseInvestmentDocuments(initialData?.documents_placeholder);
  const documentsSelected = Array.from(new Set(parsedDocuments.map((item) => item.type)));
  const documentsUploaded = parsedDocuments.reduce<GoldFormValues["documentsUploaded"]>((acc, item) => {
    acc[item.type] = {
      fileName: item.fileName,
      uploadDate: item.uploadDate ?? new Date().toISOString().slice(0, 10),
    };
    return acc;
  }, {});

  return {
    asset_name: initialData?.investment_name ?? "",
    gold_type: (initialData?.gold_type as GoldType | undefined) ?? "Physical Gold",
    quantity: initialData?.units ?? "",
    unit: (initialData?.gold_unit as GoldUnit | undefined) ?? "Gram",
    purchase_price: initialData?.average_purchase_price ?? initialData?.purchase_price ?? "",
    current_value: initialData?.current_value ?? "",
    purchase_date: initialData?.purchase_date ?? initialData?.acquisition_date ?? "",
    owner: initialData?.owner ?? "",
    storage_location: initialData?.storage_location ?? "",
    status: initialData?.status ?? "active",
    notes: initialData?.notes ?? "",
    documentsSelected,
    documentsUploaded,
  };
}

export function GoldForm({ initialData, onSubmit, onCancel, submitting, submitLabel }: GoldFormProps) {
  const [values, setValues] = useState<GoldFormValues>(() => defaultValues(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const computed = useMemo(() => {
    return computeGoldValues({
      quantity: toAmount(values.quantity),
      purchasePrice: toAmount(values.purchase_price),
      currentValue: values.current_value === "" ? null : toAmount(values.current_value),
    });
  }, [values.current_value, values.purchase_price, values.quantity]);

  function updateField<K extends keyof GoldFormValues>(field: K, value: GoldFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleDocument(documentType: string) {
    setValues((current) => {
      if (current.documentsSelected.includes(documentType)) {
        return {
          ...current,
          documentsSelected: current.documentsSelected.filter((item) => item !== documentType),
        };
      }

      return {
        ...current,
        documentsSelected: [...current.documentsSelected, documentType],
      };
    });
  }

  function handleDocumentUpload(documentType: string, file: File | null) {
    setValues((current) => {
      const selected = current.documentsSelected.includes(documentType)
        ? current.documentsSelected
        : [...current.documentsSelected, documentType];

      return {
        ...current,
        documentsSelected: selected,
        documentsUploaded: {
          ...current.documentsUploaded,
          [documentType]: {
            fileName: file?.name ?? null,
            uploadDate: new Date().toISOString().slice(0, 10),
          },
        },
      };
    });
  }

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (!values.asset_name.trim()) {
      nextErrors.asset_name = "Asset name is required.";
    }
    if (!values.owner.trim()) {
      nextErrors.owner = "Owner is required.";
    }
    if (toAmount(values.quantity) <= 0) {
      nextErrors.quantity = "Quantity must be greater than zero.";
    }
    if (toAmount(values.purchase_price) < 0) {
      nextErrors.purchase_price = "Purchase price must be zero or greater.";
    }
    if (values.current_value !== "" && toAmount(values.current_value) < 0) {
      nextErrors.current_value = "Current value must be zero or greater.";
    }
    if (!values.purchase_date) {
      nextErrors.purchase_date = "Purchase date is required.";
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

    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormGrid>
        <FormField>
          <Label htmlFor="asset_name">Asset Name</Label>
          <Input id="asset_name" value={values.asset_name} onChange={(event) => updateField("asset_name", event.target.value)} />
          {errors.asset_name ? <p className="text-sm text-rose-600">{errors.asset_name}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="gold_type">Gold Type</Label>
          <select id="gold_type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={values.gold_type} onChange={(event) => updateField("gold_type", event.target.value as GoldType)}>
            {goldTypes.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" type="number" step="0.0001" value={values.quantity} onChange={(event) => updateField("quantity", event.target.value)} />
          {errors.quantity ? <p className="text-sm text-rose-600">{errors.quantity}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="gold_unit">Unit</Label>
          <select id="gold_unit" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={values.unit} onChange={(event) => updateField("unit", event.target.value as GoldUnit)}>
            {goldUnits.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="purchase_price">Purchase Price</Label>
          <Input id="purchase_price" type="number" step="0.01" value={values.purchase_price} onChange={(event) => updateField("purchase_price", event.target.value)} />
          {errors.purchase_price ? <p className="text-sm text-rose-600">{errors.purchase_price}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="current_value">Current Value (Optional)</Label>
          <Input id="current_value" type="number" step="0.01" value={values.current_value} onChange={(event) => updateField("current_value", event.target.value)} />
          {errors.current_value ? <p className="text-sm text-rose-600">{errors.current_value}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="purchase_date">Purchase Date</Label>
          <Input id="purchase_date" type="date" value={values.purchase_date} onChange={(event) => updateField("purchase_date", event.target.value)} />
          {errors.purchase_date ? <p className="text-sm text-rose-600">{errors.purchase_date}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="owner">Owner</Label>
          <Input id="owner" value={values.owner} onChange={(event) => updateField("owner", event.target.value)} />
          {errors.owner ? <p className="text-sm text-rose-600">{errors.owner}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="storage_location">Storage Location (Optional)</Label>
          <Input id="storage_location" value={values.storage_location} onChange={(event) => updateField("storage_location", event.target.value)} />
        </FormField>

        <FormField>
          <Label htmlFor="status">Status</Label>
          <select id="status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={values.status} onChange={(event) => updateField("status", event.target.value as InvestmentStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="closed">Closed</option>
          </select>
        </FormField>
      </FormGrid>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-700">Calculated Values</p>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <div>Total Invested: <span className="font-semibold text-slate-900">{formatCurrency(computed.totalInvested, { maximumFractionDigits: 0 })}</span></div>
          <div>Current Value: <span className="font-semibold text-slate-900">{formatCurrency(computed.currentValue, { maximumFractionDigits: 0 })}</span></div>
          <div>Gain / Loss: <span className={`font-semibold ${computed.gainLoss >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatCurrency(computed.gainLoss, { maximumFractionDigits: 0 })}</span></div>
        </div>
      </div>

      <FormField>
        <Label>Documents</Label>
        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          {defaultInvestmentDocumentOptions.map((documentType) => (
            <div key={documentType} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={values.documentsSelected.includes(documentType)} onChange={() => toggleDocument(documentType)} />
                <span>{documentType}</span>
              </label>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={(event) => handleDocumentUpload(documentType, event.target.files?.[0] ?? null)} />
                <span className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Upload</span>
              </label>
            </div>
          ))}
        </div>
      </FormField>

      <FormField>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </FormField>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : submitLabel ?? "Save Gold Holding"}</Button>
      </FormActions>
    </form>
  );
}
