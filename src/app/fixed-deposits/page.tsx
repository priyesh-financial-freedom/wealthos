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
import {
  createFixedDeposit,
  deleteFixedDeposit,
  getFixedDeposits,
  updateFixedDeposit,
} from "@/services/fixedDeposits";
import type {
  CompoundingFrequency,
  DepositType,
  FixedDeposit,
  FixedDepositInsert,
} from "@/types/fixedDeposit";

const defaultValues: FixedDepositInsert = {
  deposit_type: "FD",
  institution: "",
  branch: "",
  account_number: "",
  holder: "",
  principal: 0,
  interest_rate: 0,
  compounding_frequency: "quarterly",
  current_value: 0,
  opening_date: null,
  maturity_date: null,
  auto_renew: false,
  owner: "",
  nominee: "",
  notes: "",
  documents_placeholder: "",
};

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

export default function FixedDepositsPage() {
  const [rows, setRows] = useState<FixedDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DepositType>("all");
  const [sortValue, setSortValue] = useState("current_value:desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixedDeposit | null>(null);
  const [formValues, setFormValues] = useState<FixedDepositInsert>(defaultValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const data = await getFixedDeposits();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fixed deposits");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const data = await getFixedDeposits();
        if (!isMounted) {
          return;
        }
        setRows(data);
        setError(null);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load fixed deposits");
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

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 4500);
    return () => window.clearTimeout(timer);
  }, [error]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const [field, direction] = sortValue.split(":") as [keyof FixedDeposit, "asc" | "desc"];

    return [...rows]
      .filter((item) => {
        const matchesQuery =
          !normalized ||
          `${item.deposit_type} ${item.institution} ${item.account_number} ${item.holder} ${item.owner ?? ""} ${item.notes ?? ""}`
            .toLowerCase()
            .includes(normalized);
        const matchesType = typeFilter === "all" || item.deposit_type === typeFilter;
        return matchesQuery && matchesType;
      })
      .sort((left, right) => {
        const leftValue = left[field] ?? "";
        const rightValue = right[field] ?? "";
        const multiplier = direction === "asc" ? 1 : -1;

        if (typeof leftValue === "number" && typeof rightValue === "number") {
          return (leftValue - rightValue) * multiplier;
        }

        return String(leftValue).localeCompare(String(rightValue)) * multiplier;
      });
  }, [rows, query, typeFilter, sortValue]);

  const totals = useMemo(
    () => ({
      principal: filteredRows.reduce((sum, row) => sum + row.principal, 0),
      current: filteredRows.reduce((sum, row) => sum + row.current_value, 0),
    }),
    [filteredRows],
  );

  function openCreateDialog() {
    setEditing(null);
    setFormValues(defaultValues);
    setDialogOpen(true);
  }

  function openEditDialog(item: FixedDeposit) {
    setEditing(item);
    setFormValues({
      deposit_type: item.deposit_type,
      institution: item.institution,
      branch: item.branch,
      account_number: item.account_number,
      holder: item.holder,
      principal: item.principal,
      interest_rate: item.interest_rate,
      compounding_frequency: item.compounding_frequency,
      current_value: item.current_value,
      opening_date: item.opening_date,
      maturity_date: item.maturity_date,
      auto_renew: item.auto_renew,
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
    setNotice(null);

    try {
      if (editing) {
        await updateFixedDeposit({ id: editing.id, ...formValues });
        setNotice("Deposit updated successfully.");
      } else {
        await createFixedDeposit(formValues);
        setNotice("Deposit created successfully.");
      }
      setDialogOpen(false);
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save deposit");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: FixedDeposit) {
    const confirmed = window.confirm(`Delete ${item.deposit_type} at ${item.institution}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteFixedDeposit(item.id);
      setNotice("Deposit deleted successfully.");
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete deposit");
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <PageHeader
            title="Fixed Deposits"
            description="Manage Fixed Deposits and Recurring Deposits with maturity, compounding, and nominee tracking."
          />
          <Button onClick={openCreateDialog}>Add Deposit</Button>
        </div>

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Tracked Deposits" value={String(filteredRows.length)} />
          <StatCard label="Total Principal" value={formatMoney(totals.principal)} />
          <StatCard label="Current Value" value={formatMoney(totals.current)} />
          <StatCard label="Growth" value={formatMoney(totals.current - totals.principal)} />
        </section>

        <DashboardCard>
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.8fr_1fr]">
            <div className="space-y-2">
              <Label htmlFor="fd-search">Search</Label>
              <Input
                id="fd-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by institution, account number, holder, owner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fd-type">Type</Label>
              <select
                id="fd-type"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as "all" | DepositType)}
              >
                <option value="all">All</option>
                <option value="FD">Fixed Deposit</option>
                <option value="RD">Recurring Deposit</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fd-sort">Sort</Label>
              <select
                id="fd-sort"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={sortValue}
                onChange={(event) => setSortValue(event.target.value)}
              >
                <option value="current_value:desc">Highest value</option>
                <option value="current_value:asc">Lowest value</option>
                <option value="maturity_date:asc">Nearest maturity</option>
                <option value="institution:asc">Institution A-Z</option>
              </select>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard>
          {loading ? (
            <LoadingSpinner label="Loading deposits..." />
          ) : filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm text-slate-600">
              Add your first FD or RD to start tracking deposits on the balance sheet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      "Type",
                      "Institution",
                      "Account",
                      "Holder",
                      "Principal",
                      "Current",
                      "Rate",
                      "Maturity",
                      "Actions",
                    ].map((label) => (
                      <th key={label} className="px-4 py-3 text-left font-medium text-slate-500">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{item.deposit_type}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{item.institution}</td>
                      <td className="px-4 py-3 text-slate-700">{item.account_number}</td>
                      <td className="px-4 py-3 text-slate-700">{item.holder}</td>
                      <td className="px-4 py-3">{formatMoney(item.principal)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(item.current_value)}</td>
                      <td className="px-4 py-3">{item.interest_rate.toFixed(2)}%</td>
                      <td className="px-4 py-3">{item.maturity_date ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(item)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDelete(item)}>
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
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Deposit" : "Add Deposit"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FieldSelect label="Deposit Type" value={formValues.deposit_type} onChange={(value) => setFormValues((current) => ({ ...current, deposit_type: value as DepositType }))} options={["FD", "RD"]} />
                <FieldText label="Institution" value={formValues.institution} onChange={(value) => setFormValues((current) => ({ ...current, institution: value }))} />
                <FieldText label="Branch" value={formValues.branch ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, branch: value }))} />
                <FieldText label="Account / FD Number" value={formValues.account_number} onChange={(value) => setFormValues((current) => ({ ...current, account_number: value }))} />
                <FieldText label="Holder" value={formValues.holder} onChange={(value) => setFormValues((current) => ({ ...current, holder: value }))} />
                <FieldNumber label="Principal" value={formValues.principal} onChange={(value) => setFormValues((current) => ({ ...current, principal: value }))} />
                <FieldNumber label="Interest Rate" value={formValues.interest_rate} onChange={(value) => setFormValues((current) => ({ ...current, interest_rate: value }))} />
                <FieldSelect label="Compounding Frequency" value={formValues.compounding_frequency ?? "quarterly"} onChange={(value) => setFormValues((current) => ({ ...current, compounding_frequency: value as CompoundingFrequency }))} options={["monthly", "quarterly", "half-yearly", "yearly"]} />
                <FieldNumber label="Current Value" value={formValues.current_value} onChange={(value) => setFormValues((current) => ({ ...current, current_value: value }))} />
                <FieldText label="Opening Date" type="date" value={formValues.opening_date ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, opening_date: value || null }))} />
                <FieldText label="Maturity Date" type="date" value={formValues.maturity_date ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, maturity_date: value || null }))} />
                <FieldSelect label="Auto Renew" value={formValues.auto_renew ? "yes" : "no"} onChange={(value) => setFormValues((current) => ({ ...current, auto_renew: value === "yes" }))} options={["yes", "no"]} />
                <FieldText label="Owner" value={formValues.owner ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, owner: value }))} />
                <FieldText label="Nominee" value={formValues.nominee ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, nominee: value }))} />
                <FieldText label="Supporting Documents" value={formValues.documents_placeholder ?? ""} onChange={(value) => setFormValues((current) => ({ ...current, documents_placeholder: value }))} />
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="fd-notes">Notes</Label>
                  <Textarea id="fd-notes" rows={3} value={formValues.notes ?? ""} onChange={(event) => setFormValues((current) => ({ ...current, notes: event.target.value }))} />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : editing ? "Save changes" : "Add deposit"}
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
  const id = `fd-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function FieldNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const id = `fd-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const id = `fd-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
