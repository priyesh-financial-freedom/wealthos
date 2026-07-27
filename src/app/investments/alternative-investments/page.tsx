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
import { alternativeInvestmentCategories, createAlternativeInvestment, deleteAlternativeInvestment, listAlternativeInvestments, type AlternativeInvestmentCategory, updateAlternativeInvestment } from "@/services/investments/alternativeInvestments";
import type { Investment, InvestmentStatus } from "@/types/investment";
import { Eye, Pencil, Trash2 } from "lucide-react";

type FormValues = {
  investment_name: string;
  category: AlternativeInvestmentCategory;
  invested_amount: number | string;
  current_value: number | string;
  purchase_date: string;
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
    investment_name: item?.investment_name ?? "",
    category: (item?.alternative_category as AlternativeInvestmentCategory | null) ?? "Others",
    invested_amount: item?.cost_value ?? item?.cost_basis ?? 0,
    current_value: item?.current_value ?? 0,
    purchase_date: item?.acquisition_date ?? item?.purchase_date ?? "",
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

export default function AlternativeInvestmentsPage() {
  const [rows, setRows] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | AlternativeInvestmentCategory>("all");

  const [selected, setSelected] = useState<Investment | null>(null);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(fromInvestment());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  async function refresh() {
    try {
      setLoading(true);
      const data = await listAlternativeInvestments();
      setRows(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load alternative investments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const data = await listAlternativeInvestments();
        if (!isMounted) {
          return;
        }

        setRows(data);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load alternative investments.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = q.length === 0 || `${row.investment_name} ${row.alternative_category ?? ""} ${row.owner ?? ""}`.toLowerCase().includes(q);
      const matchesOwner = ownerFilter === "all" || row.owner === ownerFilter;
      const rowCategory = (row.alternative_category as AlternativeInvestmentCategory | null) ?? "Others";
      const matchesCategory = categoryFilter === "all" || rowCategory === categoryFilter;
      return matchesQuery && matchesOwner && matchesCategory;
    });
  }, [rows, query, ownerFilter, categoryFilter]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.owner?.trim() ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const summary = useMemo(() => {
    const invested = rows.reduce((sum, row) => sum + Number(row.cost_value ?? row.cost_basis ?? 0), 0);
    const current = rows.reduce((sum, row) => sum + Number(row.current_value ?? 0), 0);
    return {
      totalInvested: invested,
      totalCurrent: current,
      gain: current - invested,
      holdingsCount: rows.length,
      categoryCount: new Set(rows.map((row) => row.alternative_category ?? "Others")).size,
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
    if (!values.investment_name.trim()) next.investment_name = "Investment name is required.";
    if (!values.owner.trim()) next.owner = "Owner is required.";
    if (!values.purchase_date) next.purchase_date = "Purchase date is required.";
    if (toNumber(values.invested_amount) < 0) next.invested_amount = "Invested amount must be zero or higher.";
    if (toNumber(values.current_value) < 0) next.current_value = "Current value must be zero or higher.";
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
      investment_name: values.investment_name.trim(),
      category: values.category,
      invested_amount: toNumber(values.invested_amount),
      current_value: toNumber(values.current_value),
      purchase_date: values.purchase_date,
      owner: values.owner.trim(),
      status: values.status,
      notes: values.notes.trim() || null,
      documents_placeholder: serializeInvestmentDocuments({ selectedTypes: values.documentsSelected, uploadedByType: values.documentsUploaded }),
    };

    try {
      if (editing) {
        await updateAlternativeInvestment({ id: editing.id, ...payload });
        setNotice("Alternative investment updated.");
      } else {
        await createAlternativeInvestment(payload);
        setNotice("Alternative investment added.");
      }
      setFormOpen(false);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save alternative investment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await deleteAlternativeInvestment(item.id);
      setDeleteTarget(null);
      setNotice("Alternative investment deleted.");
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete alternative investment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Investments", href: "/investments" }, { label: "Alternative Investments" }]} />
        <PageToolbar>
          <PageHeader title="Alternative Investments" description="RC1 Lite flexible module for niche assets." summary={summary.holdingsCount > 0 ? `${summary.holdingsCount} Holdings` : undefined} />
          <Button onClick={openCreate} disabled={submitting}>Add Alternative Investment</Button>
        </PageToolbar>

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <ModuleKpiGrid>
          <InvestmentSummaryCard title="Total Invested" value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalInvested, { maximumFractionDigits: 0 })} subtitle="Amount invested across alternatives" icon="allocation" />
          <InvestmentSummaryCard title="Current Value" value={summary.holdingsCount === 0 ? "No Holdings Yet" : formatCurrency(summary.totalCurrent, { maximumFractionDigits: 0 })} subtitle="Latest marked value" icon="wallet" />
          <InvestmentSummaryCard title="Unrealized Gain" value={summary.holdingsCount === 0 ? "No Value Change Yet" : formatSignedCurrency(summary.gain)} subtitle="Current value minus invested amount" icon="change" tone={summary.gain >= 0 ? "positive" : "warning"} />
          <InvestmentSummaryCard title="Category Coverage" value={summary.holdingsCount === 0 ? "No Holdings Yet" : `${summary.categoryCount} categories`} subtitle="Distinct alternative categories in use" icon="count" />
        </ModuleKpiGrid>

        {rows.length === 0 ? (
          <ContentContainer>
            <ModuleOnboardingState title="No Alternative Investments Yet" description="Add your first alternative asset position." steps={["Choose Category", "Add Invested Amount", "Track Current Value"]} />
          </ContentContainer>
        ) : null}

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <DataGrid
            title="Alternative Holdings"
            description="Flexible tracking for niche asset classes"
            columns={[
              { key: "investment_name", header: "Investment Name", widthClassName: "min-w-44", className: "font-medium text-slate-900", cell: (row) => row.investment_name },
              { key: "category", header: "Category", widthClassName: "min-w-28", cell: (row) => row.alternative_category || "Others" },
              { key: "invested_amount", header: "Invested Amount", widthClassName: "min-w-32", cell: (row) => formatCurrency(row.cost_value ?? row.cost_basis, { maximumFractionDigits: 0 }) },
              { key: "current_value", header: "Current Value", widthClassName: "min-w-32", cell: (row) => formatCurrency(row.current_value, { maximumFractionDigits: 0 }) },
              { key: "purchase_date", header: "Purchase Date", widthClassName: "min-w-28", cell: (row) => row.acquisition_date || row.purchase_date || "-" },
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
            search={{ value: query, onChange: setQuery, placeholder: "Search by name, category, or owner" }}
            filters={
              <>
                <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                  <option value="all">All owners</option>
                  {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                </select>
                <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | AlternativeInvestmentCategory)}>
                  <option value="all">All categories</option>
                  {alternativeInvestmentCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </>
            }
            actions={<Button size="sm" onClick={openCreate}>Add Alternative Investment</Button>}
            emptyTitle={loading ? "Loading alternative investments..." : "No alternative investments"}
            emptyDescription={loading ? "" : "Add your first alternative investment."}
            selection={{ enabled: false }}
          />
        </ContentContainer>
      </PageContainer>

      <InvestmentDetailsDialog investment={selected} totalPortfolioValue={summary.totalCurrent} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} />

      <Dialog open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditing(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Alternative Investment" : "Add Alternative Investment"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormGrid>
              <FormField>
                <Label htmlFor="investment_name">Investment Name</Label>
                <Input id="investment_name" value={values.investment_name} onChange={(event) => updateField("investment_name", event.target.value)} />
                {formErrors.investment_name ? <p className="text-sm text-rose-600">{formErrors.investment_name}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="category">Category</Label>
                <select id="category" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={values.category} onChange={(event) => updateField("category", event.target.value as AlternativeInvestmentCategory)}>
                  {alternativeInvestmentCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
              </FormField>

              <FormField>
                <Label htmlFor="invested_amount">Invested Amount</Label>
                <Input id="invested_amount" type="number" step="0.01" value={values.invested_amount} onChange={(event) => updateField("invested_amount", event.target.value)} />
                {formErrors.invested_amount ? <p className="text-sm text-rose-600">{formErrors.invested_amount}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="current_value">Current Value</Label>
                <Input id="current_value" type="number" step="0.01" value={values.current_value} onChange={(event) => updateField("current_value", event.target.value)} />
                {formErrors.current_value ? <p className="text-sm text-rose-600">{formErrors.current_value}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="purchase_date">Purchase Date</Label>
                <Input id="purchase_date" type="date" value={values.purchase_date} onChange={(event) => updateField("purchase_date", event.target.value)} />
                {formErrors.purchase_date ? <p className="text-sm text-rose-600">{formErrors.purchase_date}</p> : null}
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
                {["Statement", "Valuation", "Contract", "Other"].map((type) => (
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
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editing ? "Save changes" : "Add Alternative Investment"}</Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete alternative investment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to delete this alternative investment?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDelete(deleteTarget)} disabled={submitting}>{submitting ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
