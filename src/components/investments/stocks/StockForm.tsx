"use client";

import { useMemo, useState, type FormEvent } from "react";

import { OWNERSHIP_OPTIONS } from "@/lib/family";
import { defaultInvestmentDocumentOptions, parseInvestmentDocuments } from "@/components/investments/documents";
import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Investment, InvestmentStatus } from "@/types/investment";

export type StockFormValues = {
  investment_name: string;
  owner: string;
  demat_account_provider: string;
  demat_account_number: string;
  broker: string;
  exchange: string;
  institution: string;
  isin: string;
  acquisition_date: string;
  units: number | string;
  average_purchase_price: number | string;
  cost_value: number | string;
  current_value: number | string;
  sector: string;
  status: InvestmentStatus;
  notes: string;
  documentsSelected: string[];
  documentsUploaded: Partial<Record<string, { fileName: string | null; uploadDate: string }>>;
};

interface StockFormProps {
  initialData?: Investment | null;
  onSubmit: (values: StockFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

function toAmount(value: number | string) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function defaultValues(initialData?: Investment | null): StockFormValues {
  const parsedDocuments = parseInvestmentDocuments(initialData?.documents_placeholder);
  const documentsSelected = Array.from(new Set(parsedDocuments.map((item) => item.type)));
  const documentsUploaded = parsedDocuments.reduce<StockFormValues["documentsUploaded"]>((acc, item) => {
    acc[item.type] = {
      fileName: item.fileName,
      uploadDate: item.uploadDate ?? new Date().toISOString().slice(0, 10),
    };
    return acc;
  }, {});

  return {
    investment_name: initialData?.investment_name ?? "",
    owner: initialData?.owner ?? "Priyesh",
    demat_account_provider: initialData?.demat_account_provider ?? "",
    demat_account_number: initialData?.demat_account_number ?? "",
    broker: initialData?.broker ?? "",
    exchange: initialData?.exchange ?? "",
    institution: initialData?.institution ?? "",
    isin: initialData?.isin ?? "",
    acquisition_date: initialData?.acquisition_date ?? initialData?.purchase_date ?? "",
    units: initialData?.units ?? "",
    average_purchase_price: initialData?.average_purchase_price ?? "",
    cost_value: initialData?.cost_value ?? initialData?.cost_basis ?? "",
    current_value: initialData?.current_value ?? "",
    sector: initialData?.sector ?? "",
    status: initialData?.status ?? "active",
    notes: initialData?.notes ?? "",
    documentsSelected,
    documentsUploaded,
  };
}

export function StockForm({ initialData, onSubmit, onCancel, submitting, submitLabel }: StockFormProps) {
  const [values, setValues] = useState<StockFormValues>(() => defaultValues(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const derivedCostValue = useMemo(() => {
    const units = toAmount(values.units);
    const avgPurchasePrice = toAmount(values.average_purchase_price);
    if (units <= 0 || avgPurchasePrice <= 0) {
      return null;
    }

    return Number((units * avgPurchasePrice).toFixed(2));
  }, [values.average_purchase_price, values.units]);

  function updateField<K extends keyof StockFormValues>(field: K, value: StockFormValues[K]) {
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

    if (!values.investment_name.trim()) {
      nextErrors.investment_name = "Stock name is required.";
    }
    if (!values.owner.trim()) {
      nextErrors.owner = "Owner is required.";
    }
    if (!values.demat_account_number.trim()) {
      nextErrors.demat_account_number = "Demat account number is required.";
    }
    if (!values.isin.trim()) {
      nextErrors.isin = "ISIN is required.";
    }
    if (toAmount(values.units) < 0) {
      nextErrors.units = "Units must be zero or higher.";
    }
    if (toAmount(values.average_purchase_price) < 0) {
      nextErrors.average_purchase_price = "Average purchase price must be zero or higher.";
    }
    if (toAmount(values.cost_value) < 0) {
      nextErrors.cost_value = "Cost value must be zero or higher.";
    }
    if (toAmount(values.current_value) < 0) {
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

    await onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormGrid>
        <FormField>
          <Label htmlFor="stock_name">Stock Name</Label>
          <Input id="stock_name" value={values.investment_name} onChange={(event) => updateField("investment_name", event.target.value)} />
          {errors.investment_name ? <p className="text-sm text-rose-600">{errors.investment_name}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="isin">ISIN</Label>
          <Input id="isin" value={values.isin} onChange={(event) => updateField("isin", event.target.value.toUpperCase())} placeholder="INE123A01016" />
          {errors.isin ? <p className="text-sm text-rose-600">{errors.isin}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="owner">Owner</Label>
          <select
            id="owner"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.owner}
            onChange={(event) => updateField("owner", event.target.value)}
          >
            {OWNERSHIP_OPTIONS.map((owner) => (
              <option key={owner} value={owner}>{owner}</option>
            ))}
          </select>
          {errors.owner ? <p className="text-sm text-rose-600">{errors.owner}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="demat_account_provider">Demat Provider</Label>
          <Input id="demat_account_provider" value={values.demat_account_provider} onChange={(event) => updateField("demat_account_provider", event.target.value)} placeholder="NSDL, CDSL, Zerodha, Groww" />
        </FormField>

        <FormField>
          <Label htmlFor="demat_account_number">Demat Account Number</Label>
          <Input id="demat_account_number" value={values.demat_account_number} onChange={(event) => updateField("demat_account_number", event.target.value)} />
          {errors.demat_account_number ? <p className="text-sm text-rose-600">{errors.demat_account_number}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="broker">Broker</Label>
          <Input id="broker" value={values.broker} onChange={(event) => updateField("broker", event.target.value)} />
        </FormField>

        <FormField>
          <Label htmlFor="exchange">Exchange</Label>
          <Input id="exchange" value={values.exchange} onChange={(event) => updateField("exchange", event.target.value)} placeholder="NSE or BSE" />
        </FormField>

        <FormField>
          <Label htmlFor="institution">Institution</Label>
          <Input id="institution" value={values.institution} onChange={(event) => updateField("institution", event.target.value)} placeholder="Broker institution (optional)" />
        </FormField>

        <FormField>
          <Label htmlFor="acquisition_date">Acquisition Date</Label>
          <Input id="acquisition_date" type="date" value={values.acquisition_date} onChange={(event) => updateField("acquisition_date", event.target.value)} />
        </FormField>

        <FormField>
          <Label htmlFor="units">Units</Label>
          <Input id="units" type="number" step="0.0001" value={values.units} onChange={(event) => updateField("units", event.target.value)} />
          {errors.units ? <p className="text-sm text-rose-600">{errors.units}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="average_purchase_price">Average Purchase Price</Label>
          <Input id="average_purchase_price" type="number" step="0.0001" value={values.average_purchase_price} onChange={(event) => updateField("average_purchase_price", event.target.value)} />
          {errors.average_purchase_price ? <p className="text-sm text-rose-600">{errors.average_purchase_price}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="cost_value">Cost Value</Label>
          <Input id="cost_value" type="number" step="0.01" value={values.cost_value} onChange={(event) => updateField("cost_value", event.target.value)} />
          {derivedCostValue !== null ? <p className="text-xs text-slate-500">Units × Avg Price: {derivedCostValue.toFixed(2)}</p> : null}
          {errors.cost_value ? <p className="text-sm text-rose-600">{errors.cost_value}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="current_value">Current Value</Label>
          <Input id="current_value" type="number" step="0.01" value={values.current_value} onChange={(event) => updateField("current_value", event.target.value)} />
          {errors.current_value ? <p className="text-sm text-rose-600">{errors.current_value}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="sector">Sector</Label>
          <Input id="sector" value={values.sector} onChange={(event) => updateField("sector", event.target.value)} />
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
        <Label>Documents</Label>
        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          {defaultInvestmentDocumentOptions.map((documentType) => (
            <div key={documentType} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={values.documentsSelected.includes(documentType)} onChange={() => toggleDocument(documentType)} />
                <span>{documentType}</span>
              </label>
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => handleDocumentUpload(documentType, event.target.files?.[0] ?? null)}
                />
                <span className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">Upload</span>
              </label>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1 text-xs text-slate-600">
          {Object.entries(values.documentsUploaded).map(([key, metadata]) => (
            <p key={key}>{key}: {metadata?.fileName ?? "Not uploaded"} ({metadata?.uploadDate ?? "NA"})</p>
          ))}
          {Object.entries(values.documentsUploaded).length === 0 ? <p>No documents selected.</p> : null}
        </div>
      </FormField>

      <FormField>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </FormField>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : submitLabel ?? "Save Stock"}</Button>
      </FormActions>
    </form>
  );
}
