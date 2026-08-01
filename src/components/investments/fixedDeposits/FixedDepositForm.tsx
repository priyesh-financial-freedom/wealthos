"use client";

import { useMemo, useState, type FormEvent } from "react";

import { OWNERSHIP_OPTIONS } from "@/lib/family";
import { defaultInvestmentDocumentOptions, parseInvestmentDocuments } from "@/components/investments/documents";
import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { computeFixedDepositValues, type FdCompoundingFrequency, type FdPayoutType } from "@/services/investments/fixedDeposits";
import type { Investment, InvestmentStatus } from "@/types/investment";

export type FixedDepositFormValues = {
  investment_name: string;
  owner: string;
  institution: string;
  fd_number: string;
  principal: number | string;
  interest_rate: number | string;
  compounding_frequency: FdCompoundingFrequency;
  payout_type: FdPayoutType;
  start_date: string;
  maturity_date: string;
  status: InvestmentStatus;
  notes: string;
  documentsSelected: string[];
  documentsUploaded: Partial<Record<string, { fileName: string | null; uploadDate: string }>>;
};

interface FixedDepositFormProps {
  initialData?: Investment | null;
  onSubmit: (values: FixedDepositFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

function toAmount(value: number | string) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function defaultValues(initialData?: Investment | null): FixedDepositFormValues {
  const parsedDocuments = parseInvestmentDocuments(initialData?.documents_placeholder);
  const documentsSelected = Array.from(new Set(parsedDocuments.map((item) => item.type)));
  const documentsUploaded = parsedDocuments.reduce<FixedDepositFormValues["documentsUploaded"]>((acc, item) => {
    acc[item.type] = {
      fileName: item.fileName,
      uploadDate: item.uploadDate ?? new Date().toISOString().slice(0, 10),
    };
    return acc;
  }, {});

  return {
    investment_name: initialData?.investment_name ?? "",
    owner: initialData?.owner ?? "Priyesh",
    institution: initialData?.institution ?? "",
    fd_number: initialData?.fd_number ?? "",
    principal: initialData?.cost_value ?? initialData?.cost_basis ?? "",
    interest_rate: initialData?.interest_rate ?? "",
    compounding_frequency: (initialData?.compounding_frequency as FdCompoundingFrequency | null) ?? "quarterly",
    payout_type: (initialData?.payout_type as FdPayoutType | null) ?? "cumulative",
    start_date: initialData?.acquisition_date ?? initialData?.purchase_date ?? "",
    maturity_date: initialData?.maturity_date ?? "",
    status: initialData?.status ?? "active",
    notes: initialData?.notes ?? "",
    documentsSelected,
    documentsUploaded,
  };
}

export function FixedDepositForm({ initialData, onSubmit, onCancel, submitting, submitLabel }: FixedDepositFormProps) {
  const [values, setValues] = useState<FixedDepositFormValues>(() => defaultValues(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const computed = useMemo(() => {
    if (!values.start_date || !values.maturity_date) {
      return null;
    }

    return computeFixedDepositValues({
      principal: toAmount(values.principal),
      annualInterestRatePercent: toAmount(values.interest_rate),
      compoundingFrequency: values.compounding_frequency,
      payoutType: values.payout_type,
      startDate: values.start_date,
      maturityDate: values.maturity_date,
    });
  }, [values.compounding_frequency, values.interest_rate, values.maturity_date, values.payout_type, values.principal, values.start_date]);

  function updateField<K extends keyof FixedDepositFormValues>(field: K, value: FixedDepositFormValues[K]) {
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

    if (!values.owner.trim()) {
      nextErrors.owner = "Owner is required.";
    }

    if (!values.institution.trim()) {
      nextErrors.institution = "Bank / institution is required.";
    }

    if (!values.fd_number.trim()) {
      nextErrors.fd_number = "FD number is required.";
    }

    if (!values.start_date) {
      nextErrors.start_date = "Start date is required.";
    }

    if (!values.maturity_date) {
      nextErrors.maturity_date = "Maturity date is required.";
    }

    if (toAmount(values.principal) <= 0) {
      nextErrors.principal = "Principal must be greater than zero.";
    }

    if (toAmount(values.interest_rate) < 0) {
      nextErrors.interest_rate = "Interest rate must be zero or greater.";
    }

    if (values.start_date && values.maturity_date && new Date(values.maturity_date).getTime() < new Date(values.start_date).getTime()) {
      nextErrors.maturity_date = "Maturity date must be on or after start date.";
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
          <Label htmlFor="fd_name">Holding Name</Label>
          <Input id="fd_name" value={values.investment_name} onChange={(event) => updateField("investment_name", event.target.value)} placeholder="Optional display name" />
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
          <Label htmlFor="institution">Bank / Institution</Label>
          <Input id="institution" value={values.institution} onChange={(event) => updateField("institution", event.target.value)} />
          {errors.institution ? <p className="text-sm text-rose-600">{errors.institution}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="fd_number">FD Number</Label>
          <Input id="fd_number" value={values.fd_number} onChange={(event) => updateField("fd_number", event.target.value)} />
          {errors.fd_number ? <p className="text-sm text-rose-600">{errors.fd_number}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="principal">Principal</Label>
          <Input id="principal" type="number" step="0.01" value={values.principal} onChange={(event) => updateField("principal", event.target.value)} />
          {errors.principal ? <p className="text-sm text-rose-600">{errors.principal}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="interest_rate">Interest Rate (%)</Label>
          <Input id="interest_rate" type="number" step="0.0001" value={values.interest_rate} onChange={(event) => updateField("interest_rate", event.target.value)} />
          {errors.interest_rate ? <p className="text-sm text-rose-600">{errors.interest_rate}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="compounding_frequency">Compounding Frequency</Label>
          <select
            id="compounding_frequency"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.compounding_frequency}
            onChange={(event) => updateField("compounding_frequency", event.target.value as FdCompoundingFrequency)}
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="half-yearly">Half-Yearly</option>
            <option value="yearly">Yearly</option>
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="payout_type">Payout Type</Label>
          <select
            id="payout_type"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.payout_type}
            onChange={(event) => updateField("payout_type", event.target.value as FdPayoutType)}
          >
            <option value="cumulative">Cumulative</option>
            <option value="monthly-payout">Monthly Payout</option>
            <option value="quarterly-payout">Quarterly Payout</option>
            <option value="annual-payout">Annual Payout</option>
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="start_date">Start Date</Label>
          <Input id="start_date" type="date" value={values.start_date} onChange={(event) => updateField("start_date", event.target.value)} />
          {errors.start_date ? <p className="text-sm text-rose-600">{errors.start_date}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="maturity_date">Maturity Date</Label>
          <Input id="maturity_date" type="date" value={values.maturity_date} onChange={(event) => updateField("maturity_date", event.target.value)} />
          {errors.maturity_date ? <p className="text-sm text-rose-600">{errors.maturity_date}</p> : null}
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
        <p className="text-sm font-medium text-slate-700">Computed Values</p>
        {computed ? (
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
            <div>Current Value: <span className="font-semibold text-slate-900">{formatCurrency(computed.currentValue, { maximumFractionDigits: 0 })}</span></div>
            <div>Accrued Interest: <span className="font-semibold text-slate-900">{formatCurrency(computed.accruedInterest, { maximumFractionDigits: 0 })}</span></div>
            <div>Maturity Value: <span className="font-semibold text-slate-900">{formatCurrency(computed.maturityValue, { maximumFractionDigits: 0 })}</span></div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Enter principal, rate, start date, and maturity date to preview values.</p>
        )}
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
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : submitLabel ?? "Save Fixed Deposit"}</Button>
      </FormActions>
    </form>
  );
}
