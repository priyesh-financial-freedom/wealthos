"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { InvestmentDetailsDialog } from "@/components/investments/InvestmentDetailsDialog";
import { InvestmentSummaryCard, formatSignedCurrency } from "@/components/investments/InvestmentSummaryCard";
import { parseInvestmentDocuments, serializeInvestmentDocuments } from "@/components/investments/documents";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { PageBreadcrumb } from "@/components/layout/PageBreadcrumb";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageToolbar } from "@/components/layout/PageToolbar";
import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToastViewport } from "@/components/ui/feedback";
import { FormActions, FormField, FormGrid } from "@/components/ui/form-layout";
import { ModuleKpiGrid, ModuleOnboardingState } from "@/components/ui/module-design-system";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { createStartupInvestment, deleteStartupInvestment, listStartupInvestments, updateStartupInvestment } from "@/services/investments/startupInvestments";
import type { Investment, InvestmentStatus } from "@/types/investment";
import { Eye, Pencil, Trash2 } from "lucide-react";

type FormValues = {
  startup_name: string;
  funding_round: string;
  investment_date: string;
  amount_invested: number | string;
  ownership_percent: number | string;
  current_estimated_value: number | string;
  owner: string;
  status: InvestmentStatus;
  notes: string;
  documentsSelected: string[];
  documentsUploaded: Partial<Record<string, { fileName: string | null; uploadDate: string }>>;
};

function toNumber(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fromInvestment(item?: Investment | null): FormValues {
  const docs = parseInvestmentDocuments(item?.documents_placeholder);
  return {
    startup_name: item?.investment_name ?? "",
    funding_round: item?.startup_funding_round ?? "",
    investment_date: item?.acquisition_date ?? item?.purchase_date ?? "",
    amount_invested: item?.cost_value ?? item?.cost_basis ?? 0,
    ownership_percent: item?.startup_ownership_percent ?? 0,
    current_estimated_value: item?.current_value ?? 0,
    owner: item?.owner ?? "",
    status: item?.status ?? "active",
    notes: item?.notes ?? "",
    documentsSelected: docs.map((doc) => doc.type),
    documentsUploaded: docs.reduce<FormValues["documentsUploaded"]>((acc, doc) => {
      acc[doc.type] = { fileName: doc.fileName, uploadDate: doc.uploadDate ?? new Date().toISOString().slice(0, 10) };
      return acc;
    }, {}),
  };
}

export default function StartupInvestmentsPage() {
  const [rows, setRows] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const [selected, setSelected] = useState<Investment | null>(null);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(fromInvestment());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  async function refresh() {
    try {
      setLoading(true);
      const data = await listStartupInvestments();
      setRows(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load startup investments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = q.length === 0 || `${row.investment_name} ${row.startup_funding_round ?? ""} ${row.owner ?? ""}`.toLowerCase().includes(q);
      const matchesOwner = ownerFilter === "all" || row.owner === ownerFilter;
      return matchesQuery && matchesOwner;
    });
  }, [rows, query, ownerFilter]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.owner?.trim() ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const summary = useMemo(() => {
    const totalInvested = rows.reduce((sum, row) => sum + Number(row.cost_value ?? row.cost_basis ?? 0), 0);
    const totalCurrentValue = rows.reduce((sum, row) => sum + Number(row.current_value ?? 0), 0);
    const totalGain = totalCurrentValue - totalInvested;
    const avgOwnership = rows.length > 0
      ? rows.reduce((sum, row) => sum + Number(row.startup_ownership_percent ?? 0), 0) / rows.length
      : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalGain,
      grantsCount: rows.length,
      avgOwnership,
    };
  }, [rows]);

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function toggleDocument(type: string) {
    setValues((current) => {
      if (current.documentsSelected.includes(type)) {
        return { ...current, documentsSelected: current.documentsSelected.filter((item) => item !== type) };
      }
      return { ...current, documentsSelected: [...current.documentsSelected, type] };
    });
  }

  function handleDocumentUpload(type: string, file: File | null) {
    setValues((current) => ({
      ...current,
      documentsSelected: current.documentsSelected.includes(type) ? current.documentsSelected : [...current.documentsSelected, type],
      documentsUploaded: {
        ...current.documentsUploaded,
        [type]: { fileName: file?.name ?? null, uploadDate: new Date().toISOString().slice(0, 10) },
      },
    }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!values.startup_name.trim()) next.startup_name = "Startup name is required.";
    if (!values.owner.trim()) next.owner = "Owner is required.";
    if (!values.investment_date) next.investment_date = "Investment date is required.";
    if (toNumber(values.amount_invested) < 0) next.amount_invested = "Amount invested must be zero or higher.";
    if (toNumber(values.current_estimated_value) < 0) next.current_estimated_value = "Current estimated value must be zero or higher.";
    if (toNumber(values.ownership_percent) < 0 || toNumber(values.ownership_percent) > 100) next.ownership_percent = "Ownership % must be between 0 and 100.";
    return next;
  }

  function openCreate() {
    setEditing(null);
    setValues(fromInvestment());
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(item: Investment) {
    setEditing(item);
    setValues(fromInvestment(item));
    setFormErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errs = validate();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);

    const payload = {
      startup_name: values.startup_name.trim(),
      funding_round: values.funding_round.trim(),
      investment_date: values.investment_date,
      amount_invested: toNumber(values.amount_invested),
      ownership_percent: toNumber(values.ownership_percent),
      current_estimated_value: toNumber(values.current_estimated_value),
      owner: values.owner.trim(),
      status: values.status,
      notes: values.notes.trim() || null,
      documents_placeholder: serializeInvestmentDocuments({ selectedTypes: values.documentsSelected, uploadedByType: values.documentsUploaded }),
    };

    try {
      if (editing) {
        await updateStartupInvestment({ id: editing.id, ...payload });
        setNotice("Startup investment updated.");
      } else {
        await createStartupInvestment(payload);
        setNotice("Startup investment added.");
      }
      setFormOpen(false);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save startup investment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await deleteStartupInvestment(item.id);
      setDeleteTarget(null);
      setNotice("Startup investment deleted.");
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete startup investment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Investments", href: "/investments" }, { label: "Startup Investments" }]} />
        <PageToolbar>
          <PageHeader title="Startup Investments" description="RC1 Lite tracking for private startup positions." summary={summary.grantsCount > 0 ? `${summary.grantsCount} Positions` : undefined} />
          <Button onClick={openCreate} disabled={submitting}>Add Startup Investment</Button>
        </PageToolbar>

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <ModuleKpiGrid>
          <InvestmentSummaryCard title="Total Invested" value={summary.grantsCount === 0 ? "No Positions Yet" : formatCurrency(summary.totalInvested, { maximumFractionDigits: 0 })} subtitle="Amount invested across startup positions" icon="allocation" />
          <InvestmentSummaryCard title="Current Estimated Value" value={summary.grantsCount === 0 ? "No Positions Yet" : formatCurrency(summary.totalCurrentValue, { maximumFractionDigits: 0 })} subtitle="Latest estimated value" icon="wallet" />
          <InvestmentSummaryCard title="Unrealized Gain" value={summary.grantsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.totalGain)} subtitle="Estimated value minus invested amount" icon="change" tone={summary.totalGain >= 0 ? "positive" : "warning"} />
          <InvestmentSummaryCard title="Average Ownership %" value={summary.grantsCount === 0 ? "No Positions Yet" : `${summary.avgOwnership.toFixed(2)}%`} subtitle="Simple average ownership across holdings" icon="count" />
        </ModuleKpiGrid>

        {rows.length === 0 ? (
          <ContentContainer>
            <ModuleOnboardingState title="No Startup Investments Yet" description="Add your first startup position." steps={["Add Position", "Set Ownership %", "Track Current Estimated Value"]} />
          </ContentContainer>
        ) : null}

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <DataGrid
            title="Startup Positions"
            description="Track private startup holdings"
            columns={[
              { key: "startup_name", header: "Startup Name", widthClassName: "min-w-44", className: "font-medium text-slate-900", cell: (row) => row.investment_name },
              { key: "funding_round", header: "Funding Round", widthClassName: "min-w-24", cell: (row) => row.startup_funding_round || "-" },
              { key: "investment_date", header: "Investment Date", widthClassName: "min-w-28", cell: (row) => row.acquisition_date || row.purchase_date || "-" },
              { key: "amount_invested", header: "Amount Invested", widthClassName: "min-w-32", cell: (row) => formatCurrency(row.cost_value ?? row.cost_basis, { maximumFractionDigits: 0 }) },
              { key: "ownership", header: "Ownership %", widthClassName: "min-w-20", cell: (row) => `${Number(row.startup_ownership_percent ?? 0).toFixed(2)}%` },
              { key: "current_estimated_value", header: "Current Estimated Value", widthClassName: "min-w-32", cell: (row) => formatCurrency(row.current_value, { maximumFractionDigits: 0 }) },
              { key: "owner", header: "Owner", widthClassName: "min-w-24", cell: (row) => row.owner || "-" },
              { key: "status", header: "Status", widthClassName: "min-w-20", cell: (row) => row.status },
              {
                key: "actions",
                header: "Actions",
                widthClassName: "min-w-60",
                className: "text-right",
                headerClassName: "text-right",
                cell: (row) => (
                  <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => setSelected(row)}><Eye className="h-4 w-4" />View</Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" />Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleteTarget(row)}><Trash2 className="h-4 w-4" />Delete</Button>
                  </div>
                ),
              },
            ]}
            rows={filtered}
            getRowId={(row) => row.id}
            onRowClick={setSelected}
            search={{ value: query, onChange: setQuery, placeholder: "Search by startup, round, or owner" }}
            filters={
              <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                <option value="all">All owners</option>
                {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
              </select>
            }
            actions={<Button size="sm" onClick={openCreate}>Add Startup Investment</Button>}
            emptyTitle={loading ? "Loading startup investments..." : "No startup investments"}
            emptyDescription={loading ? "" : "Add your first startup position."}
            selection={{ enabled: false }}
          />
        </ContentContainer>
      </PageContainer>

      <InvestmentDetailsDialog investment={selected} totalPortfolioValue={summary.totalCurrentValue} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} />

      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Startup Investment" : "Add Startup Investment"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormGrid>
              <FormField>
                <Label htmlFor="startup_name">Startup Name</Label>
                <Input id="startup_name" value={values.startup_name} onChange={(event) => updateField("startup_name", event.target.value)} />
                {formErrors.startup_name ? <p className="text-sm text-rose-600">{formErrors.startup_name}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="funding_round">Funding Round</Label>
                <Input id="funding_round" value={values.funding_round} onChange={(event) => updateField("funding_round", event.target.value)} />
              </FormField>

              <FormField>
                <Label htmlFor="investment_date">Investment Date</Label>
                <Input id="investment_date" type="date" value={values.investment_date} onChange={(event) => updateField("investment_date", event.target.value)} />
                {formErrors.investment_date ? <p className="text-sm text-rose-600">{formErrors.investment_date}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="amount_invested">Amount Invested</Label>
                <Input id="amount_invested" type="number" step="0.01" value={values.amount_invested} onChange={(event) => updateField("amount_invested", event.target.value)} />
                {formErrors.amount_invested ? <p className="text-sm text-rose-600">{formErrors.amount_invested}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="ownership_percent">Ownership %</Label>
                <Input id="ownership_percent" type="number" step="0.0001" value={values.ownership_percent} onChange={(event) => updateField("ownership_percent", event.target.value)} />
                {formErrors.ownership_percent ? <p className="text-sm text-rose-600">{formErrors.ownership_percent}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="current_estimated_value">Current Estimated Value</Label>
                <Input id="current_estimated_value" type="number" step="0.01" value={values.current_estimated_value} onChange={(event) => updateField("current_estimated_value", event.target.value)} />
                {formErrors.current_estimated_value ? <p className="text-sm text-rose-600">{formErrors.current_estimated_value}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="owner">Owner</Label>
                <Input id="owner" value={values.owner} onChange={(event) => updateField("owner", event.target.value)} />
                {formErrors.owner ? <p className="text-sm text-rose-600">{formErrors.owner}</p> : null}
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

            <FormField>
              <Label>Documents</Label>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                {["Term Sheet", "Share Certificate", "Valuation Memo", "Other"].map((type) => (
                  <div key={type} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <label className="flex items-center gap-2 text-slate-700">
                      <input type="checkbox" checked={values.documentsSelected.includes(type)} onChange={() => toggleDocument(type)} />
                      <span>{type}</span>
                    </label>
                    <label className="cursor-pointer">
                      <input type="file" className="hidden" onChange={(event) => handleDocumentUpload(type, event.target.files?.[0] ?? null)} />
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
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editing ? "Save changes" : "Add Startup Investment"}</Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete startup investment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to delete this startup investment?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDelete(deleteTarget)} disabled={submitting}>{submitting ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
