"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";

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
import {
  buildInsuranceSummary,
  createInsurancePolicy,
  deleteInsurancePolicy,
  getInsurancePolicies,
  toMonthlyPremiumEquivalent,
  updateInsurancePolicy,
} from "@/services/insurancePolicies";
import type {
  InsurancePolicy,
  InsurancePolicyInsert,
  InsurancePremiumFrequency,
  InsurancePolicyStatus,
  InsurancePolicyType,
} from "@/types/insurancePolicy";

const policyTypes: InsurancePolicyType[] = [
  "Life",
  "Health",
  "Vehicle",
  "Home",
  "Travel",
  "Personal Accident",
  "Critical Illness",
  "Term",
  "ULIP",
  "Other",
];

const premiumFrequencies: InsurancePremiumFrequency[] = ["Monthly", "Quarterly", "Half-Yearly", "Yearly", "Single"];
const statuses: InsurancePolicyStatus[] = ["Active", "Grace", "Lapsed", "Matured", "Cancelled"];

const defaultValues: InsurancePolicyInsert = {
  policy_name: "",
  policy_type: "Life",
  insurer: "",
  policy_number: "",
  owner: "",
  covered_person: "",
  nominee: "",
  cover_amount: 0,
  premium_amount: 0,
  premium_frequency: "Monthly",
  start_date: null,
  renewal_date: null,
  maturity_date: null,
  status: "Active",
  include_in_cash_flow: true,
  notes: "",
};

function formatMoney(value: number): string {
  return `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatDateLabel(dateValue: string | null): string {
  if (!dateValue) {
    return "-";
  }

  const parsed = new Date(`${dateValue}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function maskPolicyNumber(value: string): string {
  const clean = value.trim();
  if (clean.length <= 4) {
    return clean;
  }

  return `${"*".repeat(Math.max(0, clean.length - 4))}${clean.slice(-4)}`;
}

function StatCard(props: { label: string; value: string; hint?: string }) {
  return (
    <DashboardCard className="border-indigo-100 bg-gradient-to-br from-white via-indigo-50/40 to-purple-50/40">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-indigo-500">{props.label}</p>
        <p className="text-xl font-semibold text-slate-900 sm:text-2xl">{props.value}</p>
        {props.hint ? <p className="text-xs text-slate-500">{props.hint}</p> : null}
      </div>
    </DashboardCard>
  );
}

export default function InsurancePage() {
  const [rows, setRows] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<InsurancePolicy | null>(null);
  const [formValues, setFormValues] = useState<InsurancePolicyInsert>(defaultValues);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<InsurancePolicyStatus | "ALL">("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      setLoading(true);
      const data = await getInsurancePolicies();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load insurance policies.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      try {
        const data = await getInsurancePolicies();
        if (!isMounted) {
          return;
        }
        setRows(data);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Unable to load insurance policies.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadInitial();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) {
      return;
    }
    const timer = window.setTimeout(() => setError(null), 4200);
    return () => window.clearTimeout(timer);
  }, [error]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
      const matchesQuery =
        !normalized ||
        `${row.policy_name} ${row.policy_type} ${row.insurer} ${row.owner} ${row.covered_person} ${row.nominee ?? ""}`
          .toLowerCase()
          .includes(normalized);

      return matchesStatus && matchesQuery;
    });
  }, [rows, query, statusFilter]);

  const summary = useMemo(() => buildInsuranceSummary(filteredRows), [filteredRows]);

  function openCreateDialog() {
    setEditing(null);
    setFormValues(defaultValues);
    setDialogOpen(true);
  }

  function openEditDialog(item: InsurancePolicy) {
    setEditing(item);
    setFormValues({
      policy_name: item.policy_name,
      policy_type: item.policy_type,
      insurer: item.insurer,
      policy_number: item.policy_number,
      owner: item.owner,
      covered_person: item.covered_person,
      nominee: item.nominee,
      cover_amount: item.cover_amount,
      premium_amount: item.premium_amount,
      premium_frequency: item.premium_frequency,
      start_date: item.start_date,
      renewal_date: item.renewal_date,
      maturity_date: item.maturity_date,
      status: item.status,
      include_in_cash_flow: item.include_in_cash_flow,
      notes: item.notes,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editing) {
        await updateInsurancePolicy({ id: editing.id, ...formValues });
        setNotice("Policy updated successfully.");
      } else {
        await createInsurancePolicy(formValues);
        setNotice("Policy added successfully.");
      }

      setDialogOpen(false);
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save insurance policy.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: InsurancePolicy) {
    const confirmed = window.confirm(`Delete policy ${item.policy_name}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteInsurancePolicy(item.id);
      setNotice("Policy deleted successfully.");
      await refresh();
      window.dispatchEvent(new Event("wealthos:finance-data-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete insurance policy.");
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PageHeader
            title="Insurance"
            description="Manage all family insurance policies, recurring premiums, ownership, nominees, and renewal visibility in one colorful command center."
          />
          <Button onClick={openCreateDialog} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500">
            Add Policy
          </Button>
        </div>

        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />
        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Total Annual Premium" value={formatMoney(summary.totalAnnualPremium)} />
          <StatCard label="Monthly Premium Equivalent" value={formatMoney(summary.monthlyPremiumEquivalent)} />
          <StatCard label="Total Life Cover" value={formatMoney(summary.totalLifeCover)} />
          <StatCard label="Total Health Cover" value={formatMoney(summary.totalHealthCover)} />
          <StatCard label="Active Policies" value={String(summary.activePolicies)} />
          <StatCard label="Next Renewal Due" value={summary.nextRenewalDue ? formatDateLabel(summary.nextRenewalDue) : "None"} />
        </section>

        <DashboardCard className="border-indigo-100">
          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2">
              <Label htmlFor="insurance-search">Search policies</Label>
              <Input
                id="insurance-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by policy, insurer, owner, nominee"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance-status">Status</Label>
              <select
                id="insurance-status"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as InsurancePolicyStatus | "ALL")}
              >
                <option value="ALL">All</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>
        </DashboardCard>

        {loading ? (
          <DashboardCard className="border-indigo-100">
            <LoadingSpinner label="Loading insurance policies..." />
          </DashboardCard>
        ) : filteredRows.length === 0 ? (
          <DashboardCard className="border-dashed border-indigo-200 bg-indigo-50/40">
            <div className="px-4 py-10 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-indigo-500" />
              <p className="mt-3 text-sm font-medium text-slate-700">No insurance policies found.</p>
              <p className="mt-1 text-sm text-slate-500">Add your first policy to include monthly premium commitments in planning.</p>
            </div>
          </DashboardCard>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filteredRows.map((policy) => {
              const monthlyEquivalent = toMonthlyPremiumEquivalent(policy.premium_amount, policy.premium_frequency);
              return (
                <DashboardCard key={policy.id} className="border-indigo-100 bg-gradient-to-b from-white to-indigo-50/30">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{policy.policy_name}</p>
                        <p className="text-xs text-slate-500">{policy.policy_type} • {policy.insurer}</p>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">{policy.status}</span>
                    </div>

                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Policy Number</dt>
                        <dd className="font-medium text-slate-900">{maskPolicyNumber(policy.policy_number)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Owner</dt>
                        <dd className="font-medium text-slate-900">{policy.owner}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Covered Person</dt>
                        <dd className="font-medium text-slate-900">{policy.covered_person}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Nominee</dt>
                        <dd className="font-medium text-slate-900">{policy.nominee ?? "-"}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Cover Amount</dt>
                        <dd className="font-semibold text-slate-900">{formatMoney(policy.cover_amount)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Premium Amount</dt>
                        <dd className="font-semibold text-slate-900">{formatMoney(policy.premium_amount)} ({policy.premium_frequency})</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Monthly Equivalent</dt>
                        <dd className="font-semibold text-indigo-700">{formatMoney(monthlyEquivalent)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Start Date</dt>
                        <dd className="font-medium text-slate-900">{formatDateLabel(policy.start_date)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Renewal Date</dt>
                        <dd className="font-medium text-slate-900">{formatDateLabel(policy.renewal_date)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Maturity / End Date</dt>
                        <dd className="font-medium text-slate-900">{formatDateLabel(policy.maturity_date)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-slate-500">Include in Cash Flow</dt>
                        <dd className="font-medium text-slate-900">{policy.include_in_cash_flow ? "Yes" : "No"}</dd>
                      </div>
                    </dl>

                    <div className="flex items-center gap-2 pt-1">
                      <Button type="button" variant="outline" className="h-8 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => openEditDialog(policy)}>
                        Edit
                      </Button>
                      <Button type="button" variant="outline" className="h-8 border-rose-200 text-rose-700 hover:bg-rose-50" onClick={() => handleDelete(policy)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </DashboardCard>
              );
            })}
          </section>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Policy" : "Add Policy"}</DialogTitle>
            </DialogHeader>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="policy_name">Policy Name</Label>
                  <Input id="policy_name" value={formValues.policy_name} onChange={(event) => setFormValues((prev) => ({ ...prev, policy_name: event.target.value }))} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="policy_type">Policy Type</Label>
                  <select
                    id="policy_type"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={formValues.policy_type}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, policy_type: event.target.value as InsurancePolicyType }))}
                  >
                    {policyTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="insurer">Insurer</Label>
                  <Input id="insurer" value={formValues.insurer} onChange={(event) => setFormValues((prev) => ({ ...prev, insurer: event.target.value }))} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="policy_number">Policy Number</Label>
                  <Input id="policy_number" value={formValues.policy_number} onChange={(event) => setFormValues((prev) => ({ ...prev, policy_number: event.target.value }))} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner">Owner</Label>
                  <Input id="owner" value={formValues.owner} onChange={(event) => setFormValues((prev) => ({ ...prev, owner: event.target.value }))} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="covered_person">Covered Person / Life Assured</Label>
                  <Input id="covered_person" value={formValues.covered_person} onChange={(event) => setFormValues((prev) => ({ ...prev, covered_person: event.target.value }))} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nominee">Nominee</Label>
                  <Input id="nominee" value={formValues.nominee ?? ""} onChange={(event) => setFormValues((prev) => ({ ...prev, nominee: event.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cover_amount">Sum Assured / Cover Amount</Label>
                  <Input
                    id="cover_amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formValues.cover_amount ?? 0}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, cover_amount: Number(event.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="premium_amount">Premium Amount</Label>
                  <Input
                    id="premium_amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formValues.premium_amount ?? 0}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, premium_amount: Number(event.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="premium_frequency">Premium Frequency</Label>
                  <select
                    id="premium_frequency"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={formValues.premium_frequency}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, premium_frequency: event.target.value as InsurancePremiumFrequency }))}
                  >
                    {premiumFrequencies.map((frequency) => (
                      <option key={frequency} value={frequency}>{frequency}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    value={formValues.status}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, status: event.target.value as InsurancePolicyStatus }))}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" type="date" value={formValues.start_date ?? ""} onChange={(event) => setFormValues((prev) => ({ ...prev, start_date: event.target.value || null }))} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="renewal_date">Renewal Date</Label>
                  <Input id="renewal_date" type="date" value={formValues.renewal_date ?? ""} onChange={(event) => setFormValues((prev) => ({ ...prev, renewal_date: event.target.value || null }))} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maturity_date">Maturity / End Date</Label>
                  <Input id="maturity_date" type="date" value={formValues.maturity_date ?? ""} onChange={(event) => setFormValues((prev) => ({ ...prev, maturity_date: event.target.value || null }))} />
                </div>

                <label className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(formValues.include_in_cash_flow)}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, include_in_cash_flow: event.target.checked }))}
                  />
                  Include in Cash Flow
                </label>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={formValues.notes ?? ""} onChange={(event) => setFormValues((prev) => ({ ...prev, notes: event.target.value }))} rows={3} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500">
                  {submitting ? "Saving..." : editing ? "Save Changes" : "Add Policy"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </AppLayout>
  );
}
