"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { AppLayout } from "@/components/layout/AppLayout";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner, ToastViewport } from "@/components/ui/feedback";
import { createSilverHolding, deleteSilverHolding, getSilverHoldings, updateSilverHolding } from "@/services/silverHoldings";
import type { SilverHolding, SilverHoldingInsert, SilverHoldingType } from "@/types/silverHolding";

const defaultValues: SilverHoldingInsert = {
  holding_type: "Physical Silver",
  description: "",
  quantity: 0,
  unit: "g",
  purity: "",
  purchase_date: null,
  cost_basis: 0,
  current_value: 0,
  custodian: "",
  institution: "",
  owner: "",
  nominee: "",
  notes: "",
  documents_placeholder: "",
};

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function SilverPage() {
  const [rows, setRows] = useState<SilverHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SilverHoldingType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SilverHolding | null>(null);
  const [formValues, setFormValues] = useState<SilverHoldingInsert>(defaultValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const data = await getSilverHoldings();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load silver holdings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const data = await getSilverHoldings();
        if (!isMounted) {
          return;
        }
        setRows(data);
        setError(null);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load silver holdings");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesQuery = !normalized || `${item.holding_type} ${item.description} ${item.owner ?? ""} ${item.custodian ?? ""}`.toLowerCase().includes(normalized);
      const matchesType = typeFilter === "all" || item.holding_type === typeFilter;
      return matchesQuery && matchesType;
    });
  }, [rows, query, typeFilter]);

  const totals = useMemo(
    () => ({
      cost: filteredRows.reduce((sum, row) => sum + row.cost_basis, 0),
      current: filteredRows.reduce((sum, row) => sum + row.current_value, 0),
    }),
    [filteredRows],
  );

  function openCreateDialog() {
    setEditing(null);
    setFormValues(defaultValues);
    setDialogOpen(true);
  }

  function openEditDialog(item: SilverHolding) {
    setEditing(item);
    setFormValues({
      holding_type: item.holding_type,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      purity: item.purity,
      purchase_date: item.purchase_date,
      cost_basis: item.cost_basis,
      current_value: item.current_value,
      custodian: item.custodian,
      institution: item.institution,
      owner: item.owner,
      nominee: item.nominee,
      notes: item.notes,
      documents_placeholder: item.documents_placeholder,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editing) {
        await updateSilverHolding({ id: editing.id, ...formValues });
        setNotice("Silver holding updated successfully.");
      } else {
        await createSilverHolding(formValues);
        setNotice("Silver holding created successfully.");
      }
      setDialogOpen(false);
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save silver holding");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: SilverHolding) {
    const confirmed = window.confirm(`Delete ${item.description}?`);
    if (!confirmed) return;

    try {
      await deleteSilverHolding(item.id);
      setNotice("Silver holding deleted successfully.");
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete silver holding");
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Silver"
            description="Track physical silver, Silver ETF, and digital silver under a dedicated silver module."
          />
          <Button onClick={openCreateDialog}>Add Silver Holding</Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Holdings" value={String(filteredRows.length)} />
          <StatCard label="Total Cost" value={formatMoney(totals.cost)} />
          <StatCard label="Current Value" value={formatMoney(totals.current)} />
          <StatCard label="Gain / Loss" value={formatMoney(totals.current - totals.cost)} />
        </section>

        <DashboardCard>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <Label htmlFor="silver-search">Search</Label>
              <Input id="silver-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by type, description, owner, custodian" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="silver-type">Type</Label>
              <select id="silver-type" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | SilverHoldingType)}>
                <option value="all">All</option>
                <option value="Physical Silver">Physical Silver</option>
                <option value="Silver ETF">Silver ETF</option>
                <option value="Digital Silver">Digital Silver</option>
              </select>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          {loading ? (
            <LoadingSpinner label="Loading silver holdings..." />
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-600">No silver holdings yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {["Type", "Description", "Qty", "Unit", "Owner", "Current", "Actions"].map((label) => (
                      <th key={label} className="px-4 py-3 text-left font-medium text-slate-500">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{item.holding_type}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.description}</td>
                      <td className="px-4 py-3">{item.quantity.toLocaleString()}</td>
                      <td className="px-4 py-3">{item.unit}</td>
                      <td className="px-4 py-3">{item.owner || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(item.current_value)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(item)}>Edit</Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(item)}>Delete</Button>
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
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Silver Holding" : "Add Silver Holding"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldSelect label="Holding Type" value={formValues.holding_type} options={["Physical Silver", "Silver ETF", "Digital Silver"]} onChange={(value) => setFormValues((current) => ({ ...current, holding_type: value as SilverHoldingType }))} />
                <FieldText label="Description" value={formValues.description} onChange={(value) => setFormValues((current) => ({ ...current, description: value }))} />
                <FieldNumber label="Quantity / Weight" value={formValues.quantity} onChange={(value) => setFormValues((current) => ({ ...current, quantity: value }))} />
                <FieldText label="Unit" value={formValues.unit} onChange={(value) => setFormValues((current) => ({ ...current, unit: value }))} />
                <FieldText label="Purity" value={formValues.purity ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, purity: value }))} />
                <FieldText label="Purchase Date" type="date" value={formValues.purchase_date ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, purchase_date: value || null }))} />
                <FieldNumber label="Cost Basis" value={formValues.cost_basis} onChange={(value) => setFormValues((current) => ({ ...current, cost_basis: value }))} />
                <FieldNumber label="Current Value" value={formValues.current_value} onChange={(value) => setFormValues((current) => ({ ...current, current_value: value }))} />
                <FieldText label="Custodian" value={formValues.custodian ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, custodian: value }))} />
                <FieldText label="Institution" value={formValues.institution ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, institution: value }))} />
                <FieldText label="Owner" value={formValues.owner ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, owner: value }))} />
                <FieldText label="Nominee" value={formValues.nominee ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, nominee: value }))} />
                <FieldText label="Supporting Documents" value={formValues.documents_placeholder ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, documents_placeholder: value }))} />
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="silver-notes">Notes</Label>
                  <Textarea id="silver-notes" rows={3} value={formValues.notes ?? ""} onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editing ? "Save changes" : "Add holding"}</Button>
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

function FieldText({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  const id = `silver-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function FieldNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = `silver-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const id = `silver-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}
