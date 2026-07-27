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
import { computeEsopDerivedValues, createEsop, deleteEsop, listEsops, type EsopGrantStatus, updateEsop } from "@/services/investments/esops";
import type { Investment } from "@/types/investment";
import { Eye, Pencil, Trash2 } from "lucide-react";

const grantStatuses: EsopGrantStatus[] = ["Active", "Fully Vested", "Exercised", "Expired"];

type EsopFormValues = {
  company: string;
  grant_name: string;
  owner: string;
  grant_date: string;
  exercise_price: number | string;
  granted_shares: number | string;
  vested_shares: number | string;
  current_share_price: number | string;
  grant_status: EsopGrantStatus;
  notes: string;
  documentsSelected: string[];
  documentsUploaded: Partial<Record<string, { fileName: string | null; uploadDate: string }>>;
};

function toNumber(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fromInvestment(item?: Investment | null): EsopFormValues {
  const documents = parseInvestmentDocuments(item?.documents_placeholder);
  return {
    company: item?.institution ?? "",
    grant_name: item?.investment_name ?? "",
    owner: item?.owner ?? "",
    grant_date: item?.acquisition_date ?? item?.purchase_date ?? "",
    exercise_price: item?.average_purchase_price ?? item?.purchase_price ?? 0,
    granted_shares: item?.units ?? 0,
    vested_shares: item?.esop_vested_shares ?? 0,
    current_share_price: item?.esop_current_share_price ?? "",
    grant_status: (item?.esop_grant_status as EsopGrantStatus | null) ?? "Active",
    notes: item?.notes ?? "",
    documentsSelected: documents.map((doc) => doc.type),
    documentsUploaded: documents.reduce<EsopFormValues["documentsUploaded"]>((acc, doc) => {
      acc[doc.type] = {
        fileName: doc.fileName,
        uploadDate: doc.uploadDate ?? new Date().toISOString().slice(0, 10),
      };
      return acc;
    }, {}),
  };
}

export default function EsopsPage() {
  const [rows, setRows] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | EsopGrantStatus>("all");

  const [selected, setSelected] = useState<Investment | null>(null);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investment | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [formValues, setFormValues] = useState<EsopFormValues>(fromInvestment());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  async function refresh() {
    try {
      setLoading(true);
      const data = await listEsops();
      setRows(data);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load ESOP grants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const data = await listEsops();
        if (!isMounted) {
          return;
        }

        setRows(data);
        setError(null);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Unable to load ESOP grants.");
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

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = q.length === 0 || `${row.institution ?? ""} ${row.investment_name} ${row.owner ?? ""}`.toLowerCase().includes(q);
      const matchesOwner = ownerFilter === "all" || row.owner === ownerFilter;
      const grantStatus = (row.esop_grant_status as EsopGrantStatus | null) ?? "Active";
      const matchesStatus = statusFilter === "all" || grantStatus === statusFilter;
      return matchesQuery && matchesOwner && matchesStatus;
    });
  }, [query, rows, ownerFilter, statusFilter]);

  const summary = useMemo(() => {
    const totalCurrentValue = rows.reduce((sum, row) => sum + Number(row.current_value ?? 0), 0);
    const totalGrantedShares = rows.reduce((sum, row) => sum + Number(row.units ?? 0), 0);
    const totalVestedShares = rows.reduce((sum, row) => sum + Number(row.esop_vested_shares ?? 0), 0);
    const totalUnvestedShares = Math.max(0, totalGrantedShares - totalVestedShares);
    return {
      totalCurrentValue,
      totalGrantedShares,
      totalVestedShares,
      totalUnvestedShares,
      numberOfGrants: rows.length,
    };
  }, [rows]);

  const ownerOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.owner?.trim() ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const derivedForForm = useMemo(() => {
    return computeEsopDerivedValues({
      grantedShares: toNumber(formValues.granted_shares),
      vestedShares: toNumber(formValues.vested_shares),
      exercisePrice: toNumber(formValues.exercise_price),
      currentSharePrice: formValues.current_share_price === "" ? null : toNumber(formValues.current_share_price),
    });
  }, [formValues]);

  function updateFormField<K extends keyof EsopFormValues>(field: K, value: EsopFormValues[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
  }

  function toggleDocument(type: string) {
    setFormValues((current) => {
      if (current.documentsSelected.includes(type)) {
        return { ...current, documentsSelected: current.documentsSelected.filter((item) => item !== type) };
      }
      return { ...current, documentsSelected: [...current.documentsSelected, type] };
    });
  }

  function handleDocumentUpload(type: string, file: File | null) {
    setFormValues((current) => ({
      ...current,
      documentsSelected: current.documentsSelected.includes(type) ? current.documentsSelected : [...current.documentsSelected, type],
      documentsUploaded: {
        ...current.documentsUploaded,
        [type]: {
          fileName: file?.name ?? null,
          uploadDate: new Date().toISOString().slice(0, 10),
        },
      },
    }));
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};
    if (!formValues.company.trim()) nextErrors.company = "Company is required.";
    if (!formValues.grant_name.trim()) nextErrors.grant_name = "Grant name is required.";
    if (!formValues.owner.trim()) nextErrors.owner = "Owner is required.";
    if (!formValues.grant_date) nextErrors.grant_date = "Grant date is required.";
    if (toNumber(formValues.exercise_price) < 0) nextErrors.exercise_price = "Exercise price must be zero or higher.";
    if (toNumber(formValues.granted_shares) < 0) nextErrors.granted_shares = "Granted shares must be zero or higher.";
    if (toNumber(formValues.vested_shares) < 0) nextErrors.vested_shares = "Vested shares must be zero or higher.";
    if (toNumber(formValues.vested_shares) > toNumber(formValues.granted_shares)) nextErrors.vested_shares = "Vested shares cannot exceed granted shares.";
    if (formValues.current_share_price !== "" && toNumber(formValues.current_share_price) < 0) {
      nextErrors.current_share_price = "Current share price must be zero or higher.";
    }
    return nextErrors;
  }

  function openCreate() {
    setEditing(null);
    setFormValues(fromInvestment());
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(item: Investment) {
    setEditing(item);
    setFormValues(fromInvestment(item));
    setFormErrors({});
    setFormOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateForm();
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setError(null);
    setNotice(null);

    const payload = {
      company: formValues.company.trim(),
      grant_name: formValues.grant_name.trim(),
      owner: formValues.owner.trim(),
      grant_date: formValues.grant_date,
      exercise_price: toNumber(formValues.exercise_price),
      granted_shares: toNumber(formValues.granted_shares),
      vested_shares: toNumber(formValues.vested_shares),
      unvested_shares: Math.max(0, toNumber(formValues.granted_shares) - toNumber(formValues.vested_shares)),
      current_share_price: formValues.current_share_price === "" ? null : toNumber(formValues.current_share_price),
      grant_status: formValues.grant_status,
      notes: formValues.notes.trim() || null,
      documents_placeholder: serializeInvestmentDocuments({
        selectedTypes: formValues.documentsSelected,
        uploadedByType: formValues.documentsUploaded,
      }),
    };

    try {
      if (editing) {
        await updateEsop({ id: editing.id, ...payload });
        setNotice("ESOP grant updated.");
      } else {
        await createEsop(payload);
        setNotice("ESOP grant added.");
      }
      setFormOpen(false);
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save ESOP grant.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: Investment) {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await deleteEsop(item.id);
      setDeleteTarget(null);
      setNotice("ESOP grant deleted.");
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete ESOP grant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <PageContainer>
        <PageBreadcrumb items={[{ label: "WealthOS", href: "/dashboard" }, { label: "Investments", href: "/investments" }, { label: "ESOPs" }]} />
        <PageToolbar>
          <PageHeader title="ESOPs" description="Track grants, vesting progress, and exercise economics." summary={summary.numberOfGrants > 0 ? `${summary.numberOfGrants} Grants` : undefined} />
          <Button onClick={openCreate} disabled={submitting}>Add ESOP Grant</Button>
        </PageToolbar>

        <ToastViewport type="success" message={notice ?? ""} onDismiss={() => setNotice(null)} />
        <ToastViewport type="error" message={error ?? ""} onDismiss={() => setError(null)} />

        <ModuleKpiGrid>
          <InvestmentSummaryCard title="Total Current Value" value={summary.numberOfGrants === 0 ? "No Grants Yet" : formatCurrency(summary.totalCurrentValue, { maximumFractionDigits: 0 })} subtitle="Estimated value of vested shares" icon="wallet" />
          <InvestmentSummaryCard title="Total Granted Shares" value={summary.numberOfGrants === 0 ? "No Grants Yet" : `${summary.totalGrantedShares.toLocaleString("en-IN")}`} subtitle="Aggregate granted shares" icon="count" />
          <InvestmentSummaryCard title="Total Vested Shares" value={summary.numberOfGrants === 0 ? "No Grants Yet" : `${summary.totalVestedShares.toLocaleString("en-IN")}`} subtitle="Shares currently vested" icon="count" />
          <InvestmentSummaryCard title="Total Unvested Shares" value={summary.numberOfGrants === 0 ? "No Grants Yet" : `${summary.totalUnvestedShares.toLocaleString("en-IN")}`} subtitle="Shares yet to vest" icon="count" />
          <InvestmentSummaryCard title="Number of Grants" value={summary.numberOfGrants === 0 ? "No Grants Yet" : `${summary.numberOfGrants}`} subtitle="Active and historical grants" icon="allocation" />
        </ModuleKpiGrid>

        {rows.length === 0 ? (
          <ContentContainer>
            <ModuleOnboardingState
              title="No ESOP Grants Yet"
              description="Add your first grant to track vesting and value."
              steps={["Add Grant", "Update Vested Shares", "Track Current Share Price"]}
            />
          </ContentContainer>
        ) : null}

        <ContentContainer className="border-none bg-transparent p-0 shadow-none">
          <DataGrid
            title="ESOP Grants"
            description="Grant-level tracking for vesting and valuation"
            columns={[
              { key: "company", header: "Company", widthClassName: "min-w-36", cell: (row) => row.institution || "-" },
              { key: "grant_name", header: "Grant Name", widthClassName: "min-w-44", className: "font-medium text-slate-900", cell: (row) => row.investment_name },
              { key: "grant_date", header: "Grant Date", widthClassName: "min-w-28", cell: (row) => row.acquisition_date || row.purchase_date || "-" },
              { key: "exercise_price", header: "Exercise Price", widthClassName: "min-w-28", cell: (row) => formatCurrency(row.average_purchase_price ?? row.purchase_price ?? 0, { maximumFractionDigits: 2 }) },
              { key: "granted_shares", header: "Granted Shares", widthClassName: "min-w-28", cell: (row) => Number(row.units ?? 0).toLocaleString("en-IN") },
              { key: "vested_shares", header: "Vested Shares", widthClassName: "min-w-28", cell: (row) => Number(row.esop_vested_shares ?? 0).toLocaleString("en-IN") },
              {
                key: "unvested_shares",
                header: "Unvested Shares",
                widthClassName: "min-w-28",
                cell: (row) => Math.max(0, Number(row.units ?? 0) - Number(row.esop_vested_shares ?? 0)).toLocaleString("en-IN"),
              },
              { key: "current_value", header: "Current Value", widthClassName: "min-w-32", cell: (row) => formatCurrency(row.current_value, { maximumFractionDigits: 0 }) },
              { key: "owner", header: "Owner", widthClassName: "min-w-24", cell: (row) => row.owner || "-" },
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
            rows={filteredRows}
            getRowId={(row) => row.id}
            onRowClick={setSelected}
            search={{ value: query, onChange: setQuery, placeholder: "Search by company, grant, or owner" }}
            filters={
              <>
                <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                  <option value="all">All owners</option>
                  {ownerOptions.map((owner) => <option key={owner} value={owner}>{owner}</option>)}
                </select>
                <select className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | EsopGrantStatus)}>
                  <option value="all">All grant statuses</option>
                  {grantStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </>
            }
            actions={<Button size="sm" onClick={openCreate}>Add ESOP Grant</Button>}
            emptyTitle={loading ? "Loading ESOP grants..." : "No ESOP grants"}
            emptyDescription={loading ? "" : "Add your first grant to start tracking."}
            selection={{ enabled: false }}
          />
        </ContentContainer>
      </PageContainer>

      <InvestmentDetailsDialog
        investment={selected}
        totalPortfolioValue={summary.totalCurrentValue}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditing(null);
            setFormErrors({});
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit ESOP Grant" : "Add ESOP Grant"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5">
            <FormGrid>
              <FormField>
                <Label htmlFor="company">Company</Label>
                <Input id="company" value={formValues.company} onChange={(event) => updateFormField("company", event.target.value)} />
                {formErrors.company ? <p className="text-sm text-rose-600">{formErrors.company}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="grant_name">Grant Name</Label>
                <Input id="grant_name" value={formValues.grant_name} onChange={(event) => updateFormField("grant_name", event.target.value)} />
                {formErrors.grant_name ? <p className="text-sm text-rose-600">{formErrors.grant_name}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="owner">Owner</Label>
                <Input id="owner" value={formValues.owner} onChange={(event) => updateFormField("owner", event.target.value)} />
                {formErrors.owner ? <p className="text-sm text-rose-600">{formErrors.owner}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="grant_date">Grant Date</Label>
                <Input id="grant_date" type="date" value={formValues.grant_date} onChange={(event) => updateFormField("grant_date", event.target.value)} />
                {formErrors.grant_date ? <p className="text-sm text-rose-600">{formErrors.grant_date}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="exercise_price">Exercise Price</Label>
                <Input id="exercise_price" type="number" step="0.01" value={formValues.exercise_price} onChange={(event) => updateFormField("exercise_price", event.target.value)} />
                {formErrors.exercise_price ? <p className="text-sm text-rose-600">{formErrors.exercise_price}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="granted_shares">Granted Shares</Label>
                <Input id="granted_shares" type="number" step="0.0001" value={formValues.granted_shares} onChange={(event) => updateFormField("granted_shares", event.target.value)} />
                {formErrors.granted_shares ? <p className="text-sm text-rose-600">{formErrors.granted_shares}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="vested_shares">Vested Shares</Label>
                <Input id="vested_shares" type="number" step="0.0001" value={formValues.vested_shares} onChange={(event) => updateFormField("vested_shares", event.target.value)} />
                {formErrors.vested_shares ? <p className="text-sm text-rose-600">{formErrors.vested_shares}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="unvested_shares">Unvested Shares</Label>
                <Input id="unvested_shares" type="number" value={derivedForForm.unvestedShares} readOnly className="bg-slate-50" />
              </FormField>

              <FormField>
                <Label htmlFor="current_share_price">Current Share Price (optional)</Label>
                <Input id="current_share_price" type="number" step="0.01" value={formValues.current_share_price} onChange={(event) => updateFormField("current_share_price", event.target.value)} />
                {formErrors.current_share_price ? <p className="text-sm text-rose-600">{formErrors.current_share_price}</p> : null}
              </FormField>

              <FormField>
                <Label htmlFor="grant_status">Status</Label>
                <select id="grant_status" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={formValues.grant_status} onChange={(event) => updateFormField("grant_status", event.target.value as EsopGrantStatus)}>
                  {grantStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </FormField>
            </FormGrid>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-700">Calculated Metrics</p>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                <p>Current Value: <span className="font-semibold text-slate-900">{formatCurrency(derivedForForm.currentValue, { maximumFractionDigits: 0 })}</span></p>
                <p>Total Cost to Exercise: <span className="font-semibold text-slate-900">{formatCurrency(derivedForForm.totalCostToExercise, { maximumFractionDigits: 0 })}</span></p>
                <p>Vested %: <span className="font-semibold text-slate-900">{derivedForForm.vestedPercent.toFixed(2)}%</span></p>
                <p>Unvested %: <span className="font-semibold text-slate-900">{derivedForForm.unvestedPercent.toFixed(2)}%</span></p>
                <p>Unrealized Gain: <span className={`font-semibold ${derivedForForm.unrealizedGain >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{formatSignedCurrency(derivedForForm.unrealizedGain)}</span></p>
              </div>
            </div>

            <FormField>
              <Label>Documents</Label>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                {["Grant Letter", "Vesting Schedule", "Exercise Record", "Other"].map((type) => (
                  <div key={type} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <label className="flex items-center gap-2 text-slate-700">
                      <input type="checkbox" checked={formValues.documentsSelected.includes(type)} onChange={() => toggleDocument(type)} />
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
              <Textarea id="notes" rows={4} value={formValues.notes} onChange={(event) => updateFormField("notes", event.target.value)} />
            </FormField>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editing ? "Save changes" : "Add Grant"}</Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete ESOP grant</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Are you sure you want to delete this ESOP grant?</p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={submitting}>Cancel</Button>
            <Button variant="outline" onClick={() => deleteTarget && handleDelete(deleteTarget)} disabled={submitting}>{submitting ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
