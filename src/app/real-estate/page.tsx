"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { getLiabilities } from "@/services/liabilities";
import {
  createRealEstateProperty,
  deleteRealEstateProperty,
  getRealEstateProperties,
  updateRealEstateProperty,
} from "@/services/realEstateProperties";
import type { Liability } from "@/types/liability";
import {
  REAL_ESTATE_PROPERTY_TYPES,
  type OccupancyStatus,
  type RealEstateProperty,
  type RealEstatePropertyInsert,
  type RealEstatePropertyType,
} from "@/types/realEstateProperty";

const defaultValues: RealEstatePropertyInsert = {
  property_name: "",
  property_type: "Apartment",
  owner: "",
  purchase_date: null,
  purchase_price: 0,
  current_market_value: 0,
  address: "",
  city: "",
  state: "",
  pin_code: "",
  occupancy_status: "self_occupied",
  monthly_rent: 0,
  linked_home_loan_id: null,
  notes: "",
};

function hasLinkedHomeLoan(liability: Liability) {
  return liability.liability_type === "Home Loan" || liability.liability_type === "Loan Against Property";
}

export default function RealEstatePage() {
  const [properties, setProperties] = useState<RealEstateProperty[]>([]);
  const [homeLoans, setHomeLoans] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RealEstateProperty | null>(null);
  const [formValues, setFormValues] = useState<RealEstatePropertyInsert>(defaultValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const [propertyRows, liabilityRows] = await Promise.all([
        getRealEstateProperties(),
        getLiabilities().catch(() => []),
      ]);
      setProperties(propertyRows);
      setHomeLoans(liabilityRows.filter(hasLinkedHomeLoan));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load real estate module");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      try {
        const [propertyRows, liabilityRows] = await Promise.all([
          getRealEstateProperties(),
          getLiabilities().catch(() => []),
        ]);

        if (!mounted) {
          return;
        }

        setProperties(propertyRows);
        setHomeLoans(liabilityRows.filter(hasLinkedHomeLoan));
        setError(null);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Unable to load real estate module");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadInitial();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(null), 4500);
    return () => window.clearTimeout(timer);
  }, [error]);

  const filteredProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return properties;
    }

    return properties.filter((property) =>
      `${property.property_name} ${property.city} ${property.owner} ${property.property_type} ${property.state}`.toLowerCase().includes(normalizedQuery),
    );
  }, [properties, query]);

  const kpis = useMemo(() => {
    const totalValue = filteredProperties.reduce((sum, property) => sum + Number(property.current_market_value ?? 0), 0);
    const numberOfProperties = filteredProperties.length;
    const rentalIncome = filteredProperties
      .filter((property) => property.occupancy_status === "rented")
      .reduce((sum, property) => sum + Number(property.monthly_rent ?? 0), 0);

    return {
      totalValue,
      numberOfProperties,
      rentalIncome,
      averageValue: numberOfProperties > 0 ? totalValue / numberOfProperties : 0,
    };
  }, [filteredProperties]);

  function openCreateDialog() {
    setEditing(null);
    setFormValues(defaultValues);
    setDialogOpen(true);
  }

  function openEditDialog(property: RealEstateProperty) {
    setEditing(property);
    setFormValues({
      property_name: property.property_name,
      property_type: property.property_type,
      owner: property.owner,
      purchase_date: property.purchase_date,
      purchase_price: property.purchase_price,
      current_market_value: property.current_market_value,
      address: property.address,
      city: property.city,
      state: property.state,
      pin_code: property.pin_code,
      occupancy_status: property.occupancy_status,
      monthly_rent: property.monthly_rent,
      linked_home_loan_id: property.linked_home_loan_id,
      notes: property.notes,
    });
    setDialogOpen(true);
  }

  function validate(values: RealEstatePropertyInsert) {
    if (!values.property_name.trim()) {
      return "Property name is required.";
    }

    if (!values.owner.trim()) {
      return "Owner is required.";
    }

    if (!values.city.trim() || !values.state.trim()) {
      return "City and state are required.";
    }

    if (Number(values.purchase_price) < 0 || Number(values.current_market_value) < 0) {
      return "Purchase price and current market value must be non-negative.";
    }

    if (values.occupancy_status === "rented" && Number(values.monthly_rent ?? 0) < 0) {
      return "Monthly rent must be non-negative for rented properties.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validate(formValues);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (editing) {
        await updateRealEstateProperty({ id: editing.id, ...formValues });
        setNotice("Property updated successfully.");
      } else {
        await createRealEstateProperty(formValues);
        setNotice("Property added successfully.");
      }

      setDialogOpen(false);
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save property");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(property: RealEstateProperty) {
    const confirmed = window.confirm(`Delete property ${property.property_name}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteRealEstateProperty(property.id);
      setNotice("Property deleted successfully.");
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete property");
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Real Estate"
            description="Executive real estate dashboard for property value, rental cash flow, and linked liability visibility."
          />
          <Button onClick={openCreateDialog}>Add Property</Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Real Estate Value" value={formatCurrency(kpis.totalValue, { maximumFractionDigits: 0 })} />
          <StatCard label="Number of Properties" value={kpis.numberOfProperties.toLocaleString("en-IN")} />
          <StatCard label="Rental Income" value={formatCurrency(kpis.rentalIncome, { maximumFractionDigits: 0 })} />
          <StatCard label="Average Property Value" value={formatCurrency(kpis.averageValue, { maximumFractionDigits: 0 })} />
        </section>

        <DashboardCard>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="property-search">Search Properties</Label>
              <Input
                id="property-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by property, city, owner, or type"
              />
            </div>
            <div className="self-end text-sm text-slate-500">{filteredProperties.length} properties</div>
          </div>
        </DashboardCard>

        <DashboardCard>
          {loading ? (
            <LoadingSpinner label="Loading properties..." />
          ) : filteredProperties.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-600">
              Add your first property to start real estate tracking.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Property Name</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">City</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Owner</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">Current Value</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredProperties.map((property) => (
                    <tr key={property.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{property.property_name}</td>
                      <td className="px-4 py-3 text-slate-700">{property.city}</td>
                      <td className="px-4 py-3 text-slate-700">{property.owner}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(property.current_market_value, { maximumFractionDigits: 0 })}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(property)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(property)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Property" : "Add Property"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Basic</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldText label="Property Name" value={formValues.property_name} onChange={(value) => setFormValues((current) => ({ ...current, property_name: value }))} />
                  <FieldSelect
                    label="Property Type"
                    value={formValues.property_type}
                    onChange={(value) => setFormValues((current) => ({ ...current, property_type: value as RealEstatePropertyType }))}
                    options={REAL_ESTATE_PROPERTY_TYPES}
                  />
                  <FieldText label="Owner" value={formValues.owner} onChange={(value) => setFormValues((current) => ({ ...current, owner: value }))} />
                  <FieldText
                    label="Purchase Date"
                    type="date"
                    value={formValues.purchase_date ?? ""}
                    onChange={(value) => setFormValues((current) => ({ ...current, purchase_date: value || null }))}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Financial</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldNumber
                    label="Purchase Price"
                    value={formValues.purchase_price}
                    onChange={(value) => setFormValues((current) => ({ ...current, purchase_price: value }))}
                  />
                  <FieldNumber
                    label="Current Market Value"
                    value={formValues.current_market_value}
                    onChange={(value) => setFormValues((current) => ({ ...current, current_market_value: value }))}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Location</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldText
                    label="Address"
                    value={formValues.address ?? ""}
                    onChange={(value) => setFormValues((current) => ({ ...current, address: value }))}
                  />
                  <FieldText label="City" value={formValues.city} onChange={(value) => setFormValues((current) => ({ ...current, city: value }))} />
                  <FieldText label="State" value={formValues.state} onChange={(value) => setFormValues((current) => ({ ...current, state: value }))} />
                  <FieldText
                    label="PIN Code"
                    value={formValues.pin_code ?? ""}
                    onChange={(value) => setFormValues((current) => ({ ...current, pin_code: value }))}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Income</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldSelect
                    label="Self Occupied / Rented"
                    value={formValues.occupancy_status}
                    onChange={(value) => setFormValues((current) => ({ ...current, occupancy_status: value as OccupancyStatus }))}
                    options={["self_occupied", "rented"]}
                  />
                  <FieldNumber
                    label="Monthly Rent"
                    value={Number(formValues.monthly_rent ?? 0)}
                    disabled={formValues.occupancy_status !== "rented"}
                    onChange={(value) => setFormValues((current) => ({ ...current, monthly_rent: value }))}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Loan</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <FieldSelect
                    label="Optional Linked Home Loan"
                    value={formValues.linked_home_loan_id ?? ""}
                    onChange={(value) => setFormValues((current) => ({ ...current, linked_home_loan_id: value || null }))}
                    options={["", ...homeLoans.map((loan) => loan.id)]}
                    renderOption={(value) => {
                      if (!value) {
                        return "None";
                      }
                      const loan = homeLoans.find((row) => row.id === value);
                      return loan ? `${loan.account_name} (${formatCurrency(loan.outstanding_amount, { maximumFractionDigits: 0 })})` : value;
                    }}
                  />
                </div>
              </section>

              <section className="space-y-2">
                <Label htmlFor="property-notes">Notes</Label>
                <Textarea
                  id="property-notes"
                  rows={4}
                  value={formValues.notes ?? ""}
                  onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))}
                />
              </section>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : editing ? "Save changes" : "Add property"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AppLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <DashboardCard>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </DashboardCard>
  );
}

function FieldText({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = `property-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function FieldNumber({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const id = `property-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step="0.01"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  renderOption,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  renderOption?: (value: string) => string;
}) {
  const id = `property-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option || "none"} value={option}>
            {renderOption ? renderOption(option) : option}
          </option>
        ))}
      </select>
    </div>
  );
}
