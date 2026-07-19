"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Investment, InvestmentCategory, InvestmentInsert, InvestmentMode, InvestmentOptionType, InvestmentRegion } from "@/types/investment";

interface InvestmentFormProps {
  initialData?: Investment | null;
  onSubmit: (values: InvestmentInsert) => Promise<void> | void;
  onCancel: () => void;
  submitting?: boolean;
}

type InvestmentFormState = {
  investment_name: string;
  category: InvestmentCategory;
  owner: string;
  broker: string;
  exchange: string;
  isin: string;
  nominee: string;
  folio_number: string;
  amfi_scheme_code: string;
  sip_amount: number | string;
  sip_date: number | string;
  investment_mode: InvestmentMode | "";
  option_type: InvestmentOptionType | "";
  broker_platform: string;
  units: number | string;
  average_purchase_price: number | string;
  nav_price: number | string;
  cost_basis: number | string;
  today_gain_loss: number | string;
  sector: string;
  amc: string;
  region: InvestmentRegion;
  purchase_date: string;
  notes: string;
};

function getAveragePurchasePrice(initialData?: Investment | null) {
  if (!initialData || initialData.category !== "Stocks") {
    return "";
  }

  if (!Number.isFinite(initialData.units) || initialData.units <= 0) {
    return "";
  }

  return Number((initialData.cost_basis / initialData.units).toFixed(4));
}

const categories: InvestmentCategory[] = [
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
  owner: initialData?.owner ?? "",
  broker: initialData?.broker ?? "",
  exchange: initialData?.exchange ?? "",
  isin: initialData?.isin ?? "",
  nominee: initialData?.nominee ?? "",
  folio_number: initialData?.folio_number ?? "",
  amfi_scheme_code: initialData?.amfi_scheme_code ?? "",
  sip_amount: initialData?.sip_amount ?? "",
  sip_date: initialData?.sip_date ?? "",
  investment_mode: initialData?.investment_mode ?? "",
  option_type: initialData?.option_type ?? "",
  broker_platform: initialData?.broker_platform ?? "",
  units: initialData?.units ?? 0,
  average_purchase_price: getAveragePurchasePrice(initialData),
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

  function updateField(field: keyof InvestmentFormState, value: InvestmentFormState[keyof InvestmentFormState]) {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    } as InvestmentFormState));
  }

  function validate(values: InvestmentFormState) {
    const nextErrors: Record<string, string> = {};
    const isStockCategory = values.category === "Stocks";

    if (!values.investment_name.trim()) {
      nextErrors.investment_name = "Investment name is required";
    }
    if (!values.category) {
      nextErrors.category = "Category is required";
    }
    if (Number(values.units) <= 0) {
      nextErrors.units = "Units must be greater than zero";
    }
    if (isStockCategory && !values.owner.trim()) {
      nextErrors.owner = "Owner is required for stocks";
    }
    if (Number(values.nav_price) < 0) {
      nextErrors.nav_price = isStockCategory ? "Current price must be positive" : "NAV / price must be positive";
    }
    if (isStockCategory && Number(values.average_purchase_price) <= 0) {
      nextErrors.average_purchase_price = "Average purchase price must be greater than zero";
    }
    if (!isStockCategory && Number(values.cost_basis) < 0) {
      nextErrors.cost_basis = "Cost basis must be positive";
    }
    if (!isStockCategory && values.sip_amount !== "" && Number(values.sip_amount) < 0) {
      nextErrors.sip_amount = "SIP amount must be zero or higher";
    }
    if (!isStockCategory && values.sip_date !== "") {
      const sipDate = Number(values.sip_date);
      if (!Number.isInteger(sipDate) || sipDate < 1 || sipDate > 31) {
        nextErrors.sip_date = "SIP date must be between 1 and 31";
      }
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

    const isStockCategory = formValues.category === "Stocks";
    const units = Number(formValues.units);
    const averagePurchasePrice = Number(formValues.average_purchase_price);
    const computedCostBasis = Number((units * averagePurchasePrice).toFixed(2));

    await onSubmit({
      investment_name: formValues.investment_name,
      category: formValues.category,
      owner: formValues.owner || null,
      nominee: isStockCategory ? null : formValues.nominee || null,
      folio_number: isStockCategory ? null : formValues.folio_number || null,
      amfi_scheme_code: isStockCategory ? null : formValues.amfi_scheme_code || null,
      sip_amount: isStockCategory ? null : formValues.sip_amount === "" ? null : Number(formValues.sip_amount),
      sip_date: isStockCategory ? null : formValues.sip_date === "" ? null : Number(formValues.sip_date),
      investment_mode: isStockCategory ? null : formValues.investment_mode || null,
      option_type: isStockCategory ? null : formValues.option_type || null,
      broker_platform: isStockCategory ? null : formValues.broker_platform || null,
      units,
      nav_price: Number(formValues.nav_price),
      cost_basis: isStockCategory ? computedCostBasis : Number(formValues.cost_basis),
      today_gain_loss: isStockCategory ? 0 : Number(formValues.today_gain_loss),
      sector: formValues.sector || null,
      amc: formValues.amc || null,
      region: isStockCategory ? "Domestic" : formValues.region,
      purchase_date: formValues.purchase_date || null,
      notes: formValues.notes || null,
      broker: isStockCategory ? formValues.broker || null : null,
      exchange: isStockCategory ? formValues.exchange || null : null,
      isin: isStockCategory ? formValues.isin || null : null,
      average_purchase_price: isStockCategory ? averagePurchasePrice : null,
    });
  }

  const isStockCategory = formValues.category === "Stocks";
  const computedInvestedValue = Number(formValues.units) > 0 && Number(formValues.average_purchase_price) > 0
    ? Number(formValues.units) * Number(formValues.average_purchase_price)
    : 0;

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormGrid>
        <FormField className="md:col-span-2">
          <Label htmlFor="investment_name">Name</Label>
          <Input id="investment_name" value={formValues.investment_name} onChange={(event) => updateField("investment_name", event.target.value)} />
          {errors.investment_name ? <p className="text-sm text-rose-600">{errors.investment_name}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={formValues.category}
            onChange={(event) => updateField("category", event.target.value as InvestmentCategory)}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          {errors.category ? <p className="text-sm text-rose-600">{errors.category}</p> : null}
        </FormField>

        {!isStockCategory ? (
          <FormField>
            <Label htmlFor="region">Region</Label>
            <select id="region" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.region} onChange={(event) => updateField("region", event.target.value as InvestmentRegion)}>
              <option value="Domestic">Domestic</option>
              <option value="International">International</option>
            </select>
          </FormField>
        ) : null}

        <FormField>
          <Label htmlFor="owner">Owner</Label>
          <Input id="owner" value={formValues.owner} onChange={(event) => updateField("owner", event.target.value)} />
          {errors.owner ? <p className="text-sm text-rose-600">{errors.owner}</p> : null}
        </FormField>

        {!isStockCategory ? (
          <FormField>
            <Label htmlFor="nominee">Nominee</Label>
            <Input id="nominee" value={formValues.nominee} onChange={(event) => updateField("nominee", event.target.value)} />
          </FormField>
        ) : null}

        {isStockCategory ? (
          <FormField>
            <Label htmlFor="isin">ISIN</Label>
            <Input id="isin" value={formValues.isin} onChange={(event) => updateField("isin", event.target.value)} />
          </FormField>
        ) : (
          <FormField>
            <Label htmlFor="amfi_scheme_code">AMFI scheme code</Label>
            <Input id="amfi_scheme_code" value={formValues.amfi_scheme_code} onChange={(event) => updateField("amfi_scheme_code", event.target.value)} />
          </FormField>
        )}

        {!isStockCategory ? (
          <>
            <FormField>
              <Label htmlFor="folio_number">Folio number</Label>
              <Input id="folio_number" value={formValues.folio_number} onChange={(event) => updateField("folio_number", event.target.value)} />
            </FormField>

            <FormField>
              <Label htmlFor="investment_mode">Investment mode</Label>
              <select id="investment_mode" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.investment_mode} onChange={(event) => updateField("investment_mode", event.target.value as InvestmentFormState["investment_mode"])}>
                <option value="">Select mode</option>
                <option value="Direct">Direct</option>
                <option value="Regular">Regular</option>
              </select>
            </FormField>

            <FormField>
              <Label htmlFor="option_type">Option type</Label>
              <select id="option_type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.option_type} onChange={(event) => updateField("option_type", event.target.value as InvestmentFormState["option_type"])}>
                <option value="">Select option</option>
                <option value="Growth">Growth</option>
                <option value="IDCW">IDCW</option>
              </select>
            </FormField>
          </>
        ) : null}

        {isStockCategory ? (
          <FormField>
            <Label htmlFor="broker">Broker</Label>
            <Input id="broker" value={formValues.broker} onChange={(event) => updateField("broker", event.target.value)} />
          </FormField>
        ) : (
          <FormField>
            <Label htmlFor="broker_platform">Broker platform</Label>
            <Input id="broker_platform" value={formValues.broker_platform} onChange={(event) => updateField("broker_platform", event.target.value)} />
          </FormField>
        )}

        <FormField>
          <Label htmlFor="units">Units</Label>
          <Input id="units" type="number" step="0.0001" value={formValues.units} onChange={(event) => updateField("units", event.target.value)} />
          {errors.units ? <p className="text-sm text-rose-600">{errors.units}</p> : null}
        </FormField>

        <FormField>
          <Label htmlFor="nav_price">{isStockCategory ? "Current Price" : "NAV / Price"}</Label>
          <Input id="nav_price" type="number" step="0.0001" value={formValues.nav_price} onChange={(event) => updateField("nav_price", event.target.value)} />
          {errors.nav_price ? <p className="text-sm text-rose-600">{errors.nav_price}</p> : null}
        </FormField>

        {isStockCategory ? (
          <FormField>
            <Label htmlFor="average_purchase_price">Average Purchase Price</Label>
            <Input id="average_purchase_price" type="number" step="0.0001" value={formValues.average_purchase_price} onChange={(event) => updateField("average_purchase_price", event.target.value)} />
            {errors.average_purchase_price ? <p className="text-sm text-rose-600">{errors.average_purchase_price}</p> : null}
            <p className="mt-1 text-xs text-slate-500">Invested value is auto-calculated: {computedInvestedValue.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
          </FormField>
        ) : (
          <FormField>
            <Label htmlFor="cost_basis">Cost basis</Label>
            <Input id="cost_basis" type="number" step="0.01" value={formValues.cost_basis} onChange={(event) => updateField("cost_basis", event.target.value)} />
            {errors.cost_basis ? <p className="text-sm text-rose-600">{errors.cost_basis}</p> : null}
          </FormField>
        )}

        {!isStockCategory ? (
          <FormField>
            <Label htmlFor="sip_amount">SIP amount</Label>
            <Input id="sip_amount" type="number" step="0.01" value={formValues.sip_amount} onChange={(event) => updateField("sip_amount", event.target.value)} />
            {errors.sip_amount ? <p className="text-sm text-rose-600">{errors.sip_amount}</p> : null}
          </FormField>
        ) : null}

        {!isStockCategory ? (
          <FormField>
            <Label htmlFor="sip_date">SIP date</Label>
            <Input id="sip_date" type="number" min={1} max={31} value={formValues.sip_date} onChange={(event) => updateField("sip_date", event.target.value)} />
            {errors.sip_date ? <p className="text-sm text-rose-600">{errors.sip_date}</p> : null}
          </FormField>
        ) : null}

        {!isStockCategory ? (
          <FormField>
            <Label htmlFor="today_gain_loss">Today&apos;s gain/loss</Label>
            <Input id="today_gain_loss" type="number" step="0.01" value={formValues.today_gain_loss} onChange={(event) => updateField("today_gain_loss", event.target.value)} />
          </FormField>
        ) : null}

        <FormField>
          <Label htmlFor="sector">Sector</Label>
          <Input id="sector" value={formValues.sector} onChange={(event) => updateField("sector", event.target.value)} />
        </FormField>

        {isStockCategory ? (
          <FormField>
            <Label htmlFor="exchange">Exchange</Label>
            <Input id="exchange" value={formValues.exchange} onChange={(event) => updateField("exchange", event.target.value)} />
          </FormField>
        ) : (
          <FormField>
            <Label htmlFor="amc">AMC / Issuer</Label>
            <Input id="amc" value={formValues.amc} onChange={(event) => updateField("amc", event.target.value)} />
          </FormField>
        )}

        <FormField>
          <Label htmlFor="purchase_date">Purchase date</Label>
          <Input id="purchase_date" type="date" value={formValues.purchase_date} onChange={(event) => updateField("purchase_date", event.target.value)} />
        </FormField>
      </FormGrid>

      <FormField>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={4} value={formValues.notes} onChange={(event) => updateField("notes", event.target.value)} />
      </FormField>

      <FormActions>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initialData ? "Save changes" : "Add investment"}
        </Button>
      </FormActions>
    </form>
  );
}