"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Investment, InvestmentInsert, InvestmentMode, InvestmentOptionType, InvestmentStatus } from "@/types/investment";

const DOCUMENT_OPTIONS = ["CAS", "Statement", "Nomination", "Other"] as const;
const PLATFORM_OPTIONS = ["INDmoney", "MF Central", "Groww", "Kuvera", "Coin", "Manual", "Other"] as const;

type DocumentMetadata = {
  type: (typeof DOCUMENT_OPTIONS)[number];
  fileName: string | null;
  uploadDate: string;
};

type SchemeCatalogItem = {
  schemeName: string;
  amc: string | null;
  amfiSchemeCode: string | null;
  investmentMode: InvestmentMode | null;
  optionType: InvestmentOptionType | null;
};

type MutualFundFormValues = {
  schemeName: string;
  amc: string;
  amfiSchemeCode: string;
  folioNumber: string;
  owner: string;
  nominee: string;
  investmentMode: InvestmentMode;
  optionType: InvestmentOptionType;
  platform: string;
  purchaseValue: number | string;
  units: number | string;
  currentNav: number | string;
  sipEnabled: "yes" | "no";
  monthlySip: number | string;
  sipDate: number | string;
  purchaseDate: string;
  region: "Domestic" | "International";
  sectorTheme: string;
  status: InvestmentStatus;
  notes: string;
  documentsSelected: string[];
  documentsUploaded: Partial<Record<(typeof DOCUMENT_OPTIONS)[number], { fileName: string | null; uploadDate: string }>>;
};

interface MutualFundFormProps {
  initialData?: Investment | null;
  schemeCatalog?: SchemeCatalogItem[];
  onSubmit: (values: InvestmentInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
  submitLabel: string;
}

function defaultValues(initialData?: Investment | null): MutualFundFormValues {
  const rawDocumentsText = initialData?.documents_placeholder ?? "";
  let parsedDocuments: DocumentMetadata[] = [];
  try {
    const decoded = JSON.parse(rawDocumentsText) as unknown;
    if (Array.isArray(decoded)) {
      parsedDocuments = decoded
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const entry = item as Record<string, unknown>;
          const typeValue = String(entry.type ?? "").trim() as (typeof DOCUMENT_OPTIONS)[number];
          if (!DOCUMENT_OPTIONS.includes(typeValue)) {
            return null;
          }

          return {
            type: typeValue,
            fileName: entry.fileName ? String(entry.fileName) : null,
            uploadDate: entry.uploadDate ? String(entry.uploadDate) : new Date().toISOString().slice(0, 10),
          };
        })
        .filter((item): item is DocumentMetadata => Boolean(item));
    }
  } catch {
    const fallback = rawDocumentsText.split(",").map((item) => item.trim()).filter(Boolean);
    parsedDocuments = fallback.map((item) => ({
      type: DOCUMENT_OPTIONS.find((option) => item.toLowerCase().includes(option.toLowerCase())) ?? "Other",
      fileName: item,
      uploadDate: new Date().toISOString().slice(0, 10),
    }));
  }

  const documentsSelected = Array.from(new Set(parsedDocuments.map((item) => item.type)));
  const documentsUploaded = parsedDocuments.reduce<MutualFundFormValues["documentsUploaded"]>((acc, item) => {
    acc[item.type] = {
      fileName: item.fileName,
      uploadDate: item.uploadDate,
    };
    return acc;
  }, {});

  const inferredUnits = initialData?.units ?? 0;
  const inferredCurrentNav =
    initialData?.nav_price ??
    (initialData?.units && initialData.units > 0
      ? Number((Number(initialData.current_value ?? 0) / Number(initialData.units)).toFixed(4))
      : 0);

  const inferredMode: InvestmentMode = initialData?.investment_mode === "Regular" ? "Regular" : "Direct";
  const inferredOption: InvestmentOptionType = initialData?.option_type === "IDCW" ? "IDCW" : "Growth";

  return {
    schemeName: initialData?.investment_name ?? "",
    amc: initialData?.amc ?? initialData?.institution ?? "",
    amfiSchemeCode: initialData?.amfi_scheme_code ?? "",
    folioNumber: initialData?.folio_number ?? "",
    owner: initialData?.owner ?? "",
    nominee: initialData?.nominee ?? "",
    investmentMode: inferredMode,
    optionType: inferredOption,
    platform: initialData?.broker_platform ?? "Manual",
    purchaseValue: initialData?.cost_value ?? initialData?.cost_basis ?? 0,
    units: inferredUnits,
    currentNav: inferredCurrentNav,
    sipEnabled: (initialData?.sip_amount ?? 0) > 0 ? "yes" : "no",
    monthlySip: initialData?.sip_amount ?? "",
    sipDate: initialData?.sip_date ?? "",
    purchaseDate: initialData?.acquisition_date ?? initialData?.purchase_date ?? "",
    region: initialData?.region ?? "Domestic",
    sectorTheme: initialData?.sector ?? "",
    status: initialData?.status ?? "active",
    notes: initialData?.notes ?? "",
    documentsSelected,
    documentsUploaded,
  };
}

function toAmount(value: number | string) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function MutualFundForm({ initialData, schemeCatalog = [], onSubmit, onCancel, submitting, submitLabel }: MutualFundFormProps) {
  const [values, setValues] = useState<MutualFundFormValues>(() => defaultValues(initialData));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Partial<Record<(typeof DOCUMENT_OPTIONS)[number], HTMLInputElement | null>>>({});

  const availableDocumentOptions = useMemo(() => DOCUMENT_OPTIONS.map((item) => item), []);
  const currentValue = useMemo(
    () => Number((toAmount(values.units) * toAmount(values.currentNav)).toFixed(2)),
    [values.currentNav, values.units],
  );
  const normalizedSchemeCatalog = useMemo(
    () =>
      Array.from(new Map(
        schemeCatalog.map((item) => [
          `${item.schemeName.trim().toLowerCase()}::${(item.amfiSchemeCode ?? "").trim().toLowerCase()}`,
          item,
        ]),
      ).values()),
    [schemeCatalog],
  );

  function updateField<K extends keyof MutualFundFormValues>(field: K, value: MutualFundFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleDocument(value: string) {
    setValues((current) => {
      if (current.documentsSelected.includes(value)) {
        return { ...current, documentsSelected: current.documentsSelected.filter((item) => item !== value) };
      }
      return { ...current, documentsSelected: [...current.documentsSelected, value] };
    });
  }

  function autofillFromSchemeName(inputName: string) {
    const matched = normalizedSchemeCatalog.find((item) => item.schemeName.toLowerCase() === inputName.trim().toLowerCase());
    if (!matched) {
      return;
    }

    setValues((current) => ({
      ...current,
      schemeName: matched.schemeName,
      amc: matched.amc ?? current.amc,
      amfiSchemeCode: matched.amfiSchemeCode ?? current.amfiSchemeCode,
      investmentMode: matched.investmentMode ?? current.investmentMode,
      optionType: matched.optionType ?? current.optionType,
    }));
  }

  function handleDocumentUpload(documentType: (typeof DOCUMENT_OPTIONS)[number], file: File | null) {
    if (!file) {
      return;
    }

    setValues((current) => ({
      ...current,
      documentsSelected: current.documentsSelected.includes(documentType)
        ? current.documentsSelected
        : [...current.documentsSelected, documentType],
      documentsUploaded: {
        ...current.documentsUploaded,
        [documentType]: {
          fileName: file.name,
          uploadDate: new Date().toISOString().slice(0, 10),
        },
      },
    }));
  }

  function validate() {
    const nextErrors: Record<string, string> = {};

    if (!values.schemeName.trim()) {
      nextErrors.schemeName = "Scheme name is required.";
    }

    if (!values.amc.trim()) {
      nextErrors.amc = "AMC is required.";
    }

    if (!values.amfiSchemeCode.trim()) {
      nextErrors.amfiSchemeCode = "AMFI Scheme Code is required.";
    }

    if (!values.folioNumber.trim()) {
      nextErrors.folioNumber = "Folio number is required.";
    }

    if (!values.owner.trim()) {
      nextErrors.owner = "Owner is required.";
    }

    if (toAmount(values.purchaseValue) < 0) {
      nextErrors.purchaseValue = "Purchase value must be zero or higher.";
    }

    if (toAmount(values.units) < 0) {
      nextErrors.units = "Units must be zero or higher.";
    }

    if (toAmount(values.currentNav) < 0) {
      nextErrors.currentNav = "Current NAV must be zero or higher.";
    }

    if (values.sipEnabled === "yes" && toAmount(values.monthlySip) <= 0) {
      nextErrors.monthlySip = "Monthly SIP must be greater than zero.";
    }

    if (values.sipEnabled === "yes") {
      const sipDate = Number(values.sipDate);
      if (!Number.isInteger(sipDate) || sipDate < 1 || sipDate > 31) {
        nextErrors.sipDate = "SIP Date must be between 1 and 31.";
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

    const documents: DocumentMetadata[] = values.documentsSelected.map((entry) => {
      const metadata = values.documentsUploaded[entry as (typeof DOCUMENT_OPTIONS)[number]];
      return {
        type: entry as (typeof DOCUMENT_OPTIONS)[number],
        fileName: metadata?.fileName ?? null,
        uploadDate: metadata?.uploadDate ?? new Date().toISOString().slice(0, 10),
      };
    });

    const purchaseValue = toAmount(values.purchaseValue);
    const units = toAmount(values.units);
    const currentNav = toAmount(values.currentNav);

    await onSubmit({
      investment_name: values.schemeName.trim(),
      category: "Mutual Funds",
      investment_type: "Mutual Funds",
      owner: values.owner.trim(),
      nominee: values.nominee.trim() || null,
      institution: values.amc.trim(),
      amc: values.amc.trim(),
      amfi_scheme_code: values.amfiSchemeCode.trim(),
      folio_number: values.folioNumber.trim(),
      investment_mode: values.investmentMode,
      option_type: values.optionType,
      broker_platform: values.platform,
      cost_value: purchaseValue,
      current_value: currentValue,
      cost_basis: purchaseValue,
      status: values.status,
      purchase_date: values.purchaseDate || null,
      acquisition_date: values.purchaseDate || null,
      region: values.region,
      sector: values.sectorTheme.trim() || null,
      sip_amount: values.sipEnabled === "yes" ? toAmount(values.monthlySip) : null,
      sip_date: values.sipEnabled === "yes" ? Number(values.sipDate) : null,
      notes: values.notes.trim() || null,
      documents_placeholder:
        documents.length > 0
          ? JSON.stringify(documents)
          : null,
      units,
      nav_price: currentNav,
      today_gain_loss: currentValue - purchaseValue,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Investment Details</h4>
      </div>
      <FormGrid>
        <FormField>
          <Label htmlFor="scheme_name">Scheme Name</Label>
          <Input
            id="scheme_name"
            list="mutual-fund-scheme-catalog"
            value={values.schemeName}
            onChange={(event) => updateField("schemeName", event.target.value)}
            onBlur={(event) => autofillFromSchemeName(event.target.value)}
            placeholder="Type and pick scheme"
          />
          <datalist id="mutual-fund-scheme-catalog">
            {normalizedSchemeCatalog.map((item) => (
              <option key={`${item.schemeName}-${item.amfiSchemeCode ?? "na"}`} value={item.schemeName} />
            ))}
          </datalist>
          {errors.schemeName ? <p className="text-sm text-rose-600">{errors.schemeName}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="amc">AMC</Label>
          <Input id="amc" value={values.amc} onChange={(event) => updateField("amc", event.target.value)} />
          {errors.amc ? <p className="text-sm text-rose-600">{errors.amc}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="amfi_scheme_code">AMFI Scheme Code</Label>
          <Input id="amfi_scheme_code" value={values.amfiSchemeCode} onChange={(event) => updateField("amfiSchemeCode", event.target.value)} />
          {errors.amfiSchemeCode ? <p className="text-sm text-rose-600">{errors.amfiSchemeCode}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="folio_number">Folio Number</Label>
          <Input id="folio_number" value={values.folioNumber} onChange={(event) => updateField("folioNumber", event.target.value)} />
          {errors.folioNumber ? <p className="text-sm text-rose-600">{errors.folioNumber}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="owner">Owner</Label>
          <Input id="owner" value={values.owner} onChange={(event) => updateField("owner", event.target.value)} />
          {errors.owner ? <p className="text-sm text-rose-600">{errors.owner}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="nominee">Nominee</Label>
          <Input id="nominee" value={values.nominee} onChange={(event) => updateField("nominee", event.target.value)} />
        </FormField>

        <FormField>
          <Label htmlFor="investment_mode">Investment Mode</Label>
          <select
            id="investment_mode"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.investmentMode}
            onChange={(event) => updateField("investmentMode", event.target.value as InvestmentMode)}
          >
            <option value="Direct">Direct</option>
            <option value="Regular">Regular</option>
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="option_type">Growth / IDCW</Label>
          <select
            id="option_type"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.optionType}
            onChange={(event) => updateField("optionType", event.target.value as InvestmentOptionType)}
          >
            <option value="Growth">Growth</option>
            <option value="IDCW">IDCW</option>
          </select>
        </FormField>

        <FormField>
          <Label htmlFor="platform">Platform</Label>
          <select
            id="platform"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.platform}
            onChange={(event) => updateField("platform", event.target.value)}
          >
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FormField>
      </FormGrid>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Financial Details</h4>
      </div>
      <FormGrid>
        <FormField>
          <Label htmlFor="purchase_value">Purchase Value</Label>
          <Input id="purchase_value" type="number" step="0.01" value={values.purchaseValue} onChange={(event) => updateField("purchaseValue", event.target.value)} />
          {errors.purchaseValue ? <p className="text-sm text-rose-600">{errors.purchaseValue}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="units">Units</Label>
          <Input id="units" type="number" step="0.0001" value={values.units} onChange={(event) => updateField("units", event.target.value)} />
          {errors.units ? <p className="text-sm text-rose-600">{errors.units}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="current_nav">Current NAV</Label>
          <Input id="current_nav" type="number" step="0.0001" value={values.currentNav} onChange={(event) => updateField("currentNav", event.target.value)} />
          {errors.currentNav ? <p className="text-sm text-rose-600">{errors.currentNav}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="current_value">Current Value (Auto Calculated)</Label>
          <Input id="current_value" value={currentValue.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} readOnly />
        </FormField>
      </FormGrid>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">SIP Details</h4>
      </div>
      <FormGrid>
        <FormField>
          <Label htmlFor="sip_enabled">SIP</Label>
          <select
            id="sip_enabled"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.sipEnabled}
            onChange={(event) => updateField("sipEnabled", event.target.value as "yes" | "no")}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </FormField>
        {values.sipEnabled === "yes" ? (
          <>
            <FormField>
              <Label htmlFor="monthly_sip">Monthly SIP</Label>
              <Input id="monthly_sip" type="number" step="0.01" value={values.monthlySip} onChange={(event) => updateField("monthlySip", event.target.value)} />
              {errors.monthlySip ? <p className="text-sm text-rose-600">{errors.monthlySip}</p> : null}
            </FormField>

            <FormField>
              <Label htmlFor="sip_date">SIP Date</Label>
              <Input id="sip_date" type="number" min={1} max={31} value={values.sipDate} onChange={(event) => updateField("sipDate", event.target.value)} />
              {errors.sipDate ? <p className="text-sm text-rose-600">{errors.sipDate}</p> : null}
            </FormField>
          </>
        ) : null}
      </FormGrid>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Additional Information</h4>
      </div>
      <FormGrid>
        <FormField>
          <Label htmlFor="purchase_date">Purchase Date</Label>
          <Input id="purchase_date" type="date" value={values.purchaseDate} onChange={(event) => updateField("purchaseDate", event.target.value)} />
        </FormField>

        <FormField>
          <Label htmlFor="region">Region</Label>
          <select
            id="region"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={values.region}
            onChange={(event) => updateField("region", event.target.value as "Domestic" | "International")}
          >
            <option value="Domestic">Domestic</option>
            <option value="International">International</option>
          </select>
        </FormField>

        <FormField className="md:col-span-2">
          <Label htmlFor="sector_theme">Sector / Theme</Label>
          <Input id="sector_theme" value={values.sectorTheme} onChange={(event) => updateField("sectorTheme", event.target.value)} />
        </FormField>
      </FormGrid>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Documents</h4>
      </div>
      <FormField>
        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
          {availableDocumentOptions.map((documentOption) => (
            <div key={documentOption} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={values.documentsSelected.includes(documentOption)} onChange={() => toggleDocument(documentOption)} />
                <span>{documentOption}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={(element) => {
                    fileInputRefs.current[documentOption] = element;
                  }}
                  type="file"
                  className="hidden"
                  onChange={(event) => handleDocumentUpload(documentOption, event.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRefs.current[documentOption]?.click()}
                >
                  Upload
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1 text-xs text-slate-600">
          {Object.entries(values.documentsUploaded).map(([key, metadata]) => (
            <p key={key}>{key}: {metadata?.fileName ?? "Not uploaded"} ({metadata?.uploadDate ?? "NA"})</p>
          ))}
        </div>
      </FormField>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Notes</h4>
      </div>
      <FormField>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={values.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </FormField>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-slate-900">Administration</h4>
      </div>
      <FormGrid>
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

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : submitLabel}</Button>
      </FormActions>
    </form>
  );
}
