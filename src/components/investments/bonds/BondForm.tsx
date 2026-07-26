"use client";

import { useMemo, useState, type FormEvent } from "react";

import { defaultInvestmentDocumentOptions, parseInvestmentDocuments } from "@/components/investments/documents";
import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { computeBondDerivedValues, type BondCouponFrequency, type BondType } from "@/services/investments/bonds";
import type { Investment, InvestmentStatus } from "@/types/investment";

const bondTypes: BondType[] = [
  "Government Security (G-Sec)",
  "Treasury Bill",
  "State Development Loan (SDL)",
  "PSU Bond",
  "Corporate Bond",
  "Tax Free Bond",
  "RBI Floating Rate Bond",
  "Sovereign Gold Bond",
  "Municipal Bond",
  "Other",
];

const couponFrequencies: BondCouponFrequency[] = ["Annual", "Half-Yearly", "Quarterly", "Monthly"];

export type BondFormValues = {
  issuer: string;
  bond_name: string;
  bond_type: BondType;
  isin: string;
  face_value: number | string;
  quantity: number | string;
  purchase_price: number | string;
  current_market_price: number | string;
  coupon_rate: number | string;
  coupon_frequency: BondCouponFrequency;
  purchase_date: string;
  maturity_date: string;
  owner: string;
  broker: string;
  status: InvestmentStatus;
  notes: string;
  documentsSelected: string[];
  documentsUploaded: Partial<Record<string, { fileName: string | null; uploadDate: string }>>;
};

interface BondFormProps {
  initialData?: Investment | null;
  onSubmit: (values: BondFormValues) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  submitLabel?: string;
}

function toAmount(value: string | number) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function defaultValues(initialData?: Investment | null): BondFormValues {
  const parsedDocuments = parseInvestmentDocuments(initialData?.documents_placeholder);
  const documentsSelected = Array.from(new Set(parsedDocuments.map((item) => item.type)));
  const documentsUploaded = parsedDocuments.reduce<BondFormValues["documentsUploaded"]>((acc, item) => {
    acc[item.type] = {
      fileName: item.fileName,
      uploadDate: item.uploadDate ?? new Date().toISOString().slice(0, 10),
    };
    return acc;
  }, {});

  return {
    issuer: initialData?.issuer ?? initialData?.institution ?? "",
    bond_name: initialData?.bond_name ?? initialData?.investment_name ?? "",
    bond_type: (initialData?.bond_type as BondType | undefined) ?? "Corporate Bond",
    isin: initialData?.isin ?? "",
    face_value: initialData?.face_value ?? "",
    quantity: initialData?.units ?? "",
    purchase_price: initialData?.purchase_price ?? initialData?.average_purchase_price ?? "",
    current_market_price: initialData?.current_market_price ?? initialData?.nav_price ?? "",
    coupon_rate: initialData?.coupon_rate ?? "",
    coupon_frequency: (initialData?.coupon_frequency as BondCouponFrequency | undefined) ?? "Half-Yearly",
    purchase_date: initialData?.acquisition_date ?? initialData?.purchase_date ?? "",
    maturity_date: initialData?.maturity_date ?? "",
    owner: initialData?.owner ?? "",
    broker: initialData?.broker ?? "",
    status: initialData?.status ?? "active",
    notes: initialData?.notes ?? "",
    documentsSelected,
    documentsUploaded,
  };
}

export function BondForm({ initialData, onSubmit, onCancel, submitting, submitLabel }: BondFormProps) {
  const [values, setValues] = useState<BondFormValues>(() => defaultValues(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const computed = useMemo(() => {
    if (!values.purchase_date || !values.maturity_date) {
      return null;
    }

    return computeBondDerivedValues({
      faceValue: toAmount(values.face_value),
      quantity: toAmount(values.quantity),
      purchasePrice: toAmount(values.purchase_price),
      currentMarketPrice: values.current_market_price === "" ? null : toAmount(values.current_market_price),
      couponRate: toAmount(values.coupon_rate),
      couponFrequency: values.coupon_frequency,
      purchaseDate: values.purchase_date,
      maturityDate: values.maturity_date,
    });
  }, [values.coupon_frequency, values.coupon_rate, values.current_market_price, values.face_value, values.maturity_date, values.purchase_date, values.purchase_price, values.quantity]);

  function updateField<K extends keyof BondFormValues>(field: K, value: BondFormValues[K]) {
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

    if (!values.issuer.trim()) {
      nextErrors.issuer = "Issuer is required.";
    }
    if (!values.bond_name.trim()) {
      nextErrors.bond_name = "Bond name is required.";
    }
    if (!values.owner.trim()) {
      nextErrors.owner = "Owner is required.";
    }
    if (toAmount(values.quantity) <= 0) {
      nextErrors.quantity = "Quantity must be greater than zero.";
    }
    if (toAmount(values.purchase_price) <= 0) {
      nextErrors.purchase_price = "Purchase price must be greater than zero.";
    }
    if (toAmount(values.face_value) <= 0) {
      nextErrors.face_value = "Face value must be greater than zero.";
    }
    if (toAmount(values.coupon_rate) < 0) {
      nextErrors.coupon_rate = "Coupon rate must be zero or greater.";
    }
    if (!values.purchase_date) {
      nextErrors.purchase_date = "Purchase date is required.";
    }
    if (!values.maturity_date) {
      nextErrors.maturity_date = "Maturity date is required.";
    }
    if (values.purchase_date && values.maturity_date && new Date(values.maturity_date).getTime() < new Date(values.purchase_date).getTime()) {
      nextErrors.maturity_date = "Maturity date must be on or after purchase date.";
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
          <Label htmlFor="bond_issuer">Issuer</Label>
          <Input id="bond_issuer" value={values.issuer} onChange={(event) => updateField("issuer", event.target.value)} />
          {errors.issuer ? <p className="text-sm text-rose-600">{errors.issuer}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="bond_name">Bond Name</Label>
          <Input id="bond_name" value={values.bond_name} onChange={(event) => updateField("bond_name", event.target.value)} />
          {errors.bond_name ? <p className="text-sm text-rose-600">{errors.bond_name}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="bond_type">Bond Type</Label>
          <select id="bond_type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={values.bond_type} onChange={(event) => updateField("bond_type", event.target.value as BondType)}>
            {bondTypes.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="isin">ISIN (Optional)</Label>
          <Input id="isin" value={values.isin} onChange={(event) => updateField("isin", event.target.value.toUpperCase())} placeholder="INE..." />
        </FormField>

        <FormField>
          <Label htmlFor="face_value">Face Value</Label>
          <Input id="face_value" type="number" step="0.01" value={values.face_value} onChange={(event) => updateField("face_value", event.target.value)} />
          {errors.face_value ? <p className="text-sm text-rose-600">{errors.face_value}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" type="number" step="0.0001" value={values.quantity} onChange={(event) => updateField("quantity", event.target.value)} />
          {errors.quantity ? <p className="text-sm text-rose-600">{errors.quantity}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="purchase_price">Purchase Price</Label>
          <Input id="purchase_price" type="number" step="0.01" value={values.purchase_price} onChange={(event) => updateField("purchase_price", event.target.value)} />
          {errors.purchase_price ? <p className="text-sm text-rose-600">{errors.purchase_price}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="current_market_price">Current Market Price</Label>
          <Input id="current_market_price" type="number" step="0.01" value={values.current_market_price} onChange={(event) => updateField("current_market_price", event.target.value)} />
        </FormField>

        <FormField>
          <Label htmlFor="coupon_rate">Coupon Rate (%)</Label>
          <Input id="coupon_rate" type="number" step="0.0001" value={values.coupon_rate} onChange={(event) => updateField("coupon_rate", event.target.value)} />
          {errors.coupon_rate ? <p className="text-sm text-rose-600">{errors.coupon_rate}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="coupon_frequency">Coupon Frequency</Label>
          <select id="coupon_frequency" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={values.coupon_frequency} onChange={(event) => updateField("coupon_frequency", event.target.value as BondCouponFrequency)}>
            {couponFrequencies.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="purchase_date">Purchase Date</Label>
          <Input id="purchase_date" type="date" value={values.purchase_date} onChange={(event) => updateField("purchase_date", event.target.value)} />
          {errors.purchase_date ? <p className="text-sm text-rose-600">{errors.purchase_date}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="maturity_date">Maturity Date</Label>
          <Input id="maturity_date" type="date" value={values.maturity_date} onChange={(event) => updateField("maturity_date", event.target.value)} />
          {errors.maturity_date ? <p className="text-sm text-rose-600">{errors.maturity_date}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="owner">Owner</Label>
          <Input id="owner" value={values.owner} onChange={(event) => updateField("owner", event.target.value)} />
          {errors.owner ? <p className="text-sm text-rose-600">{errors.owner}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="broker">Broker</Label>
          <Input id="broker" value={values.broker} onChange={(event) => updateField("broker", event.target.value)} placeholder="Optional" />
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
        {computed ? (
          <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
            <div>Current Value: <span className="font-semibold text-slate-900">{formatCurrency(computed.currentValue, { maximumFractionDigits: 0 })}</span></div>
            <div>Total Invested: <span className="font-semibold text-slate-900">{formatCurrency(computed.totalInvested, { maximumFractionDigits: 0 })}</span></div>
            <div>Unrealized P/L: <span className="font-semibold text-slate-900">{formatCurrency(computed.unrealizedGainLoss, { maximumFractionDigits: 0 })}</span></div>
            <div>Gain %: <span className="font-semibold text-slate-900">{computed.gainPercent.toFixed(2)}%</span></div>
            <div>Accrued Interest: <span className="font-semibold text-slate-900">{formatCurrency(computed.accruedInterest, { maximumFractionDigits: 0 })}</span></div>
            <div>Annual Coupon Income: <span className="font-semibold text-slate-900">{formatCurrency(computed.annualCouponIncome, { maximumFractionDigits: 0 })}</span></div>
            <div>Days to Maturity: <span className="font-semibold text-slate-900">{computed.daysToMaturity}</span></div>
            <div>Remaining Tenure: <span className="font-semibold text-slate-900">{computed.remainingTenure}</span></div>
          </div>
        ) : (
          <p className="mt-1 text-sm text-slate-500">Enter core bond details to preview calculated values.</p>
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
      </FormField>

      <FormField>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </FormField>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : submitLabel ?? "Save Bond"}</Button>
      </FormActions>
    </form>
  );
}
